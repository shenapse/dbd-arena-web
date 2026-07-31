// Shared fs read + YAML parse for src/data/balancing/map-offerings.yaml, the
// single shared table of which offerings are required per map, split by
// killer/survivor side. Modeled on load-conditions.ts.
//
// The file path is built as `src/data/balancing/map-offerings.yaml`, resolved
// under the project root via process.cwd() (the project root under both
// `astro dev` and `astro build`).
//
// Note: unlike import.meta.glob, an fs read is not in Vite's watched module
// graph, so editing the YAML during `astro dev` needs a dev-server restart to
// show.
//
// The parsed YAML is indexed once (lazily, on first call) by resolved map
// slug rather than by the raw authored key, so callers can look a map up by
// any of its maps.json aliases/abbreviations, not just the exact string
// authored in map-offerings.yaml.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { resolveMap, resolveOffering } from './resolve';
import type {
  MapOfferings,
  MapOfferingSet,
  RequiredOfferingEntry,
  ResolvedMapOfferings,
  ResolvedOffering,
} from './types';

function buildPath(): string {
  return path.join(process.cwd(), 'src/data/balancing/map-offerings.yaml');
}

let index: Map<string, MapOfferingSet> | null = null;

/** Parse map-offerings.yaml and index it by resolved map slug. Memoized. */
function loadIndex(): Map<string, MapOfferingSet> {
  if (index) return index;

  const filePath = buildPath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`resolveMapOfferings: YAML not found at "${filePath}".`);
  }
  const doc = parse(fs.readFileSync(filePath, 'utf8')) as MapOfferings;

  const built = new Map<string, MapOfferingSet>();
  for (const [key, set] of Object.entries(doc.maps ?? {})) {
    const map = resolveMap(key, `map-offerings.yaml key "${key}"`);
    if (built.has(map.slug)) {
      throw new Error(
        `Duplicate required-offering entry for map "${map.name}" in map-offerings.yaml: ` +
          `key "${key}" resolves to a map already declared under another key.`
      );
    }
    built.set(map.slug, set);
  }

  index = built;
  return built;
}

/** A normalized required-offering entry: `count` is always a concrete number, never optional — normalization is the boundary where that invariant becomes real. */
type NormalizedEntry = { name: string; count: number };

/** Normalize one authored entry (bare name or `{ name, count }`) to `{ name, count }`, count defaulting to 1. */
function normalizeEntry(entry: RequiredOfferingEntry, mapName: string, side: 'killer' | 'survivor'): NormalizedEntry {
  if (typeof entry === 'string') {
    return { name: entry, count: 1 };
  }
  if (typeof entry.name !== 'string') {
    // YAML parses `- Shroud of Union: 2` as { "Shroud of Union": 2 } instead
    // of { name: "Shroud of Union", count: 2 } — a very natural mistake,
    // since the header comment advertises the object form. Mirror
    // matchPerkSelector's reconstruction in resolve.ts: when the shape is
    // exactly this one-key/numeric-value trap, name the fix explicitly.
    //
    // `entry`'s declared type is RequiredOffering (the intended authored
    // shape) — routing through `unknown` is honest here because this branch
    // exists precisely for the case where the parsed YAML did NOT match that
    // shape.
    const raw = entry as unknown as Record<string, unknown>;
    const keys = Object.keys(raw);
    if (keys.length === 1 && typeof raw[keys[0]!] === 'number') {
      const key = keys[0]!;
      throw new Error(
        `Invalid required-offering entry ${JSON.stringify(entry)} on the ${side} side of map "${mapName}" ` +
          `in map-offerings.yaml — did you mean "- { name: ${key}, count: ${raw[key]} }"?`
      );
    }
    throw new Error(
      `Invalid required-offering entry ${JSON.stringify(entry)} on the ${side} side of map "${mapName}" in ` +
        `map-offerings.yaml. Expected a bare offering name or { name, count }.`
    );
  }
  const count = entry.count ?? 1;
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(
      `Invalid count ${JSON.stringify(entry.count)} for offering "${entry.name}" on the ${side} side of map ` +
        `"${mapName}" in map-offerings.yaml. "count" must be a positive integer.`
    );
  }
  return { name: entry.name, count };
}

function resolveSide(
  entries: RequiredOfferingEntry[] | undefined,
  mapName: string,
  side: 'killer' | 'survivor',
  context: string
): ResolvedOffering[] {
  return (entries ?? []).map((raw) => {
    const { name, count } = normalizeEntry(raw, mapName, side);
    const offering = resolveOffering(name, `${side} required offering for map "${mapName}" (${context})`);
    return { offering, count };
  });
}

/**
 * Resolve a map's required offerings (both sides) from map-offerings.yaml.
 * A missing/misspelled map name is a caller mistake and throws; a map with no
 * entry in map-offerings.yaml is a build error by design (see the file's
 * header comment) and also throws.
 */
export function resolveMapOfferings(mapName: string, context: string): ResolvedMapOfferings {
  const map = resolveMap(mapName, context);
  const set = loadIndex().get(map.slug);
  if (!set) {
    throw new Error(
      `No required-offering entry for map "${map.name}" (${context}). ` +
        `Add it to src/data/balancing/map-offerings.yaml.`
    );
  }
  return {
    killer: resolveSide(set.killer, map.name, 'killer', context),
    survivor: resolveSide(set.survivor, map.name, 'survivor', context),
  };
}
