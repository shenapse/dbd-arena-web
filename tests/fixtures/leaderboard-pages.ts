// Leaderboard pages built only for the browser tests, served at
// /test-fixtures/leaderboard/<name>/ by
// src/pages/test-fixtures/leaderboard/[fixture].astro when the build runs with
// LEADERBOARD_TEST_FIXTURES=1 (npm run test:e2e does this). Normal builds
// emit none of them.

import type { BoardSpec } from './ranking-snapshot';

export interface LeaderboardFixture {
  boards: BoardSpec[];
  /** Passed to RankingLeaderboard; omitted means the component default. */
  pageSize?: number;
}

export const FIXTURE_ENV = 'LEADERBOARD_TEST_FIXTURES';
export const fixturePath = (name: FixtureName) => `/test-fixtures/leaderboard/${name}/`;

export const leaderboardFixtures = {
  /** Three pages at the default page size; row 31 has a full-width name. */
  long: { boards: [{ players: 60, names: { 30: 'Ｅｃｈｏ Night' } }] },
  /** Twelve pages, so the pager shows gaps. */
  'many-pages': { boards: [{ players: 60 }], pageSize: 5 },
  /** Fits on one page: search but no pager. */
  short: { boards: [{ players: 5 }] },
  /** Two paged boards with their own page parameters, and an empty board. */
  multi: { boards: [{ players: 30 }, { players: 30 }, { players: 0 }], pageSize: 10 },
} satisfies Record<string, LeaderboardFixture>;

export type FixtureName = keyof typeof leaderboardFixtures;
