// The 1v4 quartet side of the snapshot loader, read from the sample snapshot
// in docs/ref/examples/: per-match results from each board's side, the
// averages shown in the standings, and the evidence checks that fail a build.
import { describe, expect, it } from 'vitest';
import sample from '../../docs/ref/examples/ranking-snapshot-dbd-1v4-quartet.json';
import { loadLeaderboard, type RankingSnapshot } from '../../src/lib/ranking/snapshot';

const fresh = (): RankingSnapshot => structuredClone(sample) as RankingSnapshot;
const standing = (view: ReturnType<typeof loadLeaderboard>, board: number, profileId: string) =>
  view.boards[board].standings.find((s) => s.profile.profile_id === profileId)!;

describe('quartet snapshot', () => {
  const view = loadLeaderboard(fresh());

  it('names the killer board and the survivor party board after what they rank', () => {
    expect(view.format).toBe('quartet');
    expect(view.boards.map((b) => [b.unit.other, b.opponentUnit.other])).toEqual([
      ['killers', 'survivor parties'],
      ['survivor parties', 'killers'],
    ]);
  });

  it('reads each match from the killer side, with draws and gens completed', () => {
    const hush = standing(view, 0, 'p-7a3e');
    expect(hush.matches.map((m) => [m.matchId, m.result, m.facts])).toEqual([
      ['q-04', 'draw', { format: 'quartet', generatorsCompleted: 5, hookStages: 7 }],
      ['q-03', 'won', { format: 'quartet', generatorsCompleted: 5, hookStages: 10 }],
      ['q-02', 'lost', { format: 'quartet', generatorsCompleted: 5, hookStages: 4 }],
      ['q-01', 'won', { format: 'quartet', generatorsCompleted: 3, hookStages: 12 }],
    ]);
    expect(hush.wins).toBe(2);
    expect(hush.winRate).toBe(0.5);
    expect(hush.averages).toEqual({ generatorsCompleted: 4.5, hookStages: 8.25 });
  });

  it('reads the same match the other way round from the survivor side', () => {
    const fog = standing(view, 1, 'g-8b4a');
    const q01 = fog.matches.find((m) => m.matchId === 'q-01')!;
    expect(q01.result).toBe('lost');
    expect(q01.opponent.profile_id).toBe('p-7a3e');
    expect(fog.wins).toBe(3);
    expect(fog.winRate).toBe(0.75);
  });

  it('links each opponent to their row on the other board', () => {
    const hush = standing(view, 0, 'p-7a3e');
    expect(hush.matches.find((m) => m.matchId === 'q-01')!.opponentAnchor).toBe('standing-2-1');
    const fog = standing(view, 1, 'g-8b4a');
    expect(fog.matches.find((m) => m.matchId === 'q-01')!.opponentAnchor).toBe('standing-1-1');
  });

  it('numbers repeat encounters and leaves an undated match last', () => {
    const fog = standing(view, 1, 'g-8b4a');
    expect(fog.matches.filter((m) => m.opponent.profile_id === 'p-7a3e').map((m) => m.encounterIndex)).toEqual([2, 1]);
    const wisp = standing(view, 0, 'p-3d6f');
    expect(wisp.matches.at(-1)).toMatchObject({ matchId: 'q-09', playedAt: null });
  });
});

describe('quartet evidence checks', () => {
  const facts = (snapshot: RankingSnapshot, matchId: string) =>
    snapshot.included_matches.find((m) => m.match_id === matchId)!.public_facts as Record<string, unknown>;

  it('rejects facts that break the value rules', () => {
    const s = fresh();
    // A survivor win with two generators left (evidence §2.2).
    Object.assign(facts(s, 'q-02'), { generators_remaining: 2, kills: 4, hooks: 12 });
    expect(() => loadLeaderboard(s)).toThrow(/survivor win with 2 generators remaining/);
  });

  it('rejects hooks and kills that cannot go together', () => {
    const s = fresh();
    facts(s, 'q-01').hooks = 5;
    expect(() => loadLeaderboard(s)).toThrow(/hooks and kills are inconsistent/);
  });

  it('rejects a draw filed under the decided outcome', () => {
    const s = fresh();
    s.included_matches.find((m) => m.match_id === 'q-04')!.outcome_id = 'decided';
    expect(() => loadLeaderboard(s)).toThrow(/disagrees with the other/);
  });

  it('rejects a survivor party ranked on the killer board', () => {
    const s = fresh();
    [s.boards[0], s.boards[1]] = [s.boards[1], s.boards[0]];
    expect(() => loadLeaderboard(s)).toThrow(/on the killer board must be a participant profile/);
  });

  it('rejects result counts that do not add up to the match count', () => {
    const s = fresh();
    s.boards[0].rows[0].result_counts.draws = 2;
    expect(() => loadLeaderboard(s)).toThrow(/do not add up/);
  });
});
