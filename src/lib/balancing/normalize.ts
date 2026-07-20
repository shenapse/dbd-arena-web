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

/** An entry that carries a display name, optionally under a different key (e.g. killers use `Name`). */
export interface Named {
  name?: string;
  Name?: string;
  aliases?: string | string[];
  Aliases?: string | string[];
}

function displayName(entry: Named): string {
  const n = entry.name ?? entry.Name;
  if (n == null) throw new Error('normalize: entry has neither "name" nor "Name"');
  return n;
}

function aliasList(entry: Named): string[] {
  const raw = entry.aliases ?? entry.Aliases;
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : String(raw).split(',');
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
