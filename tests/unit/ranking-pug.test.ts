// The 1v4 PUG side of the snapshot loader, read from the sample snapshot in
// docs/ref/examples/: individual killer and survivor boards, each match's
// survivors grouped by how they queued, and the evidence checks that fail a
// build.
import { describe, expect, it } from 'vitest';
import sample from '../../docs/ref/examples/ranking-snapshot-dbd-1v4-pug.json';
import { loadLeaderboard, type QueueUnit, type RankingSnapshot } from '../../src/lib/ranking/snapshot';

const fresh = (): RankingSnapshot => structuredClone(sample) as RankingSnapshot;
const standing = (view: ReturnType<typeof loadLeaderboard>, board: number, profileId: string) =>
  view.boards[board].standings.find((s) => s.profile.profile_id === profileId)!;
const match = (s: ReturnType<typeof standing>, matchId: string) => s.matches.find((m) => m.matchId === matchId)!;
/** Queue units as [label, member names]: "solo", or the party size with "own" for the row's party. */
const queues = (units: QueueUnit[]) =>
  units.map((u) => [
    u.partySize === null ? 'solo' : `${u.partySize}${u.own ? ' own' : ''}`,
    u.members.map((m) => m.profile.display_name),
  ]);

describe('PUG snapshot', () => {
  const view = loadLeaderboard(fresh());

  it('ranks individual killers and survivors on separate boards', () => {
    expect(view.format).toBe('pug');
    expect(view.boards.map((b) => [b.unit.other, b.opponentUnit.other, b.hasTeammates, b.showsQueues])).toEqual([
      ['killers', 'survivors', false, true],
      ['survivors', 'killers', true, true],
    ]);
  });

  it('reads eligibility from the DBD ranking extension', () => {
    expect(view.boards.map((b) => b.eligibility?.minimum_eligible_match_count)).toEqual([11, 6]);
  });

  it('counts wins, win rate and averages from the killer side', () => {
    const hush = standing(view, 0, 'p-7a3e');
    expect(hush.matches).toHaveLength(11);
    expect(hush.wins).toBe(4);
    expect(hush.winRate).toBeCloseTo(4 / 11);
    expect(match(hush, 'pug-01')).toMatchObject({
      result: 'won',
      facts: { format: '1v4', generatorsCompleted: 2, hookStages: 12 },
    });
    expect(match(hush, 'pug-03').result).toBe('draw');
  });

  it('groups a killer’s opponents by party, then solo survivors', () => {
    const hush = standing(view, 0, 'p-7a3e');
    expect(queues(match(hush, 'pug-01').opponents)).toEqual([
      ['solo', ['Aster']],
      ['solo', ['Jun']],
      ['solo', ['Lark']],
      ['solo', ['Ren']],
    ]);
    expect(queues(match(hush, 'pug-03').opponents)).toEqual([
      ['2', ['Aster', 'Lark']],
      ['2', ['Ren', '葵']],
    ]);
    expect(match(hush, 'pug-03').teammates).toEqual([]);
    const wisp = standing(view, 0, 'p-3d6f');
    expect(queues(match(wisp, 'pug-04').opponents)).toEqual([
      ['3', ['Jun', 'Lark', '葵']],
      ['solo', ['Sora']],
    ]);
  });

  it('links survivors to their own board and killers to the killer board', () => {
    const hush = standing(view, 0, 'p-7a3e');
    expect(match(hush, 'pug-01').opponents[0].members[0].anchor).toBe('standing-2-1');
    const aster = standing(view, 1, 'p-1a4b');
    const pug02 = match(aster, 'pug-02');
    expect(pug02.opponents[0].members[0].anchor).toBe('standing-1-2');
    expect(pug02.teammates[0].members[0].anchor).toBe('standing-2-2');
  });

  it('lists a survivor’s teammates with their own party first, without them', () => {
    const aster = standing(view, 1, 'p-1a4b');
    expect(queues(match(aster, 'pug-02').teammates)).toEqual([
      ['2 own', ['Jun']],
      ['solo', ['葵']],
      ['solo', ['Sora']],
    ]);
    expect(queues(match(aster, 'pug-03').teammates)).toEqual([
      ['2 own', ['Lark']],
      ['2', ['Ren', '葵']],
    ]);
    expect(queues(match(aster, 'pug-05').teammates)).toEqual([['4 own', ['Jun', 'Lark', 'Ren']]]);
    const sora = standing(view, 1, 'p-6f9a');
    expect(queues(match(sora, 'pug-04').teammates)).toEqual([['3', ['Jun', 'Lark', '葵']]]);
  });

  it('counts a survivor’s side result and leaves repeat encounters unnumbered', () => {
    const aster = standing(view, 1, 'p-1a4b');
    expect(aster.wins).toBe(9);
    expect(match(aster, 'pug-01').result).toBe('lost');
    expect(aster.matches.every((m) => m.encounterTotal === 0)).toBe(true);
  });
});

describe('PUG evidence checks', () => {
  const facts = (snapshot: RankingSnapshot, matchId: string) =>
    snapshot.included_matches.find((m) => m.match_id === matchId)!.public_facts as Record<string, unknown>;

  it('rejects a survivor missing from the party and solo lists', () => {
    const s = fresh();
    facts(s, 'pug-02').solo_survivor_profile_ids = ['p-5e8f'];
    expect(() => loadLeaderboard(s)).toThrow(/name each survivor exactly once/);
  });

  it('rejects a survivor listed both in a party and as a solo', () => {
    const s = fresh();
    facts(s, 'pug-02').solo_survivor_profile_ids = ['p-5e8f', 'p-6f9a', 'p-1a4b'];
    expect(() => loadLeaderboard(s)).toThrow(/name each survivor exactly once/);
  });

  it('rejects a party of one', () => {
    const s = fresh();
    facts(s, 'pug-02').survivor_parties = [{ member_profile_ids: ['p-1a4b'] }];
    facts(s, 'pug-02').solo_survivor_profile_ids = ['p-2b5c', 'p-5e8f', 'p-6f9a'];
    expect(() => loadLeaderboard(s)).toThrow(/two to four members/);
  });

  it('rejects a survivor win with generators left', () => {
    const s = fresh();
    facts(s, 'pug-02').generators_remaining = 3;
    expect(() => loadLeaderboard(s)).toThrow(/survivor win with 3 generators remaining/);
  });

  it('rejects a survivor side without four survivors', () => {
    const s = fresh();
    s.included_matches.find((m) => m.match_id === 'pug-01')!.sides[1].participants.pop();
    expect(() => loadLeaderboard(s)).toThrow(/survivors side must have 4 distinct participants/);
  });

  it('rejects result counts that do not add up to the included matches', () => {
    const s = fresh();
    s.boards[1].rows[0].result_counts.draws = 0;
    expect(() => loadLeaderboard(s)).toThrow(/do not add up/);
  });

  it('rejects eligibility published without an extension', () => {
    const s = fresh();
    delete s.extension_schema;
    expect(() => loadLeaderboard(s)).toThrow(/eligibility without an extension_schema/);
  });
});
