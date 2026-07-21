// Display-layer localization for perk/add-on/item NAMES only.
//
// Allow/deny resolution and sorting in resolve.ts stay entirely English (the
// -build.yaml selectors are English, and the generated build sheets sort by
// English name). This module is applied at the very end — where BalancingList
// maps resolved entries to display strings — to append a localized name on
// non-English pages: "Adrenaline (アドレナリン)".
//
// Translations are repo-maintained maps, one file per (domain, language):
// src/data/dbd/i18n/<domain>.<lang>.json — e.g. perks.ja.json, addons.ko.json.
// Their keys are *slugs* (frozen identifiers derived once from an English
// name via slugify(), then never recomputed) — not the English name itself.
// The join from a display-time English name to a slug goes through the
// slug registry at src/data/dbd/i18n/slugs/<domain>.json, which maps
// slug -> { name, ... }. We build the *inverse* of that registry here
// (name -> slug) and use it to resolve the slug for a given English name.
//
// Critically, we never call slugify() here: if a perk/add-on/item is
// renamed, the registry's `name` field is updated (by the generator that
// maintains it) but the slug itself does not change, so the translation
// keyed by that slug keeps working. Deriving the slug at runtime from the
// current name would break that guarantee.
//
// Every <domain>.<lang>.json and slugs/<domain>.json file is auto-discovered
// via import.meta.glob and indexed at build time, keyed at display time on
// the current locale (Astro.currentLocale). Entries may be partial; a name
// with no entry for the active language falls back to English only (no
// parentheses).
//
// Adding a language needs NO change here: drop the <domain>.<lang>.json files
// into src/data/dbd/i18n/ and register the locale in astro.config.mjs.

import { normalize } from './normalize';

export type NameDomain = 'perk' | 'addon' | 'item';

// Filename stem (plural, as used in <stem>.<lang>.json and slugs/<stem>.json)
// -> canonical domain. This also gates discovery: files whose stem isn't
// listed here are ignored, keeping NameDomain the single source of valid
// domains.
const DOMAIN_BY_STEM: Record<string, NameDomain> = {
  perks: 'perk',
  addons: 'addon',
  items: 'item',
};

// Separator used when building composite inverse-map keys (addon: killer +
// name; item: kind + name). Chosen so it can't collide with normalize()'s
// output, which never contains a literal space (normalize() strips
// whitespace).
const SEP = ' ';

// A translation value may be a bare localized name, or an object carrying a
// primary `name` plus optional `aliases`/`abbreviations` (mirroring the English
// perks.json structure). Only `name` drives display today; the alias fields are
// stored for future use (e.g. search).
export interface LocalizedName {
  name: string;
  aliases?: string[];
  abbreviations?: string[];
}
export type NameMap = Record<string, string | LocalizedName>;

/** Normalize a value to the object shape, wrapping a bare string as `{ name }`. */
function toEntry(value: string | LocalizedName): LocalizedName {
  return typeof value === 'string' ? { name: value } : value;
}

// Build a lookup keyed by the *verbatim* JSON key. Translation file keys are
// already frozen slugs (e.g. "the-oni/pocket-watch", "adrenaline") — they
// must NOT be run through normalize(), which would mangle the "/" and "-"
// characters slugs rely on. Keep the maps per-(lang, domain) — never merged —
// so a perk and an add-on that share a slug can't cross-translate. Perks
// retain the full entry (name + aliases) so the perk display can surface
// localized aliases; add-ons/items only ever need the name.
function buildNameLookup(map: NameMap): Map<string, LocalizedName> {
  const lookup = new Map<string, LocalizedName>();
  for (const [slug, value] of Object.entries(map)) {
    if (!lookup.has(slug)) lookup.set(slug, toEntry(value));
  }
  return lookup;
}

/** Empty per-domain lookups for a freshly seen language. */
function emptyDomainLookups(): Record<NameDomain, Map<string, LocalizedName>> {
  return { perk: new Map(), addon: new Map(), item: new Map() };
}

// Discover every src/data/dbd/i18n/<domain>.<lang>.json at build time and index
// it as LOOKUPS[lang][domain]. The glob argument must be a string literal (Vite
// requirement); eager glob keeps these JSON files in the watched module graph,
// so editing one hot-reloads during `astro dev`. This glob is intentionally
// non-recursive, so it does not also pick up src/data/dbd/i18n/slugs/*.json.
const files = import.meta.glob<{ default: NameMap }>('../../data/dbd/i18n/*.json', {
  eager: true,
});

const LOOKUPS = new Map<string, Record<NameDomain, Map<string, LocalizedName>>>();
for (const [filePath, mod] of Object.entries(files)) {
  // e.g. ".../perks.ja.json" -> stem "perks", lang "ja".
  const fileName = filePath.split('/').pop() ?? '';
  const [stem, lang] = fileName.split('.');
  const domain = DOMAIN_BY_STEM[stem];
  if (!domain || !lang) continue; // skip unrecognized files defensively
  let byDomain = LOOKUPS.get(lang);
  if (!byDomain) {
    byDomain = emptyDomainLookups();
    LOOKUPS.set(lang, byDomain);
  }
  byDomain[domain] = buildNameLookup(mod.default);
}

