// Shapes of the vendored DBD universe snapshots (src/data/dbd/*.json) and of
// the `-build.yaml` allow/deny config blocks. See scripts/sync-dbd-data.mjs
// for how the JSON snapshots are produced.

export interface Perk {
  id: number;
  name: string;
  icon: string;
  exhaustion: boolean;
  tags: string[];
  character: string;
  survivorPerk: boolean;
  aliases?: string | string[];
  dateAdded?: string;
}

export interface Addon {
  id: number;
  globalID: number;
  addonIcon: string;
  Name: string;
  Rarity: number;
}

export interface KillerAddons {
  Name: string;
  Addons: Addon[];
}

export interface ItemType {
  id: number;
  Name: string;
  Addons: ItemTypeAddon[];
}

export interface ItemTypeAddon {
  id: number;
  Name: string;
  Rarity: number;
  icon: string;
}

export interface ItemVariant {
  id: number;
  Name: string;
  Type: string;
  Rarity: number;
  icon: string;
}

export interface ItemsData {
  ItemTypes: ItemType[];
  Items: ItemVariant[];
}

export interface KillerEntry {
  ID: number;
  Name: string;
  Aliases: string[];
  [key: string]: unknown;
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
