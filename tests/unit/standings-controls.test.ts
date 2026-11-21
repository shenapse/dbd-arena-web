import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  matchesQuery,
  normaliseQuery,
  pageNumbers,
  pageOf,
  pageParamName,
  pageWindow,
  parsePage,
  searchText,
  statusText,
} from '../../src/lib/ranking/standings-controls';

describe('search', () => {
  it('normalises case, width and surrounding space', () => {
    expect(normaliseQuery('  Echo ')).toBe('echo');
    expect(normaliseQuery('Ｅｃｈｏ')).toBe('echo');
    expect(normaliseQuery('　')).toBe('');
  });

  it('matches a group by its members as well', () => {
    const text = searchText({
      display_name: 'Team Fog',
      profile_id: 'g-8b4a',
      group_members: [{ display_name: 'Aster', profile_id: 'p-1a4b' }],
    });
    expect(matchesQuery(text, normaliseQuery('aster'))).toBe(true);
    expect(matchesQuery(text, normaliseQuery('p-1a4b'))).toBe(true);
  });

  it('matches display name and profile ID', () => {
    const text = searchText({ display_name: 'Last Lantern', profile_id: 'p-2A5F' });
    expect(matchesQuery(text, normaliseQuery('lantern'))).toBe(true);
    expect(matchesQuery(text, normaliseQuery('P-2a5f'))).toBe(true);
    expect(matchesQuery(text, normaliseQuery('rook'))).toBe(false);
  });

  it('matches full-width names with half-width queries and the reverse', () => {
    const text = searchText({ display_name: 'Ｅｃｈｏ Night', profile_id: 'p-1' });
    expect(matchesQuery(text, normaliseQuery('echo'))).toBe(true);
    const ascii = searchText({ display_name: 'Echo', profile_id: 'p-2' });
    expect(matchesQuery(ascii, normaliseQuery('ＥＣＨＯ'))).toBe(true);
  });

  it('matches every row when the query is empty', () => {
    expect(matchesQuery(searchText({ display_name: 'Rook', profile_id: 'p-3' }), normaliseQuery(''))).toBe(true);
  });
});

describe('page parameter', () => {
  it('is "page" on a single-board page and numbered per board otherwise', () => {
    expect(pageParamName(0, 1)).toBe('page');
    expect(pageParamName(0, 3)).toBe('page-1');
    expect(pageParamName(2, 3)).toBe('page-3');
  });

  it('reads missing or non-numeric values as page 1', () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage('')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage('3')).toBe(3);
  });

  it('leaves out-of-range numbers for pageWindow to clamp', () => {
    expect(parsePage('0')).toBe(0);
    expect(parsePage('-2')).toBe(-2);
    expect(parsePage('99')).toBe(99);
  });
});

describe('pageOf', () => {
  it('finds the 1-based page of a 0-based row', () => {
    expect(pageOf(0, 25)).toBe(1);
    expect(pageOf(24, 25)).toBe(1);
    expect(pageOf(25, 25)).toBe(2);
    expect(pageOf(59, 25)).toBe(3);
  });
});

describe('pageWindow', () => {
  it('uses 25 rows per page by default', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });

  it('selects the rows of the requested page', () => {
    expect(pageWindow(60, 1, 25)).toEqual({ page: 1, count: 3, start: 0, end: 25 });
    expect(pageWindow(60, 2, 25)).toEqual({ page: 2, count: 3, start: 25, end: 50 });
    expect(pageWindow(60, 3, 25)).toEqual({ page: 3, count: 3, start: 50, end: 60 });
  });

  it('clamps pages out of range', () => {
    expect(pageWindow(60, 99, 25).page).toBe(3);
    expect(pageWindow(60, 0, 25).page).toBe(1);
    expect(pageWindow(60, -4, 25).page).toBe(1);
  });

  it('has no partial page when rows divide evenly', () => {
    expect(pageWindow(50, 2, 25)).toEqual({ page: 2, count: 2, start: 25, end: 50 });
  });

  it('has one empty page when no rows remain', () => {
    expect(pageWindow(0, 3, 25)).toEqual({ page: 1, count: 1, start: 0, end: 0 });
  });
});

describe('pageNumbers', () => {
  it('lists every page when there are few', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(2, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps first, last and neighbours, with gaps between', () => {
    expect(pageNumbers(1, 12)).toEqual([1, 2, null, 12]);
    expect(pageNumbers(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageNumbers(12, 12)).toEqual([1, null, 11, 12]);
  });

  it('shows a single skipped page instead of a gap', () => {
    expect(pageNumbers(3, 12)).toEqual([1, 2, 3, 4, null, 12]);
    expect(pageNumbers(4, 12)).toEqual([1, 2, 3, 4, 5, null, 12]);
    expect(pageNumbers(9, 12)).toEqual([1, null, 8, 9, 10, 11, 12]);
  });
});

describe('statusText', () => {
  it('counts the players when the board fits on one page', () => {
    expect(statusText(5, 5, '', pageWindow(5, 1, 25))).toBe('5 players');
    expect(statusText(1, 1, '', pageWindow(1, 1, 25))).toBe('1 player');
  });

  it('gives the range shown on paged boards', () => {
    expect(statusText(60, 60, '', pageWindow(60, 2, 25))).toBe('Showing 26–50 of 60 players');
    expect(statusText(60, 60, '', pageWindow(60, 3, 25))).toBe('Showing 51–60 of 60 players');
  });

  it('reports search results, with the range when they span pages', () => {
    expect(statusText(60, 1, ' echo ', pageWindow(1, 1, 25))).toBe('1 player matches “echo”');
    expect(statusText(60, 3, 'Player 05', pageWindow(3, 1, 25))).toBe('3 players match “Player 05”');
    expect(statusText(60, 12, 'player', pageWindow(12, 2, 5))).toBe('12 players match “player”, showing 6–10');
  });

  it('says when nothing matches', () => {
    expect(statusText(60, 0, 'zzz', pageWindow(0, 1, 25))).toBe('No players match “zzz”');
  });

  it('names the rows the board ranks', () => {
    const parties = { one: 'survivor party', other: 'survivor parties' };
    expect(statusText(1, 1, '', pageWindow(1, 1, 25), parties)).toBe('1 survivor party');
    expect(statusText(60, 60, '', pageWindow(60, 2, 25), parties)).toBe('Showing 26–50 of 60 survivor parties');
    expect(statusText(60, 0, 'zzz', pageWindow(0, 1, 25), parties)).toBe('No survivor parties match “zzz”');
  });

  it('treats a blank query as not searching', () => {
    expect(statusText(60, 60, '   ', pageWindow(60, 1, 25))).toBe('Showing 1–25 of 60 players');
  });
});