// --- Slug registry: build name -> slug inverse maps ------------------------
//
// Registry shapes (slug -> identity), one file per domain:
//   slugs/perks.json:  { "<slug>": { name } }
//   slugs/addons.json: { "<killerSlug>/<addonSlug>": { name, killer } }
//   slugs/items.json:  { "<kind>/<slug>": { name, kind } } where kind is one
//                       of "type" | "variant" | "addon".
//
// The inverse-map keys below mirror how localizeName() will be called: a
// perk is looked up by its (normalized) English name alone; an add-on needs
// its killer for disambiguation (the same add-on name can exist under
// multiple killers); an item needs its `kind` (type/variant/addon namespaces
// don't collide by name, but keeping them separate here matches the
// registry's own key structure).
interface PerkEntry {
  name: string;
}
interface AddonEntry {
  name: string;
  killer: string;
}
interface ItemEntry {
  name: string;
  kind: 'type' | 'variant' | 'addon';
}

const perkInverse = new Map<string, string>();
const addonInverse = new Map<string, string>();
const itemInverse = new Map<string, string>();

const registryFiles = import.meta.glob<{ default: Record<string, unknown> }>(
  '../../data/dbd/i18n/slugs/*.json',
  { eager: true }
);

for (const [filePath, mod] of Object.entries(registryFiles)) {
  // e.g. ".../slugs/perks.json" -> stem "perks".
  const fileName = filePath.split('/').pop() ?? '';
  const [stem] = fileName.split('.');
  const domain = DOMAIN_BY_STEM[stem];
  if (!domain) continue; // skip unrecognized files defensively

  for (const [slug, rawEntry] of Object.entries(mod.default)) {
    if (domain === 'perk') {
      const entry = rawEntry as PerkEntry;
      const key = normalize(entry.name);
      if (!perkInverse.has(key)) perkInverse.set(key, slug);
    } else if (domain === 'addon') {
      const entry = rawEntry as AddonEntry;
      const key = normalize(entry.killer) + SEP + normalize(entry.name);
      if (!addonInverse.has(key)) addonInverse.set(key, slug);
    } else if (domain === 'item') {
      const entry = rawEntry as ItemEntry;
      const key = entry.kind + SEP + normalize(entry.name);
      if (!itemInverse.has(key)) itemInverse.set(key, slug);
    }
  }
}

/** Wrap a primary name with its aliases in parens: `"Name (a, b)"`, or just `"Name"`. */
function withAliases(name: string, aliases?: string[]): string {
  return aliases && aliases.length ? `${name} (${aliases.join(', ')})` : name;
}

/** Disambiguation context needed to resolve an English name to a registry slug. */
export interface LocalizeOpts {
  /** Perk aliases (from perks.json), rendered in the always-on English cluster. */
  aliases?: string[];
  /** Add-on's owning killer (English name) — add-on names aren't unique across killers. */
  killer?: string;
  /** Item namespace — type/variant/addon names live in separate slug namespaces. */
  kind?: 'type' | 'variant' | 'addon';
}

/**
 * Return the display name for the current locale.
 *
 * A locale is "translatable" when at least one <domain>.<lang>.json file exists
 * for it (English is the authoritative root and ships no such files, so it
 * always renders English-only). For a translatable locale, the English name is
 * first resolved to a frozen slug via the slug registry (never recomputed with
 * slugify()); a per-slug translation is then applied when present, else the
 * English name is returned unchanged.
 *
 * - **perk**: the English cluster `"<English> (<English aliases>)"` always
 *   renders (aliases come from `opts.aliases`, the perk's `perks.json`
 *   aliases — abbreviations never render). When a translation exists for the
 *   active locale, a bilingual em-dash line is appended:
 *   `"<English> (<English aliases>) — <localized> (<localized aliases>)"`.
 * - **addon/item**: `"<English> (<localized>)"` when a translation exists,
 *   else the English name unchanged. Resolving the slug requires `opts.killer`
 *   (addon) or `opts.kind` (item); without it, no slug can be resolved and the
 *   English name renders unchanged.
 */
export function localizeName(
  english: string,
  locale: string | undefined,
  domain: NameDomain,
  opts?: LocalizeOpts
): string {
  const table = locale ? LOOKUPS.get(locale) : undefined;

  if (domain === 'perk') {
    const enCluster = withAliases(english, opts?.aliases);
    const slug = perkInverse.get(normalize(english));
    const t = slug ? table?.perk.get(slug) : undefined;
    return t ? `${enCluster} — ${withAliases(t.name, t.aliases)}` : enCluster;
  }

  if (domain === 'addon') {
    const slug = opts?.killer
      ? addonInverse.get(normalize(opts.killer) + SEP + normalize(english))
      : undefined;
    const t = slug ? table?.addon.get(slug) : undefined;
    return t ? `${english} (${t.name})` : english;
  }

  // domain === 'item'
  const slug = opts?.kind ? itemInverse.get(opts.kind + SEP + normalize(english)) : undefined;
  const t = slug ? table?.item.get(slug) : undefined;
  return t ? `${english} (${t.name})` : english;
}
