// Server-rendered markup of RankingLeaderboard: what the browser script and
// the no-JavaScript fallback rely on. Browser behaviour is in tests/e2e/.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import RankingLeaderboard from '../../src/components/RankingLeaderboard.astro';
import { loadLeaderboard } from '../../src/lib/ranking/snapshot';
import { makeSnapshot, profileId, type BoardSpec } from '../fixtures/ranking-snapshot';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

function render(boards: BoardSpec[], pageSize?: number) {
  return container.renderToString(RankingLeaderboard, {
    props: { view: loadLeaderboard(makeSnapshot(boards)), boardIntroduction: 'Intro.', pageSize },
  });
}

/** Opening tags of the standings rows, in order. */
const rowTags = (html: string) => html.match(/<li\b[^>]*\bclass="standings__item\b[^>]*>/g) ?? [];
const attr = (tag: string, name: string) => new RegExp(`\\s${name}(?:="([^"]*)")?[\\s>]`).exec(tag);
const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe('RankingLeaderboard markup', () => {
  it('gives a one-page board a search box and a pager that starts hidden', async () => {
    const html = await render([{ players: 5 }]);
    expect(count(html, /<input\b[^>]*\bdata-search\b/g)).toBe(1);
    expect(html).toMatch(/<div\b[^>]*\bdata-tools\b[^>]*\bhidden\b/);
    expect(html).toMatch(/<nav\b[^>]*\bdata-pager\b[^>]*\bhidden\b/);
    expect(html).toMatch(/data-page-size="25"/);
    expect(html).toMatch(/data-page-param="page"/);
    expect(rowTags(html)).toHaveLength(5);
    expect(rowTags(html).filter((t) => attr(t, 'data-overflow'))).toHaveLength(0);
  });

  it('renders every row and marks those past the first page', async () => {
    const tags = rowTags(await render([{ players: 60 }]));
    expect(tags).toHaveLength(60);
    const overflow = tags.map((t) => attr(t, 'data-overflow') !== null);
    expect(overflow.slice(0, 25).every((o) => !o)).toBe(true);
    expect(overflow.slice(25).every((o) => o)).toBe(true);
  });

  it('honours a page size from the hosting page', async () => {
    const html = await render([{ players: 30 }], 10);
    expect(html).toMatch(/data-page-size="10"/);
    expect(rowTags(html).filter((t) => attr(t, 'data-overflow'))).toHaveLength(20);
  });

  it('gives each row normalised search text with its name and profile ID', async () => {
    const tags = rowTags(await render([{ players: 3, names: { 1: 'Ｅｃｈｏ Night' } }]));
    expect(attr(tags[0]!, 'data-search-text')?.[1]).toBe(`player 001 ${profileId(0, 0)}`);
    expect(attr(tags[1]!, 'data-search-text')?.[1]).toBe(`echo night ${profileId(0, 1)}`);
  });

  it('numbers page parameters per board and gives an empty board no controls', async () => {
    const html = await render([{ players: 30 }, { players: 30 }, { players: 0 }], 10);
    expect([...html.matchAll(/data-page-param="([^"]+)"/g)].map((m) => m[1])).toEqual(['page-1', 'page-2']);
    expect(count(html, /<input\b[^>]*\bdata-search\b/g)).toBe(2);
    expect(html).toContain('No players meet the eligibility requirements in this snapshot.');
  });

  it('marks the page for first-paint hiding only through script', async () => {
    const html = await render([{ players: 60 }]);
    // Without JavaScript this class is never added, so no row is hidden.
    expect(html).not.toMatch(/class="ranking ranking--js/);
    expect(html).toContain("classList.add('ranking--js')");
  });
});
