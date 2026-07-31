// Resolves lifecycle metadata (status / version / effectiveDate /
// changeHistory) for a docs page from its AUTHORITATIVE English original,
// joined back BY PATH.
//
// English pages under src/content/docs/** are the single source of truth
// for lifecycle metadata (UX spec §6). Localized pages under
// src/content/docs/ja/** and src/content/docs/ko/** must not carry their own
// copies of that metadata — a second copy is exactly how a translation
// silently drifts out of sync with the ruleset it claims to describe.
// Instead, at build time, every localized page's lifecycle is resolved from
// the English entry at the same locale-independent path (see ./ids), so
// there is only ever one place that metadata can go stale.
//
// The id -> entry lookup is a lazily built, memoized Map from
// getCollection('docs') rather than a per-call getEntry(), because
// getEntry():
//   - warns to the console on a miss, where we want a hard, actionable
//     build failure instead;
//   - operates in the raw content-store id space, where the root index is
//     still literally 'index' rather than Starlight's normalized '';
//   - re-runs image-reference resolution on every call.
//
// Drafts are intentionally NOT filtered out of the lookup: an English
// original marked draft: true must still resolve for its already-published
// translation, otherwise a draft flag on the English page would silently
// break the localized pages that depend on it at build time.

import { getCollection, type CollectionEntry } from 'astro:content';
import { AstroError } from 'astro/errors';
import { normalizeDocsId, splitLocale, idToHref } from './ids';

export type DocsEntry = CollectionEntry<'docs'>;

export interface LifecycleChangeEntry {
  readonly version: string;
  readonly date: string;
  readonly note: string;
}

export interface LifecycleRecord {
  readonly status: 'active' | 'upcoming' | 'archived' | 'provisional';
  readonly version: string;
  readonly effectiveDate: string;
  readonly changeHistory: ReadonlyArray<LifecycleChangeEntry>;
}

export interface AuthoritativeSource {
  /** Locale-independent docs path (e.g. `game-modes/1v1-symmetric`), never locale-prefixed. */
  readonly id: string;
  /** Clean URL of the English original, e.g. `/game-modes/1v1-symmetric/`. */
  readonly href: string;
  readonly entry: DocsEntry;
  readonly lifecycle: LifecycleRecord | null;
}

export interface RouteLifecycle {
  readonly source: AuthoritativeSource;
  readonly lifecycle: LifecycleRecord | null;
}

/**
 * Frontmatter keys that are derived from the English original and therefore
 * forbidden on localized page files. `changeHistory` is deliberately absent
 * from this list — see `resolveLifecycleForRoute`'s notes-only override.
 */
const FORBIDDEN_LOCALIZED_KEYS = ['status', 'version', 'effectiveDate', 'authoritativeSource', 'language'] as const;

function fileLabel(entry: DocsEntry): string {
  return entry.filePath ?? entry.id;
}

// ---------------------------------------------------------------------------
// Lazy, memoized id -> entry lookup
// ---------------------------------------------------------------------------

let cache: Promise<ReadonlyMap<string, DocsEntry>> | undefined;

/**
 * All docs entries (English AND localized, drafts included), keyed by their
 * normalized id. English entries are stored under their bare
 * locale-independent id, so looking up a locale-stripped path here always
 * resolves to the English original (localized entries are keyed under their
 * own locale-prefixed id and are never hit by that lookup).
 */
function getDocsById(): Promise<ReadonlyMap<string, DocsEntry>> {
  cache ??= getCollection('docs').then((entries) => {
    const map = new Map<string, DocsEntry>();
    for (const entry of entries) {
      map.set(normalizeDocsId(entry.id), entry);
    }
    return map;
  });
  return cache;
}

// ---------------------------------------------------------------------------
// Lifecycle extraction
// ---------------------------------------------------------------------------

/**
 * Read the lifecycle block off a single (English) entry's frontmatter.
 * All-or-nothing: a page is either fully normative (`status` +
 * non-empty `changeHistory`) or fully informational (neither). `version`
 * and `effectiveDate` are never read from frontmatter — they are always
 * derived from the changeHistory entry with the newest `date`.
 */
export function readLifecycle(entry: DocsEntry): LifecycleRecord | null {
  const { status, changeHistory } = entry.data;
  const hasHistory = changeHistory !== undefined && changeHistory.length > 0;

  if (status === undefined && !hasHistory) return null;

  if (status === undefined || !hasHistory || changeHistory === undefined) {
    throw new AstroError(
      `Incomplete lifecycle metadata in ${fileLabel(entry)}: "status" and a non-empty "changeHistory" ` +
        `must both be present, or neither.`,
      'Add the missing field, or remove both fields to make this an informational (non-normative) page.'
    );
  }

  const current = pickCurrentChange(changeHistory);

  return {
    status,
    version: current.version,
    effectiveDate: current.date,
    changeHistory: changeHistory.map((c) => ({ version: c.version, date: c.date, note: c.note })),
  };
}

/**
 * Pick the "current" entry of a changeHistory array: the one with the
 * newest `date` (ISO `YYYY-MM-DD` strings compare correctly as plain
 * strings). Does NOT assume array order — `changeHistory[0]` is not
 * guaranteed to be the newest entry (some pages list oldest-first). Ties on
 * date keep the earlier array index.
 */
