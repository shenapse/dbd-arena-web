// Shapes of the project-owned DBD data files (src/data/dbd/*.json) and of
// the `-build.yaml` allow/deny config blocks. The data files are slug-keyed
// maps owned directly in this repo (no vendoring/sync) — the map key is the
// frozen slug identity, and `name` is the current English display name.

// ---------------------------------------------------------------------------
// perks.json — Record<slug, PerkEntry>
// ---------------------------------------------------------------------------

/** Raw shape of each value in perks.json, keyed by slug. */
export interface PerkEntry {
  name: string;
  survivorPerk: boolean;
  exhaustion?: boolean;
  aliases?: string[];
  abbreviations?: string[];
}

/** A perk resolved for use, carrying its slug (the perks.json map key) for dedup. */
export interface Perk extends PerkEntry {
  slug: string;
}

// ---------------------------------------------------------------------------
// killers.json — Record<slug, KillerEntry>
// ---------------------------------------------------------------------------

/** Raw shape of each value in killers.json, keyed by slug. */
export interface KillerEntry {
  name: string;
  aliases?: string[];
}

/** A killer resolved for use, carrying its slug (the killers.json map key). */
export interface Killer extends KillerEntry {
  slug: string;
}

// ---------------------------------------------------------------------------
// maps.json — Record<slug, MapEntry>
// ---------------------------------------------------------------------------

/** Raw shape of each value in maps.json, keyed by slug. */
export interface MapEntry {
  name: string;
  /** Slug tag grouping numbered competitive layout variants of one map (e.g. "coal-tower" for "Coal Tower 1"/"Coal Tower 2"). Pure grouping metadata — never a standalone entry, never resolved for display. */
  family?: string;
  aliases?: string[];
  abbreviations?: string[];
}

/** A map resolved for use, carrying its slug (the maps.json map key). */
export interface GameMap extends MapEntry {
  slug: string;
}

// ---------------------------------------------------------------------------
// addons.json — Record<compositeSlug, AddonEntry>
// ---------------------------------------------------------------------------

/** Raw shape of each value in addons.json, keyed by a `killer-slug/addon-slug` composite slug. */
export interface AddonEntry {
  name: string;
  /** English killer name (denormalized) — used to filter the universe by killer. */
  killer: string;
  rarity: number;
}

/** An add-on resolved for use, carrying its slug (the addons.json map key) for dedup. */
export interface Addon extends AddonEntry {
  slug: string;
}

// ---------------------------------------------------------------------------
// items.json — ItemsData = { types: Record<typeSlug, ...>, variants: Record<variantSlug, ...> }
// ---------------------------------------------------------------------------

/** Raw shape of an add-on nested under an item type in items.json. */
export interface ItemAddonEntry {
  name: string;
  rarity: number;
}

/** Raw shape of each value in items.json's `types` map. */
export interface ItemTypeEntry {
  name: string;
  addons: Record<string, ItemAddonEntry>;
}

/** Raw shape of each value in items.json's `variants` map. */
export interface ItemVariantEntry {
  name: string;
  /** Slug of the owning entry in items.json's `types` map. */
  type: string;
  rarity: number;
}

/** Raw shape of items.json as a whole. */
export interface ItemsData {
  types: Record<string, ItemTypeEntry>;
  variants: Record<string, ItemVariantEntry>;
}

/** A type-owned add-on resolved for use, carrying its slug (the nested `addons` map key). */
export interface ItemTypeAddon {
  slug: string;
  name: string;
  rarity: number;
}

/** An item type resolved for use, carrying its slug (the `types` map key) and its add-ons as an array. */
export interface ItemType {
  slug: string;
  name: string;
  addons: ItemTypeAddon[];
}

/** An item variant resolved for use, carrying its slug (the `variants` map key). */
export interface ItemVariant {
  slug: string;
  name: string;
  /** Slug of the owning item type. */
  type: string;
  rarity: number;
}

// ---------------------------------------------------------------------------
// YAML config shapes
// ---------------------------------------------------------------------------

/** A perk/add-on/item selector: a plain name, or a group selector object. */
export type Selector = string | Record<string, unknown>;

export interface AllowDenyConfig {
  default?: 'allow' | 'deny';
  allow?: Selector[];
  deny?: Selector[];
}

export interface ItemAddonsConfig extends AllowDenyConfig {
  /**
   * Metadata: number of add-on slots for this item type (e.g. "with 2 common
   * add-ons"). Read-and-passed-through only — never participates in
   * allow/deny resolution or selector matching.
   */
  count?: number;
}

export interface ItemTypeConfig extends AllowDenyConfig {
  /**
   * Metadata: how many of this item a survivor may bring (e.g. "1 firecracker").
   * Read-and-passed-through only — never participates in allow/deny resolution
   * or selector matching.
   */
  count?: number;
  addons?: ItemAddonsConfig;
}

export type ItemsConfig = Record<string, ItemTypeConfig>;

/** Result of resolving one side/universe: the allowed subset, its complement, and the full universe. */
export interface ResolvedList<T> {
  allowed: T[];
  banned: T[];
  universe: T[];
}

/** Display grouping for a resolved add-on list: fully-covered rarity tiers collapsed to summary lines, plus remaining individual names. */
export interface RarityDisplay {
  summaries: string[]; // e.g. ["All Common add-ons", "All Ultra Rare add-ons"]
  names: string[];     // remaining entries not collapsed, in the list's existing (alphabetical) order
}
