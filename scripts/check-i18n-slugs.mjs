#!/usr/bin/env node
'use strict';

/**
 * check-i18n-slugs.mjs
 *
 * Drift detector for the repo-owned, frozen i18n slug registries
 * (src/data/dbd/i18n/slugs/{perks,addons,items}.json) against the vendored
 * English data (src/data/dbd/{perks,addons,items}.json) and the translation
 * files (src/data/dbd/i18n/<stem>.<lang>.json).
 *
 * The slug is a frozen join key — it never changes once seeded (see
 * scripts/seed-i18n-slugs.mjs). On an upstream rename, only the registry's
 * `name` (and `killer`/`kind`) fields are updated; the slug itself stays put.
 * So "drift" here means: the vendored data and the registry disagree about
 * what English identity currently exists.
 *
 * Runs three checks:
 *   1. Vendored entry missing from registry (addition, or a rename's new name)
 *   2. Registry slug orphaned (removal, or a rename's old name)
 *   3. Stale translation key (key that is not a known registry slug)
 *
 * Exits 0 when all three checks pass, non-zero otherwise.
 *
 * Usage:
 *   node scripts/check-i18n-slugs.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { normalize } from '../src/lib/balancing/normalize.ts';

const DATA_DIR = path.resolve('src/data/dbd');
const I18N_DIR = path.join(DATA_DIR, 'i18n');
const SLUGS_DIR = path.join(I18N_DIR, 'slugs');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ---------------------------------------------------------------------------
// Vendored-data identity extraction
//
// Each entry is described by { key, label } where `key` is the
// normalize()-based identity used to join against the registry, and `label`
// is a human-readable description for reporting.
// ---------------------------------------------------------------------------

function vendoredPerkEntries(perks) {
  return perks.map((perk) => ({
    key: normalize(perk.name),
    label: `perk "${perk.name}"`,
  }));
}

function vendoredAddonEntries(addonGroups) {
  const entries = [];
  for (const killer of addonGroups) {
    for (const addon of killer.Addons ?? []) {
      entries.push({
        key: `${normalize(killer.Name)} ${normalize(addon.Name)}`,
        label: `addon "${addon.Name}" (${killer.Name})`,
      });
    }
  }
  return entries;
}

function vendoredItemEntries(items) {
  const entries = [];
  for (const type of items.ItemTypes ?? []) {
    entries.push({
      key: `type ${normalize(type.Name)}`,
      label: `item "${type.Name}" kind=type`,
    });
    for (const addon of type.Addons ?? []) {
      entries.push({
        key: `addon ${normalize(addon.Name)}`,
        label: `item "${addon.Name}" kind=addon`,
      });
    }
  }
  for (const item of items.Items ?? []) {
    entries.push({
      key: `variant ${normalize(item.Name)}`,
      label: `item "${item.Name}" kind=variant`,
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Registry identity extraction (inverse map: identity key -> slug)
// ---------------------------------------------------------------------------

function registryPerkKey(entry) {
  return normalize(entry.name);
}

function registryAddonKey(entry) {
  return `${normalize(entry.killer)} ${normalize(entry.name)}`;
}

function registryItemKey(entry) {
  return `${entry.kind} ${normalize(entry.name)}`;
}

const DOMAINS = {
  perks: { registryKeyFn: registryPerkKey },
  addons: { registryKeyFn: registryAddonKey },
  items: { registryKeyFn: registryItemKey },
};

/**
 * Build identity-key -> slug list from a registry (a slug is 1:1 with an
 * identity key by construction, but we tolerate duplicates defensively).
 */
