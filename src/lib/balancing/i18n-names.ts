// Display-layer localization for perk/add-on/item NAMES only.
//
// Allow/deny resolution and sorting in resolve.ts stay entirely English (the
// -build.yaml selectors are English, and the generated build sheets sort by
// English name). This module is applied at the very end — where BalancingList
// maps resolved entries to display strings — to append a Japanese name in
// parentheses on Japanese pages: "Adrenaline (アドレナリン)".
//
// Translations are repo-maintained maps keyed by the English name, one file per
// domain (src/data/dbd/i18n/<domain>.ja.json). Entries may be partial; a name
// with no Japanese entry falls back to English only (no parentheses).

import perksJa from '../../data/dbd/i18n/perks.ja.json' with { type: 'json' };
import addonsJa from '../../data/dbd/i18n/addons.ja.json' with { type: 'json' };
import itemsJa from '../../data/dbd/i18n/items.ja.json' with { type: 'json' };
import { normalize } from './normalize';

export type NameDomain = 'perk' | 'addon' | 'item';

// A translation value may be a bare Japanese name, or an object carrying a
// primary Japanese `name` plus optional Japanese `aliases`/`abbreviations`
// (mirroring the English perks.json structure). Only `name` drives display
// today; the alias fields are stored for future use (e.g. search).
export interface JaLocalizedName {
  name: string;
  aliases?: string[];
  abbreviations?: string[];
}
export type JaNameMap = Record<string, string | JaLocalizedName>;

/** Normalize a value to the object shape, wrapping a bare string as `{ name }`. */
function toJaEntry(value: string | JaLocalizedName): JaLocalizedName {
  return typeof value === 'string' ? { name: value } : value;
}

// Build a normalized lookup once per domain so punctuation/spacing differences
// between an entry's canonical name and a map key don't cause misses (mirrors
// how buildLookup normalizes in normalize.ts). Keep the maps per-domain — never
// merged — so a perk and an add-on that share an English name can't
// cross-translate. Perks retain the full entry (name + aliases) so the perk
// display can surface Japanese aliases; add-ons/items only ever need the name.
function buildJaLookup(map: JaNameMap): Map<string, JaLocalizedName> {
  const lookup = new Map<string, JaLocalizedName>();
  for (const [en, ja] of Object.entries(map)) {
    const key = normalize(en);
    if (!lookup.has(key)) lookup.set(key, toJaEntry(ja));
  }
  return lookup;
}

const JA_LOOKUPS: Record<NameDomain, Map<string, JaLocalizedName>> = {
  perk: buildJaLookup(perksJa as JaNameMap),
  addon: buildJaLookup(addonsJa as JaNameMap),
  item: buildJaLookup(itemsJa as JaNameMap),
};

/** Wrap a primary name with its aliases in parens: `"Name (a, b)"`, or just `"Name"`. */
function withAliases(name: string, aliases?: string[]): string {
  return aliases && aliases.length ? `${name} (${aliases.join(', ')})` : name;
}

/**
 * Return the display name for the current locale.
 *
 * On any non-Japanese locale, always returns `english` unchanged.
 *
 * On Japanese pages (`locale === 'ja'`):
 * - **perk**: a bilingual em-dash line
 *   `"<English> (<English aliases>) — <日本語> (<日本語 aliases>)"`, where the
 *   English aliases come from `englishAliases` (the perk's `perks.json` aliases)
 *   and the Japanese aliases from the `perks.ja.json` entry. Aliases only —
 *   abbreviations never render. If the perk has no Japanese entry, only the
 *   English cluster shows (no `—`).
 * - **addon/item**: `"<English> (<日本語>)"` when a translation exists, else the
 *   English name unchanged.
 */
export function localizeName(
  english: string,
  locale: string | undefined,
  domain: NameDomain,
  englishAliases?: string[]
): string {
  if (locale !== 'ja') return english;
  const ja = JA_LOOKUPS[domain].get(normalize(english));

  if (domain === 'perk') {
    const enCluster = withAliases(english, englishAliases);
    if (!ja) return enCluster;
    return `${enCluster} — ${withAliases(ja.name, ja.aliases)}`;
  }

  return ja ? `${english} (${ja.name})` : english;
}
