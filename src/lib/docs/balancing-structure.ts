// Structure of a per-killer balancing page body, used to check that a
// translated page agrees with its English original (check H in
// scripts/check-translations.mjs).
//
// The balancing itself is in components and their props (BalancingList,
// MatchConditions, ImageRow, ...), in images, and in where links point. Those
// must match exactly. Prose is translated, so only its shape is compared: the
// heading levels, and how many paragraphs and list items each section has.
// A leftover untranslated sentence, a dropped rule line or a component with
// different props changes the structure; a translated sentence does not.

export interface StructureItem {
  /** What is compared, e.g. `heading 2`, `<BalancingList killer="wraith" />`, `paragraph → /game-modes/`. */
  key: string;
  /** 1-based line of the body where the item starts. */
  line: number;
}

/** Lines only translations carry; they are not part of the structure. */
const TRANSLATION_NOTICE = new Set([
  "import TranslationNotice from '@components/TranslationNotice.astro';",
  '<TranslationNotice />',
]);

const HEADING = /^(#{1,6})\s/;
const LIST_ITEM = /^(?:[-*+]|\d+\.)\s/;
const IMAGE_LINE = /^!\[[^\]]*\]\(([^)\s]+)[^)]*\)$/;
const LINK = /\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * @param localePrefixes locale URL prefixes (e.g. `ja`) to strip from link
 *   targets, so `/ja/game-modes/` and `/game-modes/` compare equal.
 */
export function balancingStructure(body: string, localePrefixes: readonly string[] = []): StructureItem[] {
  const localeLink = localePrefixes.length > 0 ? new RegExp(`^/(?:${localePrefixes.join('|')})(?=/)`) : null;
  const target = (url: string) => (localeLink ? url.replace(localeLink, '') : url);
  const targets = (text: string) => [...text.matchAll(LINK)].map((m) => target(m[1]!));
  const withTargets = (kind: string, found: string[]) => (found.length > 0 ? `${kind} → ${found.join(', ')}` : kind);

  const lines = body.split('\n');
  const items: StructureItem[] = [];
  let paragraph: { line: number; targets: string[] } | null = null;
  const flush = () => {
    if (paragraph) items.push({ key: withTargets('paragraph', paragraph.targets), line: paragraph.line });
    paragraph = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!.trim();
    const line = i + 1;
    if (text === '' || TRANSLATION_NOTICE.has(text)) {
      flush();
      continue;
    }

    const heading = HEADING.exec(text);
    const image = IMAGE_LINE.exec(text);
    if (heading) {
      flush();
      items.push({ key: `heading ${heading[1]!.length}`, line });
    } else if (text.startsWith('import ')) {
      flush();
      items.push({ key: collapse(text), line });
    } else if (text.startsWith('<')) {
      // A component tag may span lines (props holding arrays or objects):
      // it ends on a line closing the tag with every brace closed.
      flush();
      let tag = text;
      while (!(tag.endsWith('>') && braceDepth(tag) === 0) && i + 1 < lines.length) tag += `\n${lines[++i]}`;
      items.push({ key: collapse(tag), line });
    } else if (image) {
      flush();
      items.push({ key: `image ${target(image[1]!)}`, line });
    } else if (LIST_ITEM.test(text)) {
      flush();
      items.push({ key: withTargets('list item', targets(text)), line });
    } else if (text.startsWith('|')) {
      flush();
      items.push({ key: `table row, ${text.split('|').length - 2} cells`, line });
    } else {
      paragraph ??= { line, targets: [] };
      paragraph.targets.push(...targets(text));
    }
  }
  flush();
  return items;
}

function braceDepth(text: string): number {
  let depth = 0;
  for (const ch of text) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  return depth;
}

export interface StructureDifference {
  /** The first English item that has no match, or undefined when the translation has extra items. */
  english?: StructureItem;
  /** The translation's item at the same position, or undefined when it ends early. */
  localized?: StructureItem;
}

/** The first position where two structures differ, or null when they agree. */
export function firstDifference(english: StructureItem[], localized: StructureItem[]): StructureDifference | null {
  const length = Math.max(english.length, localized.length);
  for (let i = 0; i < length; i++) {
    if (english[i]?.key !== localized[i]?.key) return { english: english[i], localized: localized[i] };
  }
  return null;
}
