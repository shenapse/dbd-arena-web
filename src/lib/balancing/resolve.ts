// Allow/deny resolution core, ported from the balancing-tool generators:
//   - ../balancing-tool/utilities/perk-sheet-generator/perk-sheet-generator.js
//     (normalize, buildPerkLookup, matchSelector, resolveSide)
//   - ../balancing-tool/utilities/addon-sheet-generator/addon-sheet-generator.js
//     (matchSelector, resolveAllowList, rarityToIndex, RARITY_NAMES)
//   - ../balancing-tool/utilities/item-sheet-generator/item-sheet-generator.js
//     (resolveAllowList, rarityToIndex, RARITY_NAMES)
//
// Semantics mirror the SOURCE CODE, not the (sometimes misleading) comments in
// the -build.yaml files: seed the allowed set from `default` (perks default to
// 'allow', add-ons/items default to 'deny' when `default` is omitted — the
// -build.yaml files we ship set `default` explicitly anyway), apply every
// `deny:` selector, then apply every `allow:` selector — allow wins on
// conflict. The result is sorted by name via localeCompare.
//
// An unknown plain-string name throws a descriptive Error; we want a bad
// -build.yaml to fail the site build loudly rather than silently render a
// wrong list.

import perksJson from '../../data/dbd/perks.json' with { type: 'json' };
import addonsJson from '../../data/dbd/addons.json' with { type: 'json' };
import itemsJson from '../../data/dbd/items.json' with { type: 'json' };
import killersJson from '../../data/dbd/killers.json' with { type: 'json' };
import { normalize, buildLookup } from './normalize';
import type {
  Perk,
  Addon,
  KillerAddons,
  ItemType,
  ItemTypeAddon,
  ItemVariant,
  ItemsData,
  KillerEntry,
  Selector,
  AllowDenyConfig,
  ItemsConfig,
  ResolvedList,
} from './types';

const allPerks = perksJson as unknown as Perk[];
const allKillerAddons = addonsJson as unknown as KillerAddons[];
const itemsData = itemsJson as unknown as ItemsData;
const allKillers = killersJson as unknown as KillerEntry[];

const killerLookup = buildLookup(allKillers);

// ---------------------------------------------------------------------------
// Rarity models
// ---------------------------------------------------------------------------
// Power add-ons (NewAddons.json): 5 rarities.
const ADDON_RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Ultra Rare'];
// Item variants + item add-ons (Items.json): item variants can additionally be
// Rarity 5 ("Event"), so item-side rarity selectors use a 6-name list.
const ITEM_RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Ultra Rare', 'Event'];

