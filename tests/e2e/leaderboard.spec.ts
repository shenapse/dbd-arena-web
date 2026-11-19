// Player search and paging on the leaderboard standings, in a real browser.
// The pages are synthetic fixtures (tests/fixtures/leaderboard-pages.ts);
// row i of board b has the anchor "standing-<b>-<i>" (both 1-based) and,
// unless renamed, the name "Player <i>" zero-padded to three digits.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { fixturePath } from '../fixtures/leaderboard-pages';

const LONG = fixturePath('long');

/** Anchors of the rows currently shown on a board. */
async function shownRows(board: Locator): Promise<string[]> {
  return board.locator('.standings__item:visible').evaluateAll((items) => items.map((li) => li.id));
}

const range = (board: number, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `standing-${board}-${from + i}`);

function controls(page: Page, boardIndex = 0) {
  const board = page.locator('.board-standings').nth(boardIndex);
  const pager = board.getByRole('navigation');
  return {
    board,
    search: board.getByRole('searchbox'),
    status: board.locator('[data-status]'),
    pager,
    prev: pager.getByRole('button', { name: 'Previous page' }),
    next: pager.getByRole('button', { name: 'Next page' }),
    pageButton: (n: number) => pager.getByRole('button', { name: `Page ${n}`, exact: true }),
  };
}

const query = (page: Page) => new URL(page.url()).search;

test.describe('a board longer than one page', () => {
  test('shows the first page of 25 rows', async ({ page }) => {
    await page.goto(LONG);
    const c = controls(page);
    expect(await shownRows(c.board)).toEqual(range(1, 1, 25));
    await expect(c.status).toHaveText('Showing 1–25 of 60 players');
    await expect(c.prev).toBeDisabled();
    await expect(c.pageButton(1)).toHaveAttribute('aria-current', 'page');
    expect(query(page)).toBe('');
  });

  test('moves between pages with Next, Previous and page numbers', async ({ page }) => {
    await page.goto(LONG);
    const c = controls(page);

    await c.next.click();
    expect(query(page)).toBe('?page=2');
    expect(await shownRows(c.board)).toEqual(range(1, 26, 50));
    await expect(c.status).toHaveText('Showing 26–50 of 60 players');

    await c.pageButton(3).click();
    expect(query(page)).toBe('?page=3');
    expect(await shownRows(c.board)).toEqual(range(1, 51, 60));
    await expect(c.next).toBeDisabled();

    await c.prev.click();
    expect(query(page)).toBe('?page=2');
    await c.pageButton(1).click();
    expect(query(page)).toBe('');
  });

  test('restores pages with the back and forward buttons', async ({ page }) => {
    await page.goto(LONG);
    const c = controls(page);
    await c.next.click();
    await c.next.click();

    await page.goBack();
    expect(query(page)).toBe('?page=2');
    await expect.poll(() => shownRows(c.board)).toEqual(range(1, 26, 50));
    await page.goBack();
    await expect.poll(() => shownRows(c.board)).toEqual(range(1, 1, 25));
    await page.goForward();
    await expect.poll(() => shownRows(c.board)).toEqual(range(1, 26, 50));
  });

  test('opens on the page named in the URL', async ({ page }) => {
    await page.goto(`${LONG}?page=3`);
    expect(await shownRows(controls(page).board)).toEqual(range(1, 51, 60));
  });

  test('corrects page numbers out of range', async ({ page }) => {
    await page.goto(`${LONG}?page=99`);
    expect(await shownRows(controls(page).board)).toEqual(range(1, 51, 60));
    expect(query(page)).toBe('?page=3');

    await page.goto(`${LONG}?page=abc`);
    expect(await shownRows(controls(page).board)).toEqual(range(1, 1, 25));
    expect(query(page)).toBe('');
  });

  test('closes open rows and moves focus to the list on a page change', async ({ page }) => {
    await page.goto(LONG);
    const c = controls(page);
    const first = page.locator('#standing-1-1 details');
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');

    await c.next.click();
    await expect(c.board.locator('.standings__list')).toBeFocused();
    await c.prev.click();
    await expect(first).not.toHaveAttribute('open');
  });

  test('a link to a row on another page switches to that page and opens the row', async ({ page }) => {
    await page.goto(`${LONG}#standing-1-40`);
    const c = controls(page);
    expect(await shownRows(c.board)).toEqual(range(1, 26, 50));
    await expect(page.locator('#standing-1-40 details')).toHaveAttribute('open', '');
    await expect(page.locator('#standing-1-40')).toBeInViewport();
    expect(query(page)).toBe('?page=2');
  });

  test('opponent links follow the opponent to their page, and back returns', async ({ page }) => {
    await page.goto(LONG);
    const c = controls(page);
    await page.locator('#standing-1-1 summary').click();
    // Row 1 meets row 31, which is on page 2.
    await page.locator('#standing-1-1').getByRole('link', { name: 'Ｅｃｈｏ Night' }).click();

    await expect(page.locator('#standing-1-31 details')).toHaveAttribute('open', '');
    expect(await shownRows(c.board)).toEqual(range(1, 26, 50));
    expect(new URL(page.url()).hash).toBe('#standing-1-31');

    await page.goBack();
    await expect.poll(() => shownRows(c.board)).toEqual(range(1, 1, 25));
  });

  test('a page change drops a fragment naming a row of the board', async ({ page }) => {
    await page.goto(`${LONG}#standing-1-40`);
    await controls(page).next.click();
    expect(new URL(page.url()).hash).toBe('');
    expect(query(page)).toBe('?page=3');
  });

  test('searches across all pages', async ({ page }) => {
    await page.goto(`${LONG}?page=3`);
    const c = controls(page);

    await c.search.fill('echo');
    expect(await shownRows(c.board)).toEqual(['standing-1-31']);
    await expect(c.status).toHaveText('1 player matches “echo”');
    await expect(c.pager).toBeHidden();
    // Search results are not kept in the URL.
    expect(query(page)).toBe('?page=3');
  });

  test('matches profile IDs, full-width names and any letter case', async ({ page }) => {
    await page.goto(LONG);
    const c = controls(page);
    await c.search.fill('P-B1-007');
    expect(await shownRows(c.board)).toEqual(['standing-1-7']);
    await c.search.fill('ＥＣＨＯ');
    expect(await shownRows(c.board)).toEqual(['standing-1-31']);
  });

  test('pages through search results without touching the URL', async ({ page }) => {
    await page.goto(LONG);
    const c = controls(page);
    // Every default name; row 31 is renamed.
    await c.search.fill('player 0');
    await expect(c.status).toHaveText('59 players match “player 0”, showing 1–25');
    await c.next.click();
    await expect(c.status).toHaveText('59 players match “player 0”, showing 26–50');
    expect(await shownRows(c.board)).toEqual([...range(1, 26, 30), ...range(1, 32, 51)]);
    expect(query(page)).toBe('');
  });

  test('hides the table when nothing matches', async ({ page }) => {
    await page.goto(LONG);
    const c = controls(page);
    await c.search.fill('zzz');
    await expect(c.status).toHaveText('No players match “zzz”');
    await expect(c.board.locator('[data-standings]')).toBeHidden();
    await expect(c.pager).toBeHidden();
  });

  test('clearing the search returns to the page in the URL', async ({ page }) => {
    await page.goto(`${LONG}?page=2`);
    const c = controls(page);
    await c.search.fill('echo');
    await c.search.fill('');
    expect(await shownRows(c.board)).toEqual(range(1, 26, 50));
    await expect(c.status).toHaveText('Showing 26–50 of 60 players');
  });

  test('a narrow board shows "Page N of M" instead of page numbers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${LONG}?page=2`);
    const c = controls(page);
    await expect(c.pager.getByText('Page 2 of 3')).toBeVisible();
    await expect(c.pageButton(2)).toBeHidden();
    await expect(c.next).toBeVisible();
  });
});

