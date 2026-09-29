// Shared fs read + YAML parse for the perk universe files in
// src/data/balancing/universes/<id>.yaml — named, reusable perk pools that a
// -build.yaml references through its `universe:` field. Modeled on
// load-map-offerings.ts.
//
// Paths are resolved under the project root via process.cwd() (the project
// root under both `astro dev` and `astro build`).
//
// Note: unlike import.meta.glob, an fs read is not in Vite's watched module
// graph, so editing a universe file during `astro dev` needs a dev-server
// restart to show.
//
// Each file is validated once (schema + every perk name) and cached per id.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { resolveUniverseNames, allSidePerks } from './resolve';
import type { BuildUniverseDecl, UniverseFile, UniverseSideDecl } from './types';

const UNIVERSE_KEYS = new Set(['name', 'description', 'killer', 'survivor']);

function universesDir(): string {
  return path.join(process.cwd(), 'src/data/balancing/universes');
}

/** Ids of every universe file present, sorted. */
function availableIds(): string[] {
  const dir = universesDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.slice(0, -'.yaml'.length))
    .sort();
}

const cache = new Map<string, Required<Pick<UniverseFile, 'killer' | 'survivor'>>>();

/** Validate one side of a universe file: `all`/missing => 'all', else a checked non-empty name list. */
function validateSide(
  raw: unknown,
  side: 'killer' | 'survivor',
  file: string
): UniverseSideDecl {
  const context = `${file}, ${side} side`;
  if (raw === undefined || raw === 'all') return 'all';
  if (!Array.isArray(raw)) {
    throw new Error(`Invalid "${side}" in ${file}: expected "all" or a list of perk names.`);
  }
  if (raw.length === 0) {
    throw new Error(`Empty "${side}" list in ${file}: use "all" or list at least one perk (omit the key for all).`);
  }
  resolveUniverseNames(raw, allSidePerks(side), context);
  return raw as string[];
}

/** Read, validate and cache universe file `<id>.yaml`. Both sides are always defined ('all' when omitted). */
export function loadUniverseFile(id: string): { killer: UniverseSideDecl; survivor: UniverseSideDecl } {
  const cached = cache.get(id);
  if (cached) return cached;

  const filePath = path.join(universesDir(), `${id}.yaml`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || !fs.existsSync(filePath)) {
    const ids = availableIds();
    throw new Error(
      `Unknown universe "${id}". Available universes: ${ids.length ? ids.join(', ') : '(none)'} ` +
        `(src/data/balancing/universes/<id>.yaml).`
    );
  }
  const file = `universes/${id}.yaml`;
  const doc = parse(fs.readFileSync(filePath, 'utf8')) as UniverseFile | null;
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error(`${file} must be a YAML mapping with optional keys: ${[...UNIVERSE_KEYS].join(', ')}.`);
  }
  for (const key of Object.keys(doc)) {
    if (!UNIVERSE_KEYS.has(key)) {
      throw new Error(`Unknown top-level key "${key}" in ${file}. Allowed keys: ${[...UNIVERSE_KEYS].join(', ')}.`);
    }
  }

  const result = {
    killer: validateSide(doc.killer, 'killer', file),
    survivor: validateSide(doc.survivor, 'survivor', file),
  };
  cache.set(id, result);
  return result;
}

/**
 * Expand a build's `universe:` field for one side to `'all'` or a perk-name
 * list, ready to pass to resolvePerks. Accepts omitted (all), a universe id
 * (both sides), or `{ killer?, survivor? }` where each is `all`, an id or an
 * inline list.
 */
export function resolveUniverseDecl(
  decl: BuildUniverseDecl | undefined,
  side: 'killer' | 'survivor',
  context: string
): UniverseSideDecl {
  if (decl === undefined || decl === null) return 'all';
  let sideDecl: string | string[] | undefined;
  if (typeof decl === 'string') {
    sideDecl = decl;
  } else if (typeof decl === 'object' && !Array.isArray(decl)) {
    for (const key of Object.keys(decl)) {
      if (key !== 'killer' && key !== 'survivor') {
        throw new Error(`Unknown key "${key}" in "universe" (${context}). Expected "killer" and/or "survivor".`);
      }
    }
    sideDecl = decl[side];
  } else {
    throw new Error(`"universe" must be a universe id or { killer, survivor } (${context}).`);
  }
  if (sideDecl === undefined || sideDecl === 'all') return 'all';
  if (Array.isArray(sideDecl)) return sideDecl; // inline list, validated by resolvePerks
  if (typeof sideDecl !== 'string') {
    throw new Error(`"universe.${side}" must be "all", a universe id or a perk-name list (${context}).`);
  }
  try {
    return loadUniverseFile(sideDecl)[side];
  } catch (e) {
    throw new Error(`${(e as Error).message} (universe.${side}, ${context})`);
  }
}
