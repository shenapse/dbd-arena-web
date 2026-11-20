// Player search and paging rules for the leaderboard standings
// (RankingLeaderboard.astro). The component renders every row on the server
// and its browser script uses these to decide which rows to show and what the
// controls say. Kept free of the DOM so the rules can be tested directly.

/** Rows per page unless the hosting page asks for another size. */
export const DEFAULT_PAGE_SIZE = 25;

/** Lower-cased, compatibility-normalised text (full-width "Ｅｃｈｏ" reads as "echo"). */
export function normaliseQuery(text: string): string {
  return text.normalize('NFKC').toLowerCase().trim();
}

interface SearchableProfile {
  display_name: string;
  profile_id: string;
  group_members?: { display_name: string; profile_id: string }[] | null;
}

/**
 * What a standing's search matches against: display name and profile ID, and
 * for a group (a survivor party) its published members' names and IDs too.
 */
export function searchText(profile: SearchableProfile): string {
  const members = (profile.group_members ?? []).map((m) => `${m.display_name} ${m.profile_id}`);
  return normaliseQuery([`${profile.display_name} ${profile.profile_id}`, ...members].join(' '));
}

/** Substring match on normalised text. An empty query matches every row. */
export function matchesQuery(text: string, query: string): boolean {
  return text.includes(query);
}

/**
 * Query parameter holding a board's page number: `page` when the page has one
 * board, otherwise `page-1`, `page-2`, … so each board pages on its own.
 */
export function pageParamName(boardIndex: number, boardCount: number): string {
  return boardCount === 1 ? 'page' : `page-${boardIndex + 1}`;
}

/** Page number from a query parameter value. Missing or not a number reads as page 1. */
export function parsePage(value: string | null): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isNaN(n) ? 1 : n;
}

/** 1-based page holding the row at a 0-based index. */
export function pageOf(index: number, pageSize: number): number {
  return Math.floor(index / pageSize) + 1;
}

export interface PageWindow {
  /** The requested page, clamped to 1…count. */
  page: number;
  /** Number of pages; at least 1, even with no rows. */
  count: number;
  /** 0-based index of the first row shown. */
  start: number;
  /** 0-based index just past the last row shown. */
  end: number;
}

export function pageWindow(rowCount: number, requestedPage: number, pageSize: number): PageWindow {
  const count = Math.max(1, Math.ceil(rowCount / pageSize));
  const page = Math.min(Math.max(1, requestedPage), count);
  const start = (page - 1) * pageSize;
  return { page, count, start, end: Math.min(start + pageSize, rowCount) };
}

/** First, last, and the pages around the current one; null marks a gap. */
export function pageNumbers(current: number, count: number): (number | null)[] {
  const wanted = [...new Set([1, current - 1, current, current + 1, count])]
    .filter((p) => p >= 1 && p <= count)
    .sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let previous = 0;
  for (const p of wanted) {
    // A gap of a single page shows that page rather than an ellipsis.
    if (p - previous === 2) out.push(previous + 1);
    else if (p - previous > 2) out.push(null);
    out.push(p);
    previous = p;
  }
  return out;
}

/** What the board's rows are, singular and plural. */
export interface RowNoun {
  one: string;
  other: string;
}

const PLAYERS: RowNoun = { one: 'player', other: 'players' };

/**
 * The line beside the search box.
 * @param total rows on the board
 * @param matched rows the search leaves (equal to total when not searching)
 * @param query the search box text as typed; blank when not searching
 * @param noun what the rows are; players unless the board says otherwise
 */
export function statusText(total: number, matched: number, query: string, view: PageWindow, noun: RowNoun = PLAYERS): string {
  const plural = (n: number) => `${n} ${n === 1 ? noun.one : noun.other}`;
  const range = `${view.start + 1}–${view.end}`;
  if (normaliseQuery(query) === '') {
    return view.count === 1 ? plural(total) : `Showing ${range} of ${plural(total)}`;
  }
  const quoted = `“${query.trim()}”`;
  if (matched === 0) return `No ${noun.other} match ${quoted}`;
  return `${plural(matched)} ${matched === 1 ? 'matches' : 'match'} ${quoted}`
    + (view.count > 1 ? `, showing ${range}` : '');
}
