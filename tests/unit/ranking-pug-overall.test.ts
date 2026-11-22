// The overall 1v4 PUG side of the snapshot loader, read from the sample
// snapshot in docs/ref/examples/: one survivor board across every killer
// character, killer players only as match opponents, and the evidence checks
// that fail a build.
import { describe, expect, it } from 'vitest';
import sample from '../../docs/ref/examples/ranking-snapshot-dbd-1v4-pug-survivors-overall.json';
import { loadLeaderboard, type RankingSnapshot } from '../../src/lib/ranking/snapshot';

const fresh = (): RankingSnapshot => structuredClone(sample) as RankingSnapshot;
const standing = (view: ReturnType<typeof loadLeaderboard>, profileId: string) =>
  view.boards[0].standings.find((s) => s.profile.profile_id === profileId)!;
const match = (s: ReturnType<typeof standing>, matchId: string) => s.matches.find((m) => m.matchId === matchId)!;
const facts = (snapshot: RankingSnapshot, matchId: string) =>
  snapshot.included_matches.find((m) => m.match_id === matchId)!.public_facts as Record<string, unknown>;

describe('PUG overall snapshot', () => {
  const view = loadLeaderboard(fresh());

  it('ranks individual survivors on one board that names each match’s killer character', () => {
    expect(view.format).toBe('pug-overall');
    expect(view.boards.map((b) => [b.unit.other, b.opponentUnit.other, b.hasTeammates, b.showsQueues, b.showsKillerCharacter])).toEqual([
      ['survivors', 'killers', true, true, true],
    ]);
    expect(view.boards[0].eligibility?.minimum_eligible_match_count).toBe(6);
  });

  it('reads the killer character, generators and hook stages of each match', () => {
    const aster = standing(view, 'p-1a4b');
    expect(match(aster, 'pug-overall-02')).toMatchObject({
      result: 'won',
      facts: {
        format: '1v4',
        generatorsCompleted: 5,
        hookStages: 5,
        killerCharacter: { id: 'blight', label: 'The Blight' },
      },
    });
    expect(match(aster, 'pug-overall-01').facts).toMatchObject({ killerCharacter: { id: 'nurse' } });
  });

  it('shows the killer player as an unlinked opponent and teammates by queue', () => {
    const aster = standing(view, 'p-1a4b');
    const m = match(aster, 'pug-overall-02');
    expect(m.opponents).toHaveLength(1);
    expect(m.opponents[0].members[0]).toMatchObject({ profile: { display_name: 'Wisp' }, anchor: null });
    expect(m.teammates.map((u) => [u.partySize, u.own, u.members.map((x) => x.profile.display_name)])).toEqual([
      [2, true, ['Jun']],
      [null, false, ['葵']],
      [null, false, ['Sora']],
    ]);
    expect(m.teammates[0].members[0].anchor).toBe('standing-1-2');
  });

  it('counts a survivor’s side results across every killer', () => {
    const aster = standing(view, 'p-1a4b');
    expect(aster.matches).toHaveLength(17);
    expect(aster.wins).toBe(9);
    expect(aster.averages).not.toBeNull();
  });
});

describe('PUG overall evidence checks', () => {
  it('rejects a match without a killer character', () => {
    const s = fresh();
    delete facts(s, 'pug-overall-03').killer_character;
    expect(() => loadLeaderboard(s)).toThrow(/killer_character is missing or malformed/);
  });

  it('rejects one character ID defined two ways', () => {
    const s = fresh();
    facts(s, 'pug-overall-05').killer_character = { id: 'nurse', label: 'The Blight', description: 'Wrong.' };
    expect(() => loadLeaderboard(s)).toThrow(/defines killer character "nurse" differently/);
  });

  it('rejects a scoped publication', () => {
    const s = fresh();
    s.publication.scope = [
      {
        category: { id: 'killer', label: 'Killer', description: 'x' },
        value: { id: 'nurse', label: 'The Nurse', description: 'x' },
      },
    ];
    expect(() => loadLeaderboard(s)).toThrow(/covers every killer, so its scope is empty/);
  });

  it('rejects a killer board', () => {
    const s = fresh();
    s.boards.unshift(structuredClone(s.boards[0]));
    expect(() => loadLeaderboard(s)).toThrow(/has a survivor board$/);
  });

  it('rejects a survivor win with generators left', () => {
    const s = fresh();
    facts(s, 'pug-overall-02').generators_remaining = 3;
    expect(() => loadLeaderboard(s)).toThrow(/survivor win with 3 generators remaining/);
  });
});
