#!/usr/bin/env node
'use strict';

/**
 * check-dbd-data.mjs
 *
 * Validator for the project-owned, slug-keyed DBD data files
 * (src/data/dbd/{perks,addons,items,maps,offerings}.json) against the
 * translation files (src/data/dbd/i18n/<stem>.<lang>.json), against internal
 * invariants, and against src/data/balancing/map-offerings.yaml, the shared
 * table of required offerings per map.
 *
 * There is no vendored/upstream data and no separate slug registry anymore —
 * the owned files ARE the source of truth, keyed by frozen slug. This script
 * checks that the owned data and the translations agree, that the owned
 * data itself is internally consistent (no ambiguous add-on slugs, no perk
 * alias/abbreviation that collides with another perk's canonical name), and
 * that map-offerings.yaml — the authority the per-killer balancing pages
 * lean on for loadout validity — only ever names maps and offerings that
 * actually exist, with assets that actually ship.
 *
 * Runs seven checks:
 *   A. Every translation key is a known slug/identity in the corresponding
 *      owned data file (perks, addons, items, maps, offerings).
 *   B. Item add-on slugs (the nested-map key under each item type) are
 *      globally unique across all item types — required because translation
 *      keys are synthesized as `addon/<slug>` without the owning type.
 *   C. No perk alias/abbreviation collides with (shadows) another perk's
 *      canonical name, and no two perks share the same normalized
 *      alias/abbreviation.
 *   D. No killer alias collides with (shadows) another killer's canonical
 *      name, and no two killers share the same normalized alias.
 *   E. No map alias/abbreviation collides with (shadows) another map's
 *      canonical name, and no two maps share the same normalized
 *      alias/abbreviation.
 *   F. No offering alias/abbreviation collides with (shadows) another
 *      offering's canonical name, and no two offerings share the same
 *      normalized alias/abbreviation.
 *   G. map-offerings.yaml integrity: every `maps:` key resolves to exactly
 *      one maps.json entry (no unknown keys, no two keys resolving to the
 *      same map), every offering it names resolves to an offerings.json
 *      entry that ships an `image` asset actually present on disk under
 *      public/, every `count` is a positive integer when present, and every
 *      map named by a `<killer>-conditions.yaml` file across the site has an
 *      entry here (exhaustiveness — a map with no declared required
 *      offerings would otherwise silently render none).
 *
 * Exits 0 when all checks pass, non-zero otherwise.
 *
 * Usage:
 *   node scripts/check-dbd-data.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { normalize } from '../src/lib/balancing/normalize.ts';

const DATA_DIR = path.resolve('src/data/dbd');
const I18N_DIR = path.join(DATA_DIR, 'i18n');
const BALANCING_DIR = path.resolve('src/data/balancing');
const PUBLIC_DIR = path.resolve('public');

const STEMS = ['perks', 'addons', 'items', 'maps', 'offerings'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ---------------------------------------------------------------------------
// Translation file discovery (mirrors the old seed/check scripts, minus the
// now-deleted slugs/ subdirectory to skip).
// ---------------------------------------------------------------------------

function findTranslationFiles() {
  const found = [];
  for (const entry of fs.readdirSync(I18N_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const parts = entry.name.split('.');
    if (parts.length !== 3) continue;
    const [stem, lang, ext] = parts;
    if (ext !== 'json' || !lang) continue;
    if (!STEMS.includes(stem)) continue;
    found.push({ stem, lang, filePath: path.join(I18N_DIR, entry.name) });
  }
  found.sort((a, b) => (a.stem === b.stem ? a.lang.localeCompare(b.lang) : a.stem.localeCompare(b.stem)));
  return found;
}

// ---------------------------------------------------------------------------
// Check A: translation keys are valid identities in the owned data.
// ---------------------------------------------------------------------------

function checkTranslationKeys(files, perks, addons, items, maps, offerings) {
  const failures = [];

  const itemIdentities = new Set();
  for (const typeSlug of Object.keys(items.types)) {
    itemIdentities.add(`type/${typeSlug}`);
    for (const addonSlug of Object.keys(items.types[typeSlug].addons ?? {})) {
      itemIdentities.add(`addon/${addonSlug}`);
    }
  }
  for (const variantSlug of Object.keys(items.variants)) {
    itemIdentities.add(`variant/${variantSlug}`);
  }

  const validSets = {
    perks: new Set(Object.keys(perks)),
    addons: new Set(Object.keys(addons)),
    items: itemIdentities,
    maps: new Set(Object.keys(maps)),
    offerings: new Set(Object.keys(offerings)),
  };

  for (const { stem, filePath } of files) {
    const translations = readJson(filePath);
    const relPath = path.relative(process.cwd(), filePath);
    const validSet = validSets[stem];
    for (const key of Object.keys(translations)) {
      if (!validSet.has(key)) {
        failures.push(`${relPath}: "${key}"`);
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check B: item add-on slugs are globally unique across all item types.
// ---------------------------------------------------------------------------

function checkItemAddonSlugUniqueness(items) {
  const failures = [];
  const typesBySlug = new Map(); // addonSlug -> [typeSlug, ...]

  for (const [typeSlug, type] of Object.entries(items.types)) {
    for (const addonSlug of Object.keys(type.addons ?? {})) {
      if (!typesBySlug.has(addonSlug)) typesBySlug.set(addonSlug, []);
      typesBySlug.get(addonSlug).push(typeSlug);
    }
  }

  for (const [addonSlug, typeSlugs] of typesBySlug.entries()) {
    if (typeSlugs.length > 1) {
      failures.push(`add-on slug "${addonSlug}" appears under types: ${typeSlugs.join(', ')}`);
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check C: perk alias/abbreviation collisions.
// ---------------------------------------------------------------------------

function checkPerkAliasCollisions(perks) {
  const failures = [];

  // canonicalByNorm: normalize(perk name) -> slug
  const canonicalByNorm = new Map();
  for (const [slug, entry] of Object.entries(perks)) {
    canonicalByNorm.set(normalize(entry.name), slug);
  }

  // aliasOwner: normalize(alias/abbrev) -> slug of the first perk that declared it
  const aliasOwner = new Map();

  for (const [slug, entry] of Object.entries(perks)) {
    const aliasForms = [...(entry.aliases ?? []), ...(entry.abbreviations ?? [])];
    for (const alias of aliasForms) {
      const na = normalize(alias);

      // Shadowing: this alias normalizes to another perk's canonical name.
      const canonicalOwner = canonicalByNorm.get(na);
      if (canonicalOwner && canonicalOwner !== slug) {
        failures.push(
          `perk "${slug}" alias "${alias}" collides with perk "${canonicalOwner}"'s canonical name`
        );
      }

      // Ambiguity: two different perks declare the same normalized alias.
      const existingOwner = aliasOwner.get(na);
      if (existingOwner && existingOwner !== slug) {
        failures.push(
          `alias "${alias}" (normalized "${na}") declared by both perk "${existingOwner}" and perk "${slug}"`
        );
      } else if (!existingOwner) {
        aliasOwner.set(na, slug);
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check D: killer alias collisions.
// ---------------------------------------------------------------------------

function checkKillerAliasCollisions(killers) {
  const failures = [];

  // canonicalByNorm: normalize(killer name) -> slug
  const canonicalByNorm = new Map();
  for (const [slug, entry] of Object.entries(killers)) {
    canonicalByNorm.set(normalize(entry.name), slug);
  }

  // aliasOwner: normalize(alias) -> slug of the first killer that declared it
  const aliasOwner = new Map();

  for (const [slug, entry] of Object.entries(killers)) {
    for (const alias of entry.aliases ?? []) {
      const na = normalize(alias);

      // Shadowing: this alias normalizes to another killer's canonical name.
      const canonicalOwner = canonicalByNorm.get(na);
      if (canonicalOwner && canonicalOwner !== slug) {
        failures.push(
          `killer "${slug}" alias "${alias}" collides with killer "${canonicalOwner}"'s canonical name`
        );
      }

      // Ambiguity: two different killers declare the same normalized alias.
      const existingOwner = aliasOwner.get(na);
      if (existingOwner && existingOwner !== slug) {
        failures.push(
          `alias "${alias}" (normalized "${na}") declared by both killer "${existingOwner}" and killer "${slug}"`
        );
      } else if (!existingOwner) {
        aliasOwner.set(na, slug);
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check E: map alias/abbreviation collisions.
// ---------------------------------------------------------------------------

function checkMapAliasCollisions(maps) {
  const failures = [];

  // canonicalByNorm: normalize(map name) -> slug
  const canonicalByNorm = new Map();
  for (const [slug, entry] of Object.entries(maps)) {
    canonicalByNorm.set(normalize(entry.name), slug);
  }

  // aliasOwner: normalize(alias/abbrev) -> slug of the first map that declared it
  const aliasOwner = new Map();

  for (const [slug, entry] of Object.entries(maps)) {
    const aliasForms = [...(entry.aliases ?? []), ...(entry.abbreviations ?? [])];
    for (const alias of aliasForms) {
      const na = normalize(alias);

      // Shadowing: this alias normalizes to another map's canonical name.
      const canonicalOwner = canonicalByNorm.get(na);
      if (canonicalOwner && canonicalOwner !== slug) {
        failures.push(
          `map "${slug}" alias "${alias}" collides with map "${canonicalOwner}"'s canonical name`
        );
      }

      // Ambiguity: two different maps declare the same normalized alias.
      const existingOwner = aliasOwner.get(na);
      if (existingOwner && existingOwner !== slug) {
        failures.push(
          `alias "${alias}" (normalized "${na}") declared by both map "${existingOwner}" and map "${slug}"`
        );
      } else if (!existingOwner) {
        aliasOwner.set(na, slug);
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check F: offering alias/abbreviation collisions.
// ---------------------------------------------------------------------------

function checkOfferingAliasCollisions(offerings) {
  const failures = [];

  // canonicalByNorm: normalize(offering name) -> slug
  const canonicalByNorm = new Map();
  for (const [slug, entry] of Object.entries(offerings)) {
    canonicalByNorm.set(normalize(entry.name), slug);
  }

  // aliasOwner: normalize(alias/abbrev) -> slug of the first offering that declared it
  const aliasOwner = new Map();

  for (const [slug, entry] of Object.entries(offerings)) {
    const aliasForms = [...(entry.aliases ?? []), ...(entry.abbreviations ?? [])];
    for (const alias of aliasForms) {
      const na = normalize(alias);

      // Shadowing: this alias normalizes to another offering's canonical name.
      const canonicalOwner = canonicalByNorm.get(na);
      if (canonicalOwner && canonicalOwner !== slug) {
        failures.push(
          `offering "${slug}" alias "${alias}" collides with offering "${canonicalOwner}"'s canonical name`
        );
      }

      // Ambiguity: two different offerings declare the same normalized alias.
      const existingOwner = aliasOwner.get(na);
      if (existingOwner && existingOwner !== slug) {
        failures.push(
          `alias "${alias}" (normalized "${na}") declared by both offering "${existingOwner}" and offering "${slug}"`
        );
      } else if (!existingOwner) {
        aliasOwner.set(na, slug);
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check G: map-offerings.yaml integrity.
// ---------------------------------------------------------------------------

/** Recursively find src/data/balancing/*\/*\/*-conditions.yaml files (format/killer/file). */
function findConditionsFiles() {
  const found = [];
  if (!fs.existsSync(BALANCING_DIR)) return found;

  for (const formatEntry of fs.readdirSync(BALANCING_DIR, { withFileTypes: true })) {
    if (!formatEntry.isDirectory()) continue;
    const formatPath = path.join(BALANCING_DIR, formatEntry.name);

    for (const killerEntry of fs.readdirSync(formatPath, { withFileTypes: true })) {
      if (!killerEntry.isDirectory()) continue;
      const killerPath = path.join(formatPath, killerEntry.name);

      for (const fileEntry of fs.readdirSync(killerPath, { withFileTypes: true })) {
        if (!fileEntry.isFile() || !fileEntry.name.endsWith('-conditions.yaml')) continue;
        const filePath = path.join(killerPath, fileEntry.name);
        found.push({ filePath, relPath: path.relative(process.cwd(), filePath) });
      }
    }
  }

  found.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return found;
}

