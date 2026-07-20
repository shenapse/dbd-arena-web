#!/usr/bin/env node
'use strict';

/**
 * sync-dbd-data.mjs
 *
 * Vendors a JSON snapshot of the DBD universe data (perks, add-ons, items,
 * killers) from the sibling `balancing-tool` repo into `src/data/dbd/`. The
 * committed snapshot is what `astro build` reads — the sibling repo is only
 * needed when refreshing this data, not at site-build time.
 *
 * Uses the same env convention as the existing `generate:*` npm scripts
 * (see package.json): root = DBD_BALANCING_TOOL_ROOT || '../../../balancing-tool',
 * resolved relative to the current working directory (the repo root when run
 * via `npm run sync:dbd-data`).
 *
 * Usage:
 *   node scripts/sync-dbd-data.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.env.DBD_BALANCING_TOOL_ROOT || '../../../balancing-tool');

const OUT_DIR = path.resolve('src/data/dbd');

// [sourceRelativeToRepoRoot, destFilename]
const FILES = [
  [path.join('public', 'Perks', 'dbdperks.json'), 'perks.json'],
  [path.join('public', 'NewAddons.json'), 'addons.json'],
  [path.join('public', 'Items.json'), 'items.json'],
  [path.join('public', 'Killers.json'), 'killers.json'],
];

function fatal(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(REPO_ROOT) || !fs.statSync(REPO_ROOT).isDirectory()) {
    fatal(
      `balancing-tool root not found at "${REPO_ROOT}". ` +
      `Set DBD_BALANCING_TOOL_ROOT to the sibling repo's path, or place it at ../../../balancing-tool.`
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const [srcRel, destName] of FILES) {
    const srcPath = path.join(REPO_ROOT, srcRel);
    if (!fs.existsSync(srcPath)) {
      fatal(`Source file missing: "${srcPath}". Cannot sync "${destName}".`);
    }

    let raw;
    try {
      raw = fs.readFileSync(srcPath, 'utf8');
    } catch (e) {
      fatal(`Cannot read "${srcPath}": ${e.message}`);
    }

    // Fail loudly on malformed JSON rather than vendoring garbage.
    try {
      JSON.parse(raw);
    } catch (e) {
      fatal(`Source file "${srcPath}" is not valid JSON: ${e.message}`);
    }

    const destPath = path.join(OUT_DIR, destName);
    fs.writeFileSync(destPath, raw, 'utf8');
    console.log(`  ${srcRel} -> ${path.relative(process.cwd(), destPath)}`);
  }

  console.log(`\nSynced ${FILES.length} file(s) from "${REPO_ROOT}" into "${path.relative(process.cwd(), OUT_DIR)}".`);
}

main();
