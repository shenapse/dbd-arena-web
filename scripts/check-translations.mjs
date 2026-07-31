#!/usr/bin/env node
'use strict';

/**
 * check-translations.mjs
 *
 * Validator for the localized-docs-join-by-path architecture: English pages
 * under src/content/docs/** are the sole source of lifecycle truth (status,
 * changeHistory — version/effectiveDate are derived from changeHistory's
 * newest entry, not stored). Localized pages under src/content/docs/ja/**
 * and src/content/docs/ko/** are joined to their English original BY PATH
 * (strip the locale prefix) and carry only presentational/provenance
 * frontmatter — no lifecycle keys — plus, on a handful of ja pages, a
 * notes-only changeHistory override.
 *
 * Runs eight checks:
 *   A. Every localized page's path (locale prefix stripped) resolves to an
 *      existing English page.
 *   B. No localized page declares a derived/provenance key that now lives
 *      only on the English original: status, version, effectiveDate,
 *      language, authoritativeSource, translatedVersion.
 *   C. Where a localized page DOES declare changeHistory (a notes-only
 *      override), its version/date lineage matches its English
 *      counterpart's exactly — same entry count, same set of versions, same
 *      date per version. Only `note` may differ.
 *   D. Every English page with a `status` key has a non-empty
 *      changeHistory, no version/effectiveDate key, every entry's date is a
 *      valid YYYY-MM-DD, and entries are ordered newest-first. Pages under
 *      src/content/docs/notices/ are notice records, not lifecycle pages,
 *      and are skipped (see notices/2026-06-15-launch.md, which keeps a
 *      bare `version` with no `status`).
 *   E. The set of top-level directories under src/content/docs/ that
 *      mirror content living elsewhere in the tree (i.e. are locale
 *      directories) equals LOCALE_PREFIXES from src/lib/docs/ids.ts. This
 *      is computed structurally (every file under the directory resolves,
 *      prefix stripped, to a file elsewhere in the tree) rather than by
 *      consulting LOCALE_PREFIXES itself, so it actually catches an
 *      unregistered new locale directory instead of being tautological.
 *   F. `handle` is unique across English pages. (Localized pages
 *      intentionally mirror their English original's handle, so only
 *      English pages are compared against each other.)
 *   G. No .mdx page contains a <LifecycleMeta> tag with any attribute
 *      (only the exact zero-prop <LifecycleMeta /> is allowed), and no
 *      page has a leftover hand-written translation-notice blockquote
 *      (a line starting with `>` `**` followed by 翻訳について, 번역 안내,
 *      or "Translation note" — the prose <TranslationNotice /> replaced).
 *   H. Body parity for per-killer balancing pages ONLY — paths matching
 *      game-modes/*\/balancing/* (excluding the `index` listing page).
 *      These pages are meant to be byte-for-byte structural clones of
 *      their English original (only the components differ), so their
 *      bodies must match after dropping the <TranslationNotice /> line and
 *      its import line, rewriting `](/ja/` -> `](/` and `](/ko/` -> `](/`,
 *      and collapsing incidental blank-line drift. This is intentionally a
 *      path PREDICATE, not a filename allow-list: every other localized
 *      page is genuinely translated prose and is expected to differ, so it
 *      is exempt from this check by not matching the predicate.
 *
 * Exits 0 when all checks pass, non-zero otherwise.
 *
 * Usage:
 *   node scripts/check-translations.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { splitLocale, normalizeDocsId, idToHref, LOCALE_PREFIXES } from '../src/lib/docs/ids.ts';

const DOCS_DIR = path.resolve('src/content/docs');
const NOTICES_DIR = path.join(DOCS_DIR, 'notices');

const FORBIDDEN_LOCALIZED_KEYS = [
  'status',
  'version',
  'effectiveDate',
  'language',
  'authoritativeSource',
  'translatedVersion',
];

function relDisplay(filePath) {
  return path.relative(process.cwd(), filePath);
}

// ---------------------------------------------------------------------------
// Discovery: walk src/content/docs, derive each file's docs id the way the
// loader does, split off any locale prefix, and cache parsed frontmatter.
// ---------------------------------------------------------------------------

function findDocFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findDocFiles(full));
    } else if (entry.isFile() && /\.(mdx?|md)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/** Derive a docs collection id from a file path, mirroring docsLoader. */