/** Build normalize(name) -> slug lookups for a maps.json/offerings.json-shaped data file, canonical names and aliases/abbreviations separately (canonical wins on lookup). */
function buildNameLookups(data) {
  const canonicalByNorm = new Map();
  for (const [slug, entry] of Object.entries(data)) {
    canonicalByNorm.set(normalize(entry.name), slug);
  }

  const aliasByNorm = new Map();
  for (const [slug, entry] of Object.entries(data)) {
    const aliasForms = [...(entry.aliases ?? []), ...(entry.abbreviations ?? [])];
    for (const alias of aliasForms) {
      const na = normalize(alias);
      if (!aliasByNorm.has(na)) aliasByNorm.set(na, slug);
    }
  }

  return (name) => canonicalByNorm.get(normalize(name)) ?? aliasByNorm.get(normalize(name)) ?? null;
}

function checkMapOfferingsIntegrity(mapOfferingsDoc, maps, offerings) {
  const failures = [];

  const rawMaps = mapOfferingsDoc?.maps;
  if (!rawMaps || typeof rawMaps !== 'object' || Object.keys(rawMaps).length === 0) {
    failures.push('map-offerings.yaml has no "maps:" entries (missing or empty top-level "maps:" key)');
    return failures;
  }

  const resolveMapSlug = buildNameLookups(maps);
  const resolveOfferingSlug = buildNameLookups(offerings);

  const declaredMapSlugs = new Set();

  for (const [key, set] of Object.entries(rawMaps)) {
    const mapSlug = resolveMapSlug(key);
    if (!mapSlug) {
      failures.push(`map-offerings.yaml: key "${key}" does not resolve to any entry in maps.json`);
      continue;
    }
    if (declaredMapSlugs.has(mapSlug)) {
      failures.push(
        `map-offerings.yaml: key "${key}" resolves to map "${maps[mapSlug].name}", which is already declared under another key`
      );
      continue;
    }
    declaredMapSlugs.add(mapSlug);

    for (const side of ['killer', 'survivor']) {
      const entries = set?.[side] ?? [];
      for (const entry of entries) {
        const isObjectEntry = entry !== null && typeof entry === 'object' && !Array.isArray(entry);
        const name = isObjectEntry ? entry.name : entry;
        const hasCount = isObjectEntry && Object.prototype.hasOwnProperty.call(entry, 'count');
        const count = hasCount ? entry.count : undefined;

        if (!name || typeof name !== 'string') {
          failures.push(`map-offerings.yaml: map "${key}" (${side}) has an entry with no offering name`);
          continue;
        }

        const offeringSlug = resolveOfferingSlug(name);
        if (!offeringSlug) {
          failures.push(
            `map-offerings.yaml: map "${key}" (${side}) references offering "${name}", which does not resolve to any entry in offerings.json`
          );
        } else {
          const offeringEntry = offerings[offeringSlug];
          if (!offeringEntry.image) {
            failures.push(
              `map-offerings.yaml: offering "${name}" (map "${key}", ${side}) has no "image" in offerings.json`
            );
          } else {
            const assetPath = path.join(PUBLIC_DIR, offeringEntry.image.replace(/^\//, ''));
            if (!fs.existsSync(assetPath)) {
              failures.push(
                `map-offerings.yaml: offering "${name}" (map "${key}", ${side}) has image "${offeringEntry.image}" which does not exist on disk (expected at ${path.relative(process.cwd(), assetPath)})`
              );
            }
          }
        }

        if (hasCount && (!Number.isInteger(count) || count < 1)) {
          failures.push(
            `map-offerings.yaml: map "${key}" (${side}) offering "${name}" has invalid count ${JSON.stringify(count)} (must be a positive integer)`
          );
        }
      }
    }
  }

  // Exhaustiveness: every map named by a <killer>-conditions.yaml must have an entry here.
  for (const { filePath, relPath } of findConditionsFiles()) {
    const conditions = parse(fs.readFileSync(filePath, 'utf8'));
    const mapName = conditions?.map;
    if (!mapName) continue;

    const mapSlug = resolveMapSlug(mapName);
    if (!mapSlug || !declaredMapSlugs.has(mapSlug)) {
      failures.push(`${relPath}: map "${mapName}" has no entry in map-offerings.yaml`);
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const perks = readJson(path.join(DATA_DIR, 'perks.json'));
  const addons = readJson(path.join(DATA_DIR, 'addons.json'));
  const items = readJson(path.join(DATA_DIR, 'items.json'));
  const killers = readJson(path.join(DATA_DIR, 'killers.json'));
  const maps = readJson(path.join(DATA_DIR, 'maps.json'));
  const offerings = readJson(path.join(DATA_DIR, 'offerings.json'));
  const mapOfferingsDoc = parse(fs.readFileSync(path.join(BALANCING_DIR, 'map-offerings.yaml'), 'utf8'));

  const translationFiles = findTranslationFiles();

  const checks = [
    {
      name: 'Check A: translation keys are valid slugs',
      failures: checkTranslationKeys(translationFiles, perks, addons, items, maps, offerings),
    },
    {
      name: 'Check B: item add-on slug global uniqueness',
      failures: checkItemAddonSlugUniqueness(items),
    },
    {
      name: 'Check C: perk alias/abbreviation collisions',
      failures: checkPerkAliasCollisions(perks),
    },
    {
      name: 'Check D: killer alias collisions',
      failures: checkKillerAliasCollisions(killers),
    },
    {
      name: 'Check E: map alias collisions',
      failures: checkMapAliasCollisions(maps),
    },
    {
      name: 'Check F: offering alias/abbreviation collisions',
      failures: checkOfferingAliasCollisions(offerings),
    },
    {
      name: 'Check G: map-offerings.yaml integrity',
      failures: checkMapOfferingsIntegrity(mapOfferingsDoc, maps, offerings),
    },
  ];

  console.log('DBD data validation');
  console.log('====================');
  for (const { name, failures } of checks) {
    console.log(`${name}: ${failures.length === 0 ? 'PASS' : `FAIL (${failures.length})`}`);
  }

  const failingChecks = checks.filter((c) => c.failures.length > 0);

  if (failingChecks.length === 0) {
    console.log(`\nAll ${checks.length} checks passed.`);
    process.exit(0);
  }

  console.log('\nDetails:');
  for (const { name, failures } of failingChecks) {
    console.log(`\n${name} (${failures.length}):`);
    for (const failure of failures) {
      console.log(`  ${failure}`);
    }
  }

  console.log(`\n${failingChecks.length}/${checks.length} check(s) failed. See details above.`);
  process.exit(1);
}

main();