function rarityToIndex(value: string | number, names: readonly string[], context: string): number {
  if (typeof value === 'number') {
    if (value >= 0 && value < names.length) return value;
    throw new Error(`Rarity index ${value} out of range (0-${names.length - 1}) (${context}).`);
  }
  const norm = normalize(value);
  const idx = names.findIndex((n) => normalize(n) === norm);
  if (idx === -1) {
    throw new Error(
      `Unknown rarity "${value}" (${context}). Expected one of: ${names.join(', ')} (or a 0-${names.length - 1} index).`
    );
  }
  return idx;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Perks
// ---------------------------------------------------------------------------

function matchPerkSelector(
  selector: Selector,
  universe: readonly Perk[],
  lookup: Map<string, Perk>,
  context: string
): Perk[] {
  if (typeof selector === 'string') {
    const perk = lookup.get(normalize(selector));
    if (!perk) {
      throw new Error(`Unknown perk name "${selector}" (${context}). No matching perk found on this side.`);
    }
    return [perk];
  }
  if (isPlainObject(selector)) {
    if (selector.exhaustion === true) {
      return universe.filter((p) => p.exhaustion === true);
    }
    if (typeof selector.tag === 'string') {
      const tag = selector.tag.toLowerCase();
      return universe.filter((p) => Array.isArray(p.tags) && p.tags.some((t) => t.toLowerCase() === tag));
    }
    // YAML parses `- Boon: Circle of Healing` as { Boon: "Circle of Healing" }
    // instead of a string. If the object has exactly one key that isn't a
    // known selector keyword, reconstruct the intended perk name.
    const keys = Object.keys(selector);
    if (keys.length === 1) {
      const key = keys[0]!;
      const value = selector[key];
      const reconstructed = `${key}: ${String(value)}`;
      const perk = lookup.get(normalize(reconstructed));
      if (perk) return [perk];
      throw new Error(
        `Unknown perk name "${reconstructed}" (${context}). No matching perk found on this side. ` +
          `If this is a perk name containing a colon, wrap it in quotes in the YAML (e.g. "Boon: Circle of Healing").`
      );
    }
    throw new Error(
      `Unknown group selector ${JSON.stringify(selector)} (${context}). Only { exhaustion: true } and { tag: "<name>" } are supported.`
    );
  }
  throw new Error(`Invalid selector value ${JSON.stringify(selector)} (${context}).`);
}

/**
 * Resolve allowed perks for one side (killer or survivor) of a `-build.yaml`.
 * @param sideConfig - the `killerPerks:`/`survivorPerks:` block ({ default, allow, deny })
 * @param side - which perk universe to resolve against
 * @param context - human-readable label for error messages, e.g. `"killerPerks (killer: The Blight)"`
 */
export function resolvePerks(
  sideConfig: AllowDenyConfig | undefined,
  side: 'killer' | 'survivor',
  context: string
): ResolvedList<Perk> {
  const isSurvivor = side === 'survivor';
  const universe = allPerks.filter((p) => p.survivorPerk === isSurvivor);
  const lookup = buildLookup(universe);

  const defaultVal = sideConfig?.default ?? 'allow';
  if (defaultVal !== 'allow' && defaultVal !== 'deny') {
    throw new Error(`"default" must be "allow" or "deny" (${context}).`);
  }

  const allowed = new Map<number, Perk>();
  if (defaultVal === 'allow') {
    for (const p of universe) allowed.set(p.id, p);
  }
  for (const sel of sideConfig?.deny ?? []) {
    for (const p of matchPerkSelector(sel, universe, lookup, context)) allowed.delete(p.id);
  }
  for (const sel of sideConfig?.allow ?? []) {
    for (const p of matchPerkSelector(sel, universe, lookup, context)) allowed.set(p.id, p);
  }

  return finalizeList(allowed, universe, (p) => p.id, (p) => p.name);
}

// ---------------------------------------------------------------------------
// Shared allowed/banned finalization
// ---------------------------------------------------------------------------

function finalizeList<T>(
  allowed: Map<number, T>,
  universe: readonly T[],
  keyOf: (e: T) => number,
  nameOf: (e: T) => string
): ResolvedList<T> {
  const allowedList = [...allowed.values()].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const allowedIds = new Set(allowedList.map(keyOf));
  const bannedList = universe.filter((e) => !allowedIds.has(keyOf(e))).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  return { allowed: allowedList, banned: bannedList, universe: [...universe] };
}

// ---------------------------------------------------------------------------
// Killer add-ons
// ---------------------------------------------------------------------------

function matchAddonSelector(
  selector: Selector,
  universe: readonly Addon[],
  lookup: Map<string, Addon>,
  context: string
): Addon[] {
  if (typeof selector === 'string') {
    const addon = lookup.get(normalize(selector));
    if (!addon) {
      throw new Error(`Unknown add-on name "${selector}" (${context}). No matching add-on found for this killer.`);
    }
    return [addon];
  }
  if (isPlainObject(selector)) {
    if (selector.rarity !== undefined) {
      const idx = rarityToIndex(selector.rarity as string | number, ADDON_RARITY_NAMES, context);
      return universe.filter((a) => a.Rarity === idx);
    }
    if (selector.tier !== undefined) {
      const idx = rarityToIndex(selector.tier as string | number, ADDON_RARITY_NAMES, context);
      return universe.filter((a) => a.Rarity === idx);
    }
    throw new Error(
      `Unknown group selector ${JSON.stringify(selector)} (${context}). Only { rarity: "<name>" } and { tier: <0-4> } are supported.`
    );
  }
  throw new Error(`Invalid selector value ${JSON.stringify(selector)} (${context}).`);
}

/** Resolve a `-build.yaml`'s `killer:` field to its canonical killers.json entry. */
export function resolveKiller(killerName: string, context: string): KillerEntry {
  const killer = killerLookup.get(normalize(killerName));
  if (!killer) {
    throw new Error(`Unknown killer "${killerName}" (${context}). No matching entry in killers.json.`);
  }
  return killer;
}

/**
 * Resolve allowed killer add-ons.
 * @param addonsConfig - the `addons:` block ({ default, allow, deny })
 * @param killerName - the YAML's `killer:` field (e.g. "The Blight")
 * @param context - human-readable label for error messages
 */
export function resolveAddons(
  addonsConfig: AllowDenyConfig | undefined,
  killerName: string,
  context: string
): ResolvedList<Addon> {
  const killer = resolveKiller(killerName, context);
  const killerAddons = allKillerAddons.find((k) => normalize(k.Name) === normalize(killer.Name));
  if (!killerAddons) {
    throw new Error(`No add-ons found for killer "${killer.Name}" in addons.json (${context}).`);
  }
  const universe = killerAddons.Addons;
  const lookup = buildLookup(universe);

  const defaultVal = addonsConfig?.default ?? 'deny';
  if (defaultVal !== 'allow' && defaultVal !== 'deny') {
    throw new Error(`"default" must be "allow" or "deny" (${context}).`);
  }

  const allowed = new Map<number, Addon>();
  if (defaultVal === 'allow') {
    for (const a of universe) allowed.set(a.globalID, a);
  }
  for (const sel of addonsConfig?.deny ?? []) {
    for (const a of matchAddonSelector(sel, universe, lookup, context)) allowed.delete(a.globalID);
  }
  for (const sel of addonsConfig?.allow ?? []) {
    for (const a of matchAddonSelector(sel, universe, lookup, context)) allowed.set(a.globalID, a);
  }

  return finalizeList(allowed, universe, (a) => a.globalID, (a) => a.Name);
}

// ---------------------------------------------------------------------------
// Items (variants + their add-ons, per item type)
// ---------------------------------------------------------------------------

const itemTypes = itemsData.ItemTypes;
const itemVariants = itemsData.Items;

function matchItemEntrySelector<T extends { Name: string; Rarity: number }>(
  selector: Selector,
  universe: readonly T[],
  lookup: Map<string, T>,
  context: string
): T[] {
  if (typeof selector === 'string') {
    const entry = lookup.get(normalize(selector));
    if (!entry) {
      throw new Error(`Unknown item entry "${selector}" (${context}).`);
    }
    return [entry];
  }
  if (isPlainObject(selector) && selector.rarity !== undefined) {
    const idx = rarityToIndex(selector.rarity as string | number, ITEM_RARITY_NAMES, context);
    return universe.filter((e) => e.Rarity === idx);
  }
  throw new Error(
    `Invalid item selector ${JSON.stringify(selector)} (${context}). Expected a plain name string or a {rarity: ...} object.`
  );
}

function resolveItemEntryList<T extends { id: number; Name: string; Rarity: number }>(
  cfg: AllowDenyConfig | undefined,
  universe: readonly T[],
  fallbackDefault: 'allow' | 'deny',
  context: string
): ResolvedList<T> {
  const lookup = new Map<string, T>();
  for (const e of universe) {
    const n = normalize(e.Name);
    if (!lookup.has(n)) lookup.set(n, e);
  }

  const defaultVal = cfg?.default ?? fallbackDefault;
  if (defaultVal !== 'allow' && defaultVal !== 'deny') {
    throw new Error(`"default" must be "allow" or "deny" (${context}).`);
  }

  const allowed = new Map<number, T>();
  if (defaultVal === 'allow') {
    for (const e of universe) allowed.set(e.id, e);
  }
  for (const sel of cfg?.deny ?? []) {
    for (const e of matchItemEntrySelector(sel, universe, lookup, context)) allowed.delete(e.id);
  }
  for (const sel of cfg?.allow ?? []) {
    for (const e of matchItemEntrySelector(sel, universe, lookup, context)) allowed.set(e.id, e);
  }

  return finalizeList(allowed, universe, (e) => e.id, (e) => e.Name);
}

export interface ItemTypeResult {
  type: ItemType;
  variants: ResolvedList<ItemVariant>;
  addons: ResolvedList<ItemTypeAddon>;
  /** How many of this item a survivor may bring (`items.<Type>.count`), metadata only. */
  count?: number;
  /** How many add-on slots this item has (`items.<Type>.addons.count`), metadata only. */
  addonCount?: number;
}

/**
 * Resolve allowed item variants + add-ons for every item type, mirroring
 * item-sheet-generator.js's per-type resolution:
 *   - a type's variant `default` falls back to the YAML's top-level `default`
 *     (itself defaulting to 'deny' when omitted);
 *   - a type's add-on `default` falls back to that *resolved* variant default.
 * @param itemsConfig - the `items:` block, keyed by item-type name (e.g. "Med-Kit")
 * @param topDefault - the YAML's top-level `default` (doc.default), 'deny' if absent
 * @param context - human-readable label for error messages
 */
export function resolveItems(
  itemsConfig: ItemsConfig | undefined,
  topDefault: 'allow' | 'deny' = 'deny',
  context = 'items'
): ItemTypeResult[] {
  const cfg = itemsConfig ?? {};

  for (const key of Object.keys(cfg)) {
    if (!itemTypes.some((t) => normalize(t.Name) === normalize(key))) {
      throw new Error(`Unknown item type "${key}" (${context}).`);
    }
  }

  // Only resolve item types the YAML actually configures under `items:` —
  // types absent from the config are out of scope for this build, not
  // "everything banned" noise to render.
  const configuredTypes = itemTypes.filter((type) =>
    Object.keys(cfg).some((key) => normalize(key) === normalize(type.Name))
  );

  return configuredTypes.map((type) => {
    let typeCfg: ItemsConfig[string] | undefined;
    for (const [key, val] of Object.entries(cfg)) {
      if (normalize(key) === normalize(type.Name)) {
        typeCfg = val;
        break;
      }
    }

    const variantUniverse = itemVariants.filter((v) => v.Type === type.Name);
    const typeDefault = typeCfg?.default ?? topDefault;

    const variants = resolveItemEntryList(
      typeCfg,
      variantUniverse,
      topDefault,
      `${type.Name} variant (${context})`
    );
    const addons = resolveItemEntryList(
      typeCfg?.addons,
      type.Addons,
      typeDefault,
      `${type.Name} add-on (${context})`
    );

    return { type, variants, addons, count: typeCfg?.count, addonCount: typeCfg?.addons?.count };
  });
}
