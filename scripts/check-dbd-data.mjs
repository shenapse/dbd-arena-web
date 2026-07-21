#!/usr/bin/env node
'use strict';

/**
 * check-dbd-data.mjs
 *
 * Validator for the project-owned, slug-keyed DBD data files
 * (src/data/dbd/{perks,addons,items}.json) against the translation files
 * (src/data/dbd/i18n/<stem>.<lang>.json) and internal invariants.
 *
 * There is no vendored/upstream data and no separate slug registry anymore —
 * the owned files ARE the source of truth, keyed by frozen slug. This script
 * checks that the owned data and the translations agree, and that the owned
 * data itself is internally consistent (no ambiguous add-on slugs, no perk
 * alias/abbreviation that collides with another perk's canonical name).
 *
 * Runs four checks:
 *   A. Every translation key is a known slug/identity in the corresponding
 *      owned data file.
 *   B. Item add-on slugs (the nested-map key under each item type) are
 *      globally unique across all item types — required because translation
 *      keys are synthesized as `addon/<slug>` without the owning type.
 *   C. No perk alias/abbreviation collides with (shadows) another perk's
 *      canonical name, and no two perks share the same normalized
 *      alias/abbreviation.
 *   D. No killer alias collides with (shadows) another killer's canonical
 *      name, and no two killers share the same normalized alias.
 *
 * Exits 0 when all checks pass, non-zero otherwise.
 *
 * Usage:
 *   node scripts/check-dbd-data.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { normalize } from '../src/lib/balancing/normalize.ts';

const DATA_DIR = path.resolve('src/data/dbd');
const I18N_DIR = path.join(DATA_DIR, 'i18n');

const STEMS = ['perks', 'addons', 'items'];

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

function checkTranslationKeys(files, perks, addons, items) {
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
// Main
// ---------------------------------------------------------------------------

function main() {
  const perks = readJson(path.join(DATA_DIR, 'perks.json'));
  const addons = readJson(path.join(DATA_DIR, 'addons.json'));
  const items = readJson(path.join(DATA_DIR, 'items.json'));
  const killers = readJson(path.join(DATA_DIR, 'killers.json'));

  const translationFiles = findTranslationFiles();

  const checks = [
    {
      name: 'Check A: translation keys are valid slugs',
      failures: checkTranslationKeys(translationFiles, perks, addons, items),
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
