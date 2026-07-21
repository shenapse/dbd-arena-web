#!/usr/bin/env node
'use strict';

/**
 * seed-i18n-slugs.mjs
 *
 * Generates the repo-owned, frozen slug registries for perks/add-ons/items
 * (src/data/dbd/i18n/slugs/{perks,addons,items}.json) from the vendored
 * English data in src/data/dbd/, then re-keys the existing translation files
 * (src/data/dbd/i18n/{perks,addons,items}.ja.json) from English-name keys to
 * slug keys, in place.
 *
 * The slug is the stable join key between the English data and translation
 * files; it never changes once seeded. The registry's `name` field tracks the
 * *current* English name — it's the only thing a future upstream rename
 * should touch.
 *
 * Usage:
 *   node scripts/seed-i18n-slugs.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { slugify, normalize } from '../src/lib/balancing/normalize.ts';

const DATA_DIR = path.resolve('src/data/dbd');
const I18N_DIR = path.join(DATA_DIR, 'i18n');
const SLUGS_DIR = path.join(I18N_DIR, 'slugs');

function fatal(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** Pretty-print with keys sorted, for stable diffs. */
function writeSortedJson(filePath, obj) {
  const sorted = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
  fs.writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// Registry generation
// ---------------------------------------------------------------------------

function buildPerksRegistry(perks) {
  const registry = {};
  for (const perk of perks) {
    const slug = slugify(perk.name);
    registry[slug] = { name: perk.name };
  }
  return registry;
}

function buildAddonsRegistry(addonGroups) {
  const registry = {};
  const collisions = [];
  for (const killer of addonGroups) {
    const killerSlug = slugify(killer.Name);
    for (const addon of killer.Addons) {
      const slug = `${killerSlug}/${slugify(addon.Name)}`;
      if (Object.prototype.hasOwnProperty.call(registry, slug)) {
        collisions.push({ slug, name: addon.Name, killer: killer.Name });
      } else {
        registry[slug] = { name: addon.Name, killer: killer.Name };
      }
    }
  }
  if (collisions.length > 0) {
    fatal(
      `Add-on slug collisions detected:\n` +
        collisions.map((c) => `  ${c.slug} <- "${c.name}" (${c.killer})`).join('\n')
    );
  }
  return registry;
}

function buildItemsRegistry(items) {
  const registry = {};
  const seenByKind = { type: new Set(), variant: new Set(), addon: new Set() };
  const collisions = [];

  function add(kind, name) {
    const slug = slugify(name);
    const key = `${kind}/${slug}`;
    if (seenByKind[kind].has(slug)) {
      collisions.push({ key, kind, name });
      return;
    }
    seenByKind[kind].add(slug);
    registry[key] = { name, kind };
  }

  for (const type of items.ItemTypes) {
    add('type', type.Name);
    for (const addon of type.Addons ?? []) {
      add('addon', addon.Name);
    }
  }
  for (const item of items.Items) {
    add('variant', item.Name);
  }

  if (collisions.length > 0) {
    fatal(
      `Item slug collisions detected (same kind, same slug):\n` +
        collisions.map((c) => `  ${c.key} <- "${c.name}"`).join('\n')
    );
  }
  return registry;
}

// ---------------------------------------------------------------------------
// Re-key existing ja translation files
// ---------------------------------------------------------------------------

function rekeyPerksJa(jaMap, perksRegistry) {
  // slug -> name, for a normalize()-keyed reverse lookup (1:1 by spec).
  const byNormalizedName = new Map();
  for (const [slug, entry] of Object.entries(perksRegistry)) {
    byNormalizedName.set(normalize(entry.name), slug);
  }

  const rekeyed = {};
  let count = 0;
  const warnings = [];
  for (const [key, value] of Object.entries(jaMap)) {
    // Idempotency: a key that's already a valid registry slug is left as-is
    // (re-running the script on an already-rekeyed file is a no-op).
    if (Object.prototype.hasOwnProperty.call(perksRegistry, key)) {
      rekeyed[key] = value;
      count++;
      continue;
    }
    const slug = byNormalizedName.get(normalize(key));
    if (!slug) {
      warnings.push(`WARN: unknown perk "${key}" — skipping`);
      continue;
    }
    rekeyed[slug] = value;
    count++;
  }
  return { rekeyed, count, warnings };
}

function rekeyAddonsJa(jaMap, addonsRegistry) {
  // normalize(addon name) -> [slug, ...] across all killers.
  const byNormalizedName = new Map();
  for (const [slug, entry] of Object.entries(addonsRegistry)) {
    const key = normalize(entry.name);
    if (!byNormalizedName.has(key)) byNormalizedName.set(key, []);
    byNormalizedName.get(key).push(slug);
  }

  const rekeyed = {};
  let count = 0;
  const warnings = [];
  for (const [key, value] of Object.entries(jaMap)) {
    // Idempotency: a key that's already a valid registry slug is left as-is.
    if (Object.prototype.hasOwnProperty.call(addonsRegistry, key)) {
      rekeyed[key] = value;
      count++;
      continue;
    }
    const matches = byNormalizedName.get(normalize(key)) ?? [];
    if (matches.length === 0) {
      warnings.push(`WARN: unknown add-on "${key}" — skipping`);
      continue;
    }
    // A name shared by multiple killers (e.g. "Pocket Watch" on The Nurse and
    // The Dark Lord) is fanned out to every matching killer slug: only the
    // display *name* is localized here (never effects), and the translated
    // name is identical regardless of which killer it belongs to, so writing
    // it under every matching killer-slug/addon-slug is safe and loses
    // nothing (mirrors rekeyItemsJa's type/variant/addon fan-out).
    for (const matchKey of matches) {
      rekeyed[matchKey] = value;
      count++;
    }
  }
  return { rekeyed, count, warnings };
}

function rekeyItemsJa(jaMap, itemsRegistry) {
  // normalize(name) -> [kind/slug, ...] across type+variant+addon.
  const byNormalizedName = new Map();
  for (const [key, entry] of Object.entries(itemsRegistry)) {
    const nkey = normalize(entry.name);
    if (!byNormalizedName.has(nkey)) byNormalizedName.set(nkey, []);
    byNormalizedName.get(nkey).push(key);
  }

  const rekeyed = {};
  let count = 0;
  const warnings = [];
  for (const [key, value] of Object.entries(jaMap)) {
    // Idempotency: a key that's already a valid registry "kind/slug" is left
    // as-is (no re-fan-out on an already-rekeyed file).
    if (Object.prototype.hasOwnProperty.call(itemsRegistry, key)) {
      rekeyed[key] = value;
      count++;
      continue;
    }
    const matches = byNormalizedName.get(normalize(key)) ?? [];
    if (matches.length === 0) {
      warnings.push(`WARN: unknown item "${key}" — skipping`);
      continue;
    }
    for (const matchKey of matches) {
      rekeyed[matchKey] = value;
      count++;
    }
  }
  return { rekeyed, count, warnings };
}

// ---------------------------------------------------------------------------
// Translation file discovery
// ---------------------------------------------------------------------------

const REKEY_FNS = {
  perks: rekeyPerksJa,
  addons: rekeyAddonsJa,
  items: rekeyItemsJa,
};

/**
 * Find every `<stem>.<lang>.json` translation file directly under I18N_DIR,
 * where `stem` is one of perks/addons/items and `lang` is any locale (ja, ko,
 * future additions — no hardcoded list). Skips the `slugs/` registry
 * subdirectory and anything that doesn't match the `<stem>.<lang>.json` shape
 * (exactly three dot-separated segments, stem recognized, lang non-empty).
 */
function findTranslationFiles() {
  const found = [];
  for (const entry of fs.readdirSync(I18N_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const parts = entry.name.split('.');
    if (parts.length !== 3) continue;
    const [stem, lang, ext] = parts;
    if (ext !== 'json' || !lang) continue;
    if (!Object.prototype.hasOwnProperty.call(REKEY_FNS, stem)) continue;
    found.push({ stem, lang, filePath: path.join(I18N_DIR, entry.name) });
  }
  // Stable, deterministic order regardless of directory listing order.
  found.sort((a, b) => (a.stem === b.stem ? a.lang.localeCompare(b.lang) : a.stem.localeCompare(b.stem)));
  return found;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const perks = readJson(path.join(DATA_DIR, 'perks.json'));
  const addonGroups = readJson(path.join(DATA_DIR, 'addons.json'));
  const items = readJson(path.join(DATA_DIR, 'items.json'));

  const registries = {
    perks: buildPerksRegistry(perks),
    addons: buildAddonsRegistry(addonGroups),
    items: buildItemsRegistry(items),
  };

  fs.mkdirSync(SLUGS_DIR, { recursive: true });
  writeSortedJson(path.join(SLUGS_DIR, 'perks.json'), registries.perks);
  writeSortedJson(path.join(SLUGS_DIR, 'addons.json'), registries.addons);
  writeSortedJson(path.join(SLUGS_DIR, 'items.json'), registries.items);

  const files = findTranslationFiles();

  console.log('\nSummary:');
  console.log(
    `  registries: perks ${Object.keys(registries.perks).length}, addons ${Object.keys(registries.addons).length}, items ${Object.keys(registries.items).length}`
  );

  const allResults = []; // { stem, lang, result, originalCount }
  for (const { stem, lang, filePath } of files) {
    const original = readJson(filePath);
    const result = REKEY_FNS[stem](original, registries[stem]);
    writeSortedJson(filePath, result.rekeyed);
    allResults.push({ stem, lang, result, originalCount: Object.keys(original).length });
    console.log(
      `  ${stem}.${lang}: re-keyed ${result.count}/${Object.keys(original).length}, warnings ${result.warnings.length}`
    );
  }

  const withWarnings = allResults.filter((r) => r.result.warnings.length > 0);
  if (withWarnings.length > 0) {
    console.log('\nAll warnings:');
    for (const { stem, lang, result } of withWarnings) {
      console.log(`  [${stem}.${lang}]`);
      for (const w of result.warnings) console.log(`    ${w}`);
    }
  }
}

main();
