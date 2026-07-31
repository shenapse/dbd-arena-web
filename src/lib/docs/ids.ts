// Pure, dependency-free helpers for reasoning about Starlight docs
// collection entry ids and the URLs they map to.
//
// Deliberately free of any `astro:content` (or other Astro) import: this
// module is imported both from Astro components/pages AND directly by
// scripts/check-translations.mjs via plain Node (mirroring the existing
// pattern of scripts/check-dbd-data.mjs importing
// ../src/lib/balancing/normalize.ts). Pulling in `astro:content` here would
// make that script un-runnable outside the Astro content pipeline.
//
// English pages under src/content/docs/** are the sole authoritative
// edition (UX spec §6); localized pages under src/content/docs/ja/** and
// src/content/docs/ko/** are joined back to their English original BY PATH,
// which is exactly what `splitLocale` computes.

/**
 * Locale prefixes Starlight is configured with beyond the English root.
 * Mirrors the `locales` map in astro.config.mjs: `root` is English (no URL
 * prefix), `ja` and `ko` are prefixed locales.
 */
export const LOCALE_PREFIXES = ['ja', 'ko'] as const;

export type LocalePrefix = (typeof LOCALE_PREFIXES)[number];

/**
 * Normalize a raw docs collection entry id the way Starlight normalizes the
 * root index page: the store id `index` becomes `''`. This mirrors
 * Starlight's internal `normalizeIndexSlug` — `Astro.locals.starlightRoute`
 * already reflects this normalization, but a Map built directly off
 * `getCollection('docs')` entry ids has not had it applied and needs this
 * helper to line up with route-derived ids.
 *
 * Only the bare root id is affected; nested `.../index` ids are already
 * stripped to `.../` by the loader itself (no trailing `/index` survives),
 * per docsLoader's id derivation.
 */
export function normalizeDocsId(id: string): string {
  return id === 'index' ? '' : id;
}

/**
 * Split a (normalized) docs id into its locale prefix and the
 * locale-independent path underneath it.
 *
 * - `'ja/a/b'` -> `{ locale: 'ja', path: 'a/b' }`
 * - `'ja'` -> `{ locale: 'ja', path: '' }` (bare locale root)
 * - `'a/b'` -> `{ locale: undefined, path: 'a/b' }`
 *
 * Only an exact first path segment match counts as a locale — a segment
 * that merely starts with a locale name (e.g. `jason/x`) is left alone.
 */
export function splitLocale(id: string): { locale: LocalePrefix | undefined; path: string } {
  const slashIndex = id.indexOf('/');
  const firstSegment = slashIndex === -1 ? id : id.slice(0, slashIndex);
  const rest = slashIndex === -1 ? '' : id.slice(slashIndex + 1);

  const locale = (LOCALE_PREFIXES as readonly string[]).includes(firstSegment)
    ? (firstSegment as LocalePrefix)
    : undefined;

  if (locale === undefined) {
    return { locale: undefined, path: id };
  }
  return { locale, path: rest };
}

/**
 * Build the clean, trailing-slash URL Starlight serves for a
 * locale-independent docs path, optionally prefixed with a locale.
 *
 * - `idToHref('')` -> `'/'`
 * - `idToHref('a/b')` -> `'/a/b/'`
 * - `idToHref('a/b', 'ja')` -> `'/ja/a/b/'`
 *
 * This must exactly reproduce the `authoritativeSource` frontmatter values
 * already hand-authored on localized pages (verified: all 38 localized
 * pages have `authoritativeSource` === `'/' + pathMinusLocale + '/'`).
 */
export function idToHref(id: string, locale?: LocalePrefix): string {
  const segments = [locale, id].filter((segment): segment is string => !!segment);
  if (segments.length === 0) return '/';
  return `/${segments.join('/')}/`;
}