function pathToId(filePath) {
  let rel = path.relative(DOCS_DIR, filePath).split(path.sep).join('/');
  rel = rel.replace(/\.mdx?$/, '');
  if (rel.endsWith('/index')) rel = rel.slice(0, -'/index'.length);
  return normalizeDocsId(rel);
}

const frontmatterCache = new Map();

/** Parse a page's frontmatter and body (everything after the closing `---`). */
function readPage(filePath) {
  if (frontmatterCache.has(filePath)) return frontmatterCache.get(filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const result = match
    ? { frontmatter: parse(match[1]) ?? {}, body: match[2] }
    : { frontmatter: {}, body: raw };
  frontmatterCache.set(filePath, result);
  return result;
}

const allFiles = findDocFiles(DOCS_DIR);

/** { filePath, id, locale, path } for every doc page. */
const pages = allFiles.map((filePath) => {
  const id = pathToId(filePath);
  const { locale, path: localePath } = splitLocale(id);
  return { filePath, id, locale, path: localePath };
});

const englishById = new Map(); // locale-independent path -> English file path
const localizedPages = [];
for (const page of pages) {
  if (page.locale === undefined) {
    englishById.set(page.path, page.filePath);
  } else {
    localizedPages.push(page);
  }
}

// ---------------------------------------------------------------------------
// Check A: localized page resolves to an English counterpart.
// ---------------------------------------------------------------------------

function checkResolvesToEnglish() {
  const failures = [];
  for (const page of localizedPages) {
    if (!englishById.has(page.path)) {
      failures.push(
        `${relDisplay(page.filePath)}: no English counterpart at expected path ${idToHref(page.path)} (id "${page.path}")`
      );
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check B: no localized page declares a derived/provenance key.
// ---------------------------------------------------------------------------

function checkNoDerivedKeysOnLocalized() {
  const failures = [];
  for (const page of localizedPages) {
    const { frontmatter } = readPage(page.filePath);
    for (const key of FORBIDDEN_LOCALIZED_KEYS) {
      if (Object.prototype.hasOwnProperty.call(frontmatter, key)) {
        failures.push(`${relDisplay(page.filePath)}: declares forbidden key "${key}" (this is derived from the English original)`);
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check C: localized changeHistory is a notes-only override.
// ---------------------------------------------------------------------------

function checkLocalizedChangeHistoryOverride() {
  const failures = [];
  for (const page of localizedPages) {
    const { frontmatter } = readPage(page.filePath);
    if (!Object.prototype.hasOwnProperty.call(frontmatter, 'changeHistory')) continue;

    const relPath = relDisplay(page.filePath);
    const locHistory = frontmatter.changeHistory;

    const englishFile = englishById.get(page.path);
    if (!englishFile) {
      failures.push(`${relPath}: declares changeHistory but has no English counterpart to compare against`);
      continue;
    }

    const { frontmatter: engFrontmatter } = readPage(englishFile);
    const engHistory = engFrontmatter.changeHistory;

    if (!Array.isArray(engHistory) || engHistory.length === 0) {
      failures.push(`${relPath}: declares changeHistory but English counterpart ${relDisplay(englishFile)} has none`);
      continue;
    }
    if (!Array.isArray(locHistory)) {
      failures.push(`${relPath}: changeHistory is not an array`);
      continue;
    }
    if (locHistory.length !== engHistory.length) {
      failures.push(
        `${relPath}: changeHistory has ${locHistory.length} entries, English counterpart ${relDisplay(englishFile)} has ${engHistory.length}`
      );
      continue;
    }

    const engByVersion = new Map(engHistory.map((entry) => [String(entry.version), String(entry.date)]));
    const locVersions = new Set(locHistory.map((entry) => String(entry.version)));
    const engVersions = new Set(engHistory.map((entry) => String(entry.version)));

    const versionSetsMatch =
      locVersions.size === engVersions.size && [...locVersions].every((v) => engVersions.has(v));
    if (!versionSetsMatch) {
      failures.push(
        `${relPath}: changeHistory versions {${[...locVersions].join(', ')}} do not match English counterpart's versions {${[...engVersions].join(', ')}}`
      );
      continue;
    }

    for (const entry of locHistory) {
      const v = String(entry.version);
      const expectedDate = engByVersion.get(v);
      if (String(entry.date) !== expectedDate) {
        failures.push(
          `${relPath}: changeHistory version "${v}" has date "${entry.date}", English counterpart has "${expectedDate}"`
        );
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check D: English lifecycle integrity.
// ---------------------------------------------------------------------------

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function checkEnglishLifecycleIntegrity() {
  const failures = [];
  for (const [, filePath] of englishById) {
    if (filePath.startsWith(NOTICES_DIR + path.sep)) continue;

    const { frontmatter } = readPage(filePath);
    if (!Object.prototype.hasOwnProperty.call(frontmatter, 'status')) continue;

    const relPath = relDisplay(filePath);

    for (const key of ['version', 'effectiveDate']) {
      if (Object.prototype.hasOwnProperty.call(frontmatter, key)) {
        failures.push(`${relPath}: has status but still declares "${key}" (must be derived from changeHistory)`);
      }
    }

    const history = frontmatter.changeHistory;
    if (!Array.isArray(history) || history.length === 0) {
      failures.push(`${relPath}: has status but changeHistory is missing or empty`);
      continue;
    }

    let previousDate;
    for (const [i, entry] of history.entries()) {
      const date = entry?.date;
      if (!isValidIsoDate(date)) {
        failures.push(`${relPath}: changeHistory[${i}] has invalid date "${date}" (expected YYYY-MM-DD)`);
        continue;
      }
      if (previousDate !== undefined && date > previousDate) {
        failures.push(
          `${relPath}: changeHistory[${i}] date "${date}" is newer than the previous entry's "${previousDate}" (must be ordered newest-first)`
        );
      }
      previousDate = date;
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check E: locale-prefix registry matches reality.
// ---------------------------------------------------------------------------

/**
 * Structurally detect which top-level directories under src/content/docs/
 * are locale directories: every NESTED file under the directory (i.e.
 * excluding the directory's own bare index page, which is not meaningful
 * evidence — its stripped id trivially matches whatever else uses '' as an
 * id), with that top-level segment stripped, must resolve to a different
 * doc id that exists elsewhere in the tree. A directory with no nested
 * files (just its own index page) is ordinary English content, not a
 * locale directory, and is left undecided (excluded). This does NOT
 * consult LOCALE_PREFIXES, so comparing its result against LOCALE_PREFIXES
 * is a real check, not a tautology.
 */
function detectLocaleDirs() {
  const idSet = new Set(pages.map((p) => p.id));
  const topDirs = fs
    .readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const localeDirs = [];
  for (const dir of topDirs) {
    const nestedIds = pages.map((p) => p.id).filter((id) => id.startsWith(`${dir}/`));
    if (nestedIds.length === 0) continue;

    const allMirrorElsewhere = nestedIds.every((id) => idSet.has(id.slice(dir.length + 1)));
    if (allMirrorElsewhere) localeDirs.push(dir);
  }
  return localeDirs.sort();
}

function checkLocaleRegistryMatchesReality() {
  const failures = [];
  const detected = detectLocaleDirs();
  const registered = [...LOCALE_PREFIXES].sort();

  const missingFromRegistry = detected.filter((d) => !registered.includes(d));
  const registeredButAbsent = registered.filter((d) => !detected.includes(d));

  for (const dir of missingFromRegistry) {
    failures.push(
      `src/content/docs/${dir}/ mirrors English content but "${dir}" is not in LOCALE_PREFIXES (src/lib/docs/ids.ts) — its translation notice would be silently disabled`
    );
  }
  for (const dir of registeredButAbsent) {
    failures.push(`LOCALE_PREFIXES declares "${dir}" but src/content/docs/${dir}/ has no localized pages on disk`);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check F: handle uniqueness among English pages.
// ---------------------------------------------------------------------------

function checkHandleUniqueness() {
  const failures = [];
  const filesByHandle = new Map();

  for (const [, filePath] of englishById) {
    const { frontmatter } = readPage(filePath);
    const handle = frontmatter.handle;
    if (handle === undefined) continue;
    if (!filesByHandle.has(handle)) filesByHandle.set(handle, []);
    filesByHandle.get(handle).push(filePath);
  }

  for (const [handle, files] of filesByHandle) {
    if (files.length > 1) {
      failures.push(`handle "${handle}" is declared by multiple English pages: ${files.map(relDisplay).join(', ')}`);
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check G: no hand-authored lifecycle/notice markup.
// ---------------------------------------------------------------------------

const NOTICE_BLOCKQUOTE_MARKERS = ['翻訳について', '번역 안내', 'Translation note'];

function checkNoHandwrittenMarkup() {
  const failures = [];
  const mdxFiles = allFiles.filter((f) => f.endsWith('.mdx'));

  for (const filePath of mdxFiles) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const relPath = relDisplay(filePath);

    const lifecycleTags = raw.match(/<LifecycleMeta[^>]*>/g) ?? [];
    for (const tag of lifecycleTags) {
      if (tag !== '<LifecycleMeta />') {
        failures.push(`${relPath}: hand-authored LifecycleMeta tag "${tag}" — must be exactly "<LifecycleMeta />"`);
      }
    }

    const lines = raw.split('\n');
    lines.forEach((line, i) => {
      if (/^>\s*\*\*/.test(line) && NOTICE_BLOCKQUOTE_MARKERS.some((marker) => line.includes(marker))) {
        failures.push(`${relPath}:${i + 1}: leftover hand-written translation-notice blockquote: "${line.trim()}"`);
      }
    });
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Check H: body parity for per-killer balancing pages only.
// ---------------------------------------------------------------------------

/** game-modes/<format>/balancing/<killer> paths, excluding the balancing index listing page. */
function isBalancingKillerPath(localePath) {
  const match = localePath.match(/^game-modes\/[^/]+\/balancing\/([^/]+)$/);
  return match !== null && match[1] !== 'index';
}

/** Collapse runs of 2+ blank lines to one and trim leading/trailing blank lines. */
function normalizeBlankRuns(text) {
  const lines = text.split('\n');
  const collapsed = [];
  for (const line of lines) {
    if (line.trim() === '' && collapsed.length > 0 && collapsed[collapsed.length - 1].trim() === '') continue;
    collapsed.push(line);
  }
  return collapsed.join('\n').trim();
}

function normalizeLocalizedBody(body) {
  const withoutTranslationNotice = body
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed !== "import TranslationNotice from '@components/TranslationNotice.astro';" &&
        trimmed !== '<TranslationNotice />'
      );
    })
    .join('\n');
  const withRewrittenLinks = withoutTranslationNotice.split('](/ja/').join('](/').split('](/ko/').join('](/');
  return normalizeBlankRuns(withRewrittenLinks);
}

function checkBalancingBodyParity() {
  const failures = [];
  let checked = 0;

  for (const page of localizedPages) {
    if (!isBalancingKillerPath(page.path)) continue;

    const englishFile = englishById.get(page.path);
    if (!englishFile) continue; // already reported by check A

    checked += 1;
    const { body: locBody } = readPage(page.filePath);
    const { body: engBody } = readPage(englishFile);

    const normLoc = normalizeLocalizedBody(locBody);
    const normEng = normalizeBlankRuns(engBody);

    if (normLoc !== normEng) {
      failures.push(`${relDisplay(page.filePath)}: body does not match English counterpart ${relDisplay(englishFile)} after normalization`);
    }
  }
  return { failures, checked };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const bodyParity = checkBalancingBodyParity();

  const checks = [
    { name: 'Check A: localized page resolves to English counterpart', failures: checkResolvesToEnglish() },
    { name: 'Check B: no derived keys on localized pages', failures: checkNoDerivedKeysOnLocalized() },
    { name: 'Check C: localized changeHistory is notes-only override', failures: checkLocalizedChangeHistoryOverride() },
    { name: 'Check D: English lifecycle integrity', failures: checkEnglishLifecycleIntegrity() },
    { name: 'Check E: locale-prefix registry matches reality', failures: checkLocaleRegistryMatchesReality() },
    { name: 'Check F: handle uniqueness among English pages', failures: checkHandleUniqueness() },
    { name: 'Check G: no hand-authored lifecycle/notice markup', failures: checkNoHandwrittenMarkup() },
    {
      name: `Check H: balancing-page body parity (${bodyParity.checked} checked)`,
      failures: bodyParity.failures,
    },
  ];

  console.log('Translation/lifecycle validation');
  console.log('=================================');
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