function buildRegistryKeyMap(registry, keyFn) {
  const map = new Map();
  for (const [slug, entry] of Object.entries(registry)) {
    const key = keyFn(entry);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(slug);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Translation file discovery (mirrors scripts/seed-i18n-slugs.mjs)
// ---------------------------------------------------------------------------

function findTranslationFiles() {
  const found = [];
  for (const entry of fs.readdirSync(I18N_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const parts = entry.name.split('.');
    if (parts.length !== 3) continue;
    const [stem, lang, ext] = parts;
    if (ext !== 'json' || !lang) continue;
    if (!Object.prototype.hasOwnProperty.call(DOMAINS, stem)) continue;
    found.push({ stem, lang, filePath: path.join(I18N_DIR, entry.name) });
  }
  found.sort((a, b) => (a.stem === b.stem ? a.lang.localeCompare(b.lang) : a.stem.localeCompare(b.stem)));
  return found;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/** Check 1: every vendored entry's identity key must exist in the registry. */
function checkMissingFromRegistry(domain, vendoredEntries, registryKeyMap) {
  const failures = [];
  for (const { key, label } of vendoredEntries) {
    if (!registryKeyMap.has(key)) failures.push(`${domain} ${label}`);
  }
  return failures;
}

/** Check 2: every registry entry's identity key must exist among vendored entries. */
function checkOrphanedSlugs(domain, registry, keyFn, vendoredKeySet) {
  const failures = [];
  for (const [slug, entry] of Object.entries(registry)) {
    const key = keyFn(entry);
    if (!vendoredKeySet.has(key)) {
      failures.push(`${domain} slug "${slug}" -> ${JSON.stringify(entry)}`);
    }
  }
  return failures;
}

/** Check 3: every translation key must be a known slug in the domain registry. */
function checkStaleTranslationKeys(files, registries) {
  const failures = [];
  for (const { stem, lang, filePath } of files) {
    const translations = readJson(filePath);
    const registry = registries[stem];
    const relPath = path.relative(process.cwd(), filePath);
    for (const key of Object.keys(translations)) {
      if (!Object.prototype.hasOwnProperty.call(registry, key)) {
        failures.push(`${relPath}: "${key}"`);
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
  const addonGroups = readJson(path.join(DATA_DIR, 'addons.json'));
  const items = readJson(path.join(DATA_DIR, 'items.json'));

  const registries = {
    perks: readJson(path.join(SLUGS_DIR, 'perks.json')),
    addons: readJson(path.join(SLUGS_DIR, 'addons.json')),
    items: readJson(path.join(SLUGS_DIR, 'items.json')),
  };

  const vendoredEntriesByDomain = {
    perks: vendoredPerkEntries(perks),
    addons: vendoredAddonEntries(addonGroups),
    items: vendoredItemEntries(items),
  };

  const missingFailures = [];
  const orphanFailures = [];

  for (const [domain, { registryKeyFn }] of Object.entries(DOMAINS)) {
    const vendoredEntries = vendoredEntriesByDomain[domain];
    const registry = registries[domain];

    const registryKeyMap = buildRegistryKeyMap(registry, registryKeyFn);
    missingFailures.push(...checkMissingFromRegistry(domain, vendoredEntries, registryKeyMap));

    const vendoredKeySet = new Set(vendoredEntries.map((e) => e.key));
    orphanFailures.push(...checkOrphanedSlugs(domain, registry, registryKeyFn, vendoredKeySet));
  }

  const translationFiles = findTranslationFiles();
  const staleFailures = checkStaleTranslationKeys(translationFiles, registries);

  const checks = [
    { name: 'Check 1: vendored entry missing from registry', failures: missingFailures },
    { name: 'Check 2: registry slug orphaned', failures: orphanFailures },
    { name: 'Check 3: stale translation key', failures: staleFailures },
  ];

  console.log('i18n slug drift check');
  console.log('======================');
  for (const { name, failures } of checks) {
    console.log(`${name}: ${failures.length === 0 ? 'PASS' : `FAIL (${failures.length})`}`);
  }

  const failingChecks = checks.filter((c) => c.failures.length > 0);

  if (failingChecks.length === 0) {
    console.log(`\nAll ${checks.length} checks passed — no drift detected.`);
    process.exit(0);
  }

  console.log('\nDetails:');
  for (const { name, failures } of failingChecks) {
    console.log(`\n${name} (${failures.length}):`);
    for (const failure of failures) {
      console.log(`  ${failure}`);
    }
  }

  console.log(
    `\n${failingChecks.length}/${checks.length} check(s) failed. See details above.`
  );
  process.exit(1);
}

main();
