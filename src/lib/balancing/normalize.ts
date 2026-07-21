// Name normalization + alias-aware lookup helpers, ported from the
// balancing-tool generators (perk-sheet-generator.js / addon-sheet-generator.js /
// item-sheet-generator.js `normalize`). All three generators use the same
// character class, so a single implementation covers perks, add-ons, items,
// and killers.
//
// IMPORTANT: mirror the *code*, not the YAML comments in the -build.yaml files
// (see the task brief) — those comments are misleading about default/allow
// semantics but the normalize() behavior itself is consistent everywhere.

/** Lowercase and strip spaces and the characters `- _ ' .` */
export function normalize(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/[\s\-_'.]+/g, '');
}

/**
 * Lowercase, collapse every run of non-`[a-z0-9]` characters to a single `-`,
 * and strip any leading/trailing `-`. Used to derive repo-owned, frozen i18n
 * join keys (slugs) for perks/add-ons/items — distinct from `normalize()`,
 * which is used for fuzzy display-name lookups, not identity.
 */
export function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** An entry that carries a display name, optionally under a different key (e.g. killers use `Name`). */
export interface Named {
  name?: string;
  Name?: string;
  aliases?: string | string[];
  Aliases?: string | string[];
  abbreviations?: string | string[];
  Abbreviations?: string | string[];
}

function displayName(entry: Named): string {
  const n = entry.name ?? entry.Name;
  if (n == null) throw new Error('normalize: entry has neither "name" nor "Name"');
  return n;
}

function toList(raw: string | string[] | undefined): string[] {
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : String(raw).split(',');
}

function aliasList(entry: Named): string[] {
  return [
    ...toList(entry.aliases ?? entry.Aliases),
    ...toList(entry.abbreviations ?? entry.Abbreviations),
  ];
}

/**
 * Build a lookup map: normalized name/alias -> entry. First occurrence wins
 * (matches buildPerkLookup/buildKillerLookup's `if (!map.has(norm))` guard).
 */
export function buildLookup<T extends Named>(entries: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const entry of entries) {
    const norm = normalize(displayName(entry));
    if (!map.has(norm)) map.set(norm, entry);
    for (const alias of aliasList(entry)) {
      const na = normalize(alias.trim());
      if (na && !map.has(na)) map.set(na, entry);
    }
  }
  return map;
}