function pickCurrentChange<T extends { date: string }>(changeHistory: ReadonlyArray<T>): T {
  let current = changeHistory[0]!;
  for (let i = 1; i < changeHistory.length; i++) {
    const candidate = changeHistory[i]!;
    if (candidate.date > current.date) current = candidate;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Authoritative-source resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the English authoritative entry for a docs id (localized or
 * already-English). Joins by locale-independent path via `splitLocale`.
 */
export async function resolveAuthoritative(id: string): Promise<AuthoritativeSource> {
  const { path } = splitLocale(normalizeDocsId(id));
  const byId = await getDocsById();
  const entry = byId.get(path);

  if (!entry) {
    const expectedPath = path === '' ? 'index' : path;
    throw new AstroError(
      `No English original found for docs id "${id}" (resolved path "${path}").`,
      `Expected an English file at src/content/docs/${expectedPath}.mdx (or .md). English is the sole ` +
        `authoritative edition (UX spec §6) — every localized page must have a corresponding English ` +
        `original at the same path.`
    );
  }

  return {
    id: path,
    href: idToHref(path),
    entry,
    lifecycle: readLifecycle(entry),
  };
}

/**
 * Build-time enforcement: a localized FILE (not a Starlight locale-fallback
 * route, which shares the English entry and therefore has no locale prefix
 * in its id) must not declare any lifecycle/provenance key that is derived
 * from the English original. `changeHistory` is the one exception — see
 * `resolveLifecycleForRoute`.
 */
export function assertNoAuthoritativeOverrides(entry: DocsEntry): void {
  const { locale } = splitLocale(normalizeDocsId(entry.id));
  if (locale === undefined) return; // English original, or a locale-fallback route

  const found = FORBIDDEN_LOCALIZED_KEYS.filter((key) => entry.data[key] !== undefined);
  if (found.length === 0) return;

  throw new AstroError(
    `Localized page ${fileLabel(entry)} declares forbidden frontmatter key(s): ${found.join(', ')}.`,
    `${found.join(', ')} ${found.length === 1 ? 'is' : 'are'} derived from the English original at build ` +
      `time and must not be set on localized pages. ("changeHistory" is the one exception: it may be set ` +
      `to translate note text, but its version/date lineage must match the English original exactly.) ` +
      `Remove ${found.length === 1 ? 'this key' : 'these keys'} from the localized file's frontmatter.`
  );
}

// ---------------------------------------------------------------------------
// Route-level resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the authoritative English source for the current route, enforcing
 * that the current entry (if it's a real localized file) declares none of
 * the forbidden overrides. Used by components — e.g. TranslationNotice.astro
 * — that need the English `href`/`lifecycle` as-is, with no notes override.
 */
export async function resolveRouteAuthoritative(locals: App.Locals): Promise<AuthoritativeSource> {
  const entry = locals.starlightRoute.entry;
  assertNoAuthoritativeOverrides(entry);
  return resolveAuthoritative(entry.id);
}

/**
 * Convenience wrapper for components that render lifecycle metadata
 * (e.g. LifecycleMeta.astro) for the current route.
 *
 * `status`, `version`, and `effectiveDate` always come from the English
 * original. The one localized override allowed is notes-only: if the
 * current entry is a localized file and declares its own `changeHistory`,
 * the returned changeHistory keeps English's version/date lineage but
 * substitutes the localized `note` strings, matched by version. The
 * localized changeHistory's version/date set must match English's exactly
 * (same length, same versions, same dates) — translated notes are fine,
 * drifted lineage is not.
 */
export async function resolveLifecycleForRoute(locals: App.Locals): Promise<RouteLifecycle> {
  const entry = locals.starlightRoute.entry;
  const source = await resolveRouteAuthoritative(locals);

  const { locale } = splitLocale(normalizeDocsId(entry.id));
  const localizedChangeHistory = locale !== undefined ? entry.data.changeHistory : undefined;

  if (!localizedChangeHistory || localizedChangeHistory.length === 0 || source.lifecycle === null) {
    return { source, lifecycle: source.lifecycle };
  }

  const lifecycle = applyNotesOverride(source.lifecycle, localizedChangeHistory, entry);
  return { source, lifecycle };
}

function applyNotesOverride(
  lifecycle: LifecycleRecord,
  localizedChangeHistory: ReadonlyArray<{ version: string; date: string; note: string }>,
  entry: DocsEntry
): LifecycleRecord {
  const english = lifecycle.changeHistory;
  const localizedByVersion = new Map(localizedChangeHistory.map((c) => [c.version, c] as const));

  const sequenceMatches =
    localizedChangeHistory.length === english.length &&
    english.every((c) => localizedByVersion.get(c.version)?.date === c.date);

  if (!sequenceMatches) {
    throw new AstroError(
      `Localized changeHistory in ${fileLabel(entry)} does not match the English original's version/date lineage.`,
      `Localized changeHistory may translate "note" text, but must have the exact same set of versions and ` +
        `dates as the English original's changeHistory. Update the localized entries to match, or remove ` +
        `changeHistory from this file to inherit the English notes unchanged.`
    );
  }

  return {
    ...lifecycle,
    changeHistory: english.map((c) => ({
      version: c.version,
      date: c.date,
      note: localizedByVersion.get(c.version)!.note,
    })),
  };
}