test.describe('page numbers on a board with many pages', () => {
  const pageLabels = (page: Page) =>
    controls(page).pager.locator('[data-pages] > li').evaluateAll((items) => items.map((li) => li.textContent));

  test('keep first, last and neighbouring pages, with gaps between', async ({ page }) => {
    await page.goto(`${fixturePath('many-pages')}?page=6`);
    expect(await pageLabels(page)).toEqual(['1', '…', '5', '6', '7', '…', '12']);
    await controls(page).pageButton(12).click();
    expect(await pageLabels(page)).toEqual(['1', '…', '11', '12']);
  });
});

test.describe('a board that fits on one page', () => {
  test('has a search box but no pager', async ({ page }) => {
    await page.goto(fixturePath('short'));
    const c = controls(page);
    await expect(c.search).toBeVisible();
    await expect(c.pager).toBeHidden();
    await expect(c.status).toHaveText('5 players');
    expect(await shownRows(c.board)).toEqual(range(1, 1, 5));
  });

  test('search filters its rows and clearing brings them back', async ({ page }) => {
    await page.goto(fixturePath('short'));
    const c = controls(page);
    await c.search.fill('player 004');
    expect(await shownRows(c.board)).toEqual(['standing-1-4']);
    await expect(c.status).toHaveText('1 player matches “player 004”');
    await c.search.fill('');
    expect(await shownRows(c.board)).toEqual(range(1, 1, 5));
  });

  test('ignores a page number in the URL', async ({ page }) => {
    await page.goto(`${fixturePath('short')}?page=4`);
    expect(await shownRows(controls(page).board)).toEqual(range(1, 1, 5));
    expect(query(page)).toBe('');
  });
});

test.describe('several boards on one page', () => {
  test('each board keeps its own page in the URL', async ({ page }) => {
    await page.goto(fixturePath('multi'));
    const first = controls(page, 0);
    const second = controls(page, 1);

    await second.next.click();
    expect(query(page)).toBe('?page-2=2');
    expect(await shownRows(second.board)).toEqual(range(2, 11, 20));
    expect(await shownRows(first.board)).toEqual(range(1, 1, 10));

    await first.pageButton(3).click();
    expect(new URL(page.url()).searchParams.get('page-1')).toBe('3');
    await page.reload();
    expect(await shownRows(first.board)).toEqual(range(1, 21, 30));
    expect(await shownRows(second.board)).toEqual(range(2, 11, 20));
  });

  test('a board without players has no search box', async ({ page }) => {
    await page.goto(fixturePath('multi'));
    await expect(page.locator('.board-standings')).toHaveCount(2);
    await expect(page.getByRole('searchbox')).toHaveCount(2);
    await expect(page.getByText('No players meet the eligibility requirements in this snapshot.')).toBeVisible();
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every row is listed and no controls are shown', async ({ page }) => {
    await page.goto(`${LONG}?page=2`);
    const c = controls(page);
    expect(await shownRows(c.board)).toEqual(range(1, 1, 60));
    await expect(c.search).toBeHidden();
    await expect(c.pager).toBeHidden();
  });
});
