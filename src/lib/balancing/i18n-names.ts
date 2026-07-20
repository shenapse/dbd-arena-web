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

// Build a normalized lookup once per domain so punctuation/spacing differences
// between an entry's canonical name and a map key don't cause misses (mirrors
// how buildLookup normalizes in normalize.ts). Keep the maps per-domain — never
// merged — so a perk and an add-on that share an English name can't
// cross-translate.
function buildJaLookup(map: Record<string, string>): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [en, ja] of Object.entries(map)) {
    const key = normalize(en);
    if (!lookup.has(key)) lookup.set(key, ja);
  }
  return lookup;
}

const JA_LOOKUPS: Record<NameDomain, Map<string, string>> = {
  perk: buildJaLookup(perksJa as Record<string, string>),
  addon: buildJaLookup(addonsJa as Record<string, string>),
  item: buildJaLookup(itemsJa as Record<string, string>),
};

/**
 * Return the display name for the current locale.
 *
 * On Japanese pages (`locale === 'ja'`), returns `"<English> (<日本語>)"` when a
 * translation exists for `english` in `domain`, otherwise the English name
 * unchanged. On any other locale, always returns the English name unchanged.
 */
export function localizeName(
  english: string,
  locale: string | undefined,
  domain: NameDomain
): string {
  if (locale !== 'ja') return english;
  const ja = JA_LOOKUPS[domain].get(normalize(english));
  return ja ? `${english} (${ja})` : english;
}
