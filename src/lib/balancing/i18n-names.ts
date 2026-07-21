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
// project-owned, slug-keyed data files (src/data/dbd/perks.json,
// addons.json, items.json), whose map keys *are* the frozen slug identities
// (there is no separate slug registry anymore — it was absorbed into these
// files). We build the *inverse* of each owned file here (name -> slug) and
// use it to resolve the slug for a given English name. Item identities are
// synthesized as "<kind>/<slug>" (kind is "type" | "variant" | "addon") to
// match the item translation files' keys, since items.json itself is
// relational (types own nested add-ons; variants reference a type) rather
// than a flat kind-prefixed map.
//
// Critically, we never call slugify() here: if a perk/add-on/item is
// renamed, the owned file's `name` field is updated but the slug (map key)
// itself does not change, so the translation keyed by that slug keeps
// working. Deriving the slug at runtime from the current name would break
// that guarantee.
//
// Every <domain>.<lang>.json translation file is auto-discovered via
// import.meta.glob and indexed at build time, keyed at display time on the
// current locale (Astro.currentLocale). Entries may be partial; a name with
// no entry for the active language falls back to English only (no
// parentheses). The owned data files driving the inverse maps are static
// imports (they're operational data, not a discoverable set of files).
//
// Adding a language needs NO change here: drop the <domain>.<lang>.json files
// into src/data/dbd/i18n/ and register the locale in astro.config.mjs.

import { normalize } from './normalize';
import perksJson from '../../data/dbd/perks.json' with { type: 'json' };
import addonsJson from '../../data/dbd/addons.json' with { type: 'json' };
import itemsJson from '../../data/dbd/items.json' with { type: 'json' };
import mapsJson from '../../data/dbd/maps.json' with { type: 'json' };
import type { PerkEntry, AddonEntry, ItemsData, MapEntry } from './types';

export type NameDomain = 'perk' | 'addon' | 'item' | 'map';

// Filename stem (plural, as used in <stem>.<lang>.json translation files)
// -> canonical domain. This also gates discovery: files whose stem isn't
// listed here are ignored, keeping NameDomain the single source of valid
// domains.
const DOMAIN_BY_STEM: Record<string, NameDomain> = {
  perks: 'perk',
  addons: 'addon',
  items: 'item',
  maps: 'map',
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
  return { perk: new Map(), addon: new Map(), item: new Map(), map: new Map() };
}

// Discover every src/data/dbd/i18n/<domain>.<lang>.json at build time and index
// it as LOOKUPS[lang][domain]. The glob argument must be a string literal (Vite
// requirement); eager glob keeps these JSON files in the watched module graph,
// so editing one hot-reloads during `astro dev`.
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

// --- Owned data files: build name -> slug inverse maps ---------------------
//
// Owned file shapes (slug -> entry), imported statically as operational data:
//   perks.json:  Record<slug, PerkEntry>            PerkEntry = { name, survivorPerk, aliases?, abbreviations?, ... }
//   addons.json: Record<"killerSlug/addonSlug", AddonEntry>  AddonEntry = { name, killer (English), rarity }
//   items.json:  ItemsData = { types: Record<typeSlug, { name, addons: Record<addonSlug, { name, rarity }> }>,
//                               variants: Record<variantSlug, { name, type, rarity }> }
//   maps.json:   Record<slug, MapEntry>              MapEntry = { name, family?, aliases?, abbreviations? }
//
// The inverse-map keys below mirror how localizeName() will be called: a
// perk is looked up by its (normalized) English name alone (also indexed by
// alias/abbreviation, so any known name form resolves — for future use, e.g.
// search); an add-on needs its killer for disambiguation (the same add-on
// name can exist under multiple killers); an item needs its `kind` (the
// type/variant/addon translation-key namespaces don't collide by name, but
// keeping them separate here matches the translation files' own key
// structure). Item inverse *values* are synthesized "<kind>/<slug>" strings
// so they line up exactly with the item translation files' keys (e.g.
// "type/flashlight", "addon/bandages", "variant/firecracker") even though
// items.json itself has no such flat key.

const perkInverse = new Map<string, string>();
const addonInverse = new Map<string, string>();
const itemInverse = new Map<string, string>();
const mapInverse = new Map<string, string>();

const perks = perksJson as Record<string, PerkEntry>;
const addons = addonsJson as Record<string, AddonEntry>;
const items = itemsJson as ItemsData;
const maps = mapsJson as Record<string, MapEntry>;

// Pass 1: canonical names win. Pass 2: aliases/abbreviations fill in any
// remaining (unclaimed) keys, so a canonical perk name is never shadowed by
// another perk's alias.
for (const [slug, entry] of Object.entries(perks)) {
  const key = normalize(entry.name);
  if (!perkInverse.has(key)) perkInverse.set(key, slug);
}
for (const [slug, entry] of Object.entries(perks)) {
  for (const alias of [...(entry.aliases ?? []), ...(entry.abbreviations ?? [])]) {
    const key = normalize(alias);
    if (!perkInverse.has(key)) perkInverse.set(key, slug);
  }
}

for (const [slug, entry] of Object.entries(maps)) {
  const key = normalize(entry.name);
  if (!mapInverse.has(key)) mapInverse.set(key, slug);
}
for (const [slug, entry] of Object.entries(maps)) {
  for (const alias of [...(entry.aliases ?? []), ...(entry.abbreviations ?? [])]) {
    const key = normalize(alias);
    if (!mapInverse.has(key)) mapInverse.set(key, slug);
  }
}

for (const [slug, entry] of Object.entries(addons)) {
  const key = normalize(entry.killer) + SEP + normalize(entry.name);
  if (!addonInverse.has(key)) addonInverse.set(key, slug);
}

for (const [typeSlug, t] of Object.entries(items.types)) {
  const typeKey = 'type' + SEP + normalize(t.name);
  if (!itemInverse.has(typeKey)) itemInverse.set(typeKey, 'type/' + typeSlug);
  for (const [addonSlug, a] of Object.entries(t.addons)) {
    const addonKey = 'addon' + SEP + normalize(a.name);
    if (!itemInverse.has(addonKey)) itemInverse.set(addonKey, 'addon/' + addonSlug);
  }
}
for (const [variantSlug, v] of Object.entries(items.variants)) {
  const variantKey = 'variant' + SEP + normalize(v.name);
  if (!itemInverse.has(variantKey)) itemInverse.set(variantKey, 'variant/' + variantSlug);
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
 * - **addon/item/map**: `"<English> (<localized>)"` when a translation exists,
 *   else the English name unchanged. Resolving the slug requires `opts.killer`
 *   (addon) or `opts.kind` (item); maps resolve directly by name. Without the
 *   required opt, no slug can be resolved and the English name renders unchanged.
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

  if (domain === 'map') {
    const slug = mapInverse.get(normalize(english));
    const t = slug ? table?.map.get(slug) : undefined;
    return t ? `${english} (${t.name})` : english;
  }

  // domain === 'item'
  const slug = opts?.kind ? itemInverse.get(opts.kind + SEP + normalize(english)) : undefined;
  const t = slug ? table?.item.get(slug) : undefined;
  return t ? `${english} (${t.name})` : english;
}
