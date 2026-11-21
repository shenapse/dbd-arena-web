// Synthetic ranking snapshots for tests. The sample snapshots in
// docs/ref/examples/ have a handful of players; these produce boards of any
// length that still pass loadLeaderboard's validation.
//
// Board b, row i (both 0-based) is the profile "p-b<b>-<i>", ranked i + 1, with
// the display name "Player <i+1>" zero-padded to three digits unless
// `names` overrides it. Every player meets the next player round the board,
// and the first half of the board also meets the player half a board below,
// so opponent links reach rows on other pages. The higher-ranked player wins.

import type { IncludedMatchEvidence, PublicRankingProfile, RankingRow, RankingSnapshot } from '../../src/lib/ranking/snapshot';

export interface BoardSpec {
  players: number;
  /** Display names by 0-based row index, replacing the default "Player NNN". */
  names?: Record<number, string>;
}

export const profileId = (board: number, row: number) => `p-b${board + 1}-${String(row + 1).padStart(3, '0')}`;
export const defaultName = (row: number) => `Player ${String(row + 1).padStart(3, '0')}`;

const definition = (id: string, label: string) => ({ id, label, description: `${label} (test fixture).` });

export function makeSnapshot(boards: BoardSpec[]): RankingSnapshot {
  const profiles: PublicRankingProfile[] = [];
  const matches: IncludedMatchEvidence[] = [];

  const rankingBoards = boards.map((spec, b) => {
    const n = spec.players;
    const matchIds: string[][] = Array.from({ length: n }, () => []);
    const opponents: Set<number>[] = Array.from({ length: n }, () => new Set());
    const wins = new Array<number>(n).fill(0);

    for (let i = 0; i < n; i++) {
      profiles.push({
        profile_id: profileId(b, i),
        kind: 'participant',
        display_name: spec.names?.[i] ?? defaultName(i),
        group_members: null,
      });
    }

    const pairs: [number, number][] = [];
    if (n >= 2) for (let i = 0; i < n; i++) pairs.push([i, (i + 1) % n]);
    if (n >= 4) for (let i = 0; i < Math.floor(n / 2); i++) pairs.push([i, i + Math.floor(n / 2)]);

    pairs.forEach(([x, y], k) => {
      const [winner, loser] = x < y ? [x, y] : [y, x];
      const matchId = `m-b${b + 1}-${String(k + 1).padStart(4, '0')}`;
      const day = String((k % 28) + 1).padStart(2, '0');
      matches.push({
        match_id: matchId,
        played_at: `2026-10-${day}T21:00:00+09:00`,
        sides: [
          { side_id: 'seat-1', participants: [{ profile_id: profileId(b, winner), role_ids: [] }] },
          { side_id: 'seat-2', participants: [{ profile_id: profileId(b, loser), role_ids: [] }] },
        ],
        outcome_id: 'decided',
        public_facts: { winner_side_id: 'seat-1', rounds_won_by_side: { 'seat-1': 2, 'seat-2': k % 2 } },
      });
      for (const [self, other] of [[x, y], [y, x]]) {
        matchIds[self].push(matchId);
        opponents[self].add(other);
      }
      wins[winner]++;
    });

    const rows: RankingRow[] = Array.from({ length: n }, (_, i) => ({
      rank: i + 1,
      profile_id: profileId(b, i),
      display_score: 2000 - i * 10,
      eligible_match_count: matchIds[i].length,
      result_counts: { wins: wins[i], losses: matchIds[i].length - wins[i] },
      opponent_count: opponents[i].size,
      included_match_ids: matchIds[i],
    }));

    return {
      board_id: `board-${b + 1}`,
      label: boards.length === 1 ? 'Player rankings' : `Board ${b + 1}`,
      description: 'Test fixture board.',
      score_definition: { label: 'Ranking score', description: 'Test fixture score.' },
      eligibility: {
        rating: definition('fixture-rating', 'Fixture rating'),
        minimum_rating_value: 1200,
        minimum_eligible_match_count: 1,
        description: 'Test fixture eligibility.',
      },
      rows,
    };
  });

  return {
    schema_version: '1.1',
    deployment_id: 'test-fixture',
    generated_at: '2026-11-20T18:00:00+09:00',
    publication: {
      publication_id: 'pub-fixture',
      label: 'Fixture · 1v1 Rankings',
      description: 'Synthetic leaderboard for tests.',
      competition: definition('comp-fixture', 'Fixture competition'),
      scope: [{ category: definition('killer', 'Killer'), value: definition('fixture', 'The Fixture') }],
    },
    season: {
      season_id: 'season-fixture',
      label: 'Fixture season',
      starts_at: '2026-10-01T00:00:00+09:00',
      ends_at: '2027-01-01T00:00:00+09:00',
    },
    methodology_description: 'Test fixture.',
    boards: rankingBoards,
    profiles,
    result_metrics: [definition('wins', 'Wins'), definition('losses', 'Losses')],
    public_outcomes: [definition('decided', 'Decided')],
    side_definitions: [definition('seat-1', 'Player 1'), definition('seat-2', 'Player 2')],
    role_definitions: [],
    public_facts_schema: {
      schema_id: 'dbd-1v1-symmetric',
      schema_version: '1.0',
      schema_path: '../schemas/dbd-1v1-symmetric-1.0.schema.json',
      documentation_path: '../ranking-evidence-dbd-1v1-symmetric.md',
      description: 'Test fixture facts.',
    },
    included_matches: matches,
  };
}
