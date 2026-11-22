// Ranking snapshot loader for the sample leaderboard previews.
//
// A snapshot is one published fixture in docs/ref/examples/ (collected by
// ./publications.ts). It is read as is: the public contracts are
// docs/ref/ranking-system-data-schema.md (the envelope, 1.x or 2.0; a 2.0
// snapshot's eligibility and eligible_match_count come from the DBD ranking
// extension, docs/ref/ranking-extension-dbd-1.0.md) and, for the per-match
// facts, one of
//   - docs/ref/ranking-evidence-dbd-1v1-symmetric.md (symmetric 1v1 duels),
//   - docs/ref/ranking-evidence-dbd-1v4-quartet.md (one killer against one
//     survivor party of four), or
//   - docs/ref/ranking-evidence-dbd-1v4-pug.md (one killer against four
//     individually ranked survivors, who queue solo or in parties), or
//   - docs/ref/ranking-evidence-dbd-1v4-pug-overall.md (the same matches
//     across every killer character, with a survivor board only and the
//     character each match was played with).
// Nothing here recalculates the ranking. The loader only resolves references
// and turns each row's included matches into a view from that row's side. A
// broken reference fails the build instead of rendering a wrong page.
//
// IDs are opaque (envelope §2): they are compared exactly and never parsed.

// ---- Envelope types (ranking-system-data-schema.md) ----

export interface PublicDefinition {
  id: string;
  label: string;
  description: string;
}

export interface RankingRow {
  rank: number;
  profile_id: string;
  display_score: number;
  /** Envelope 1.x field; in 2.0 a field of the DBD ranking extension. Not read. */
  eligible_match_count?: number;
  result_counts: Record<string, number>;
  opponent_count: number;
  included_match_ids: string[];
}

/**
 * Envelope 1.x `PublicEligibilityRequirements`; in 2.0 the same shape is
 * defined by the DBD ranking extension (`dbd-ranking` 1.x).
 */
export interface DbdEligibility {
  rating: PublicDefinition;
  minimum_rating_value: number;
  minimum_eligible_match_count: number;
  description: string;
}

export interface RankingBoard {
  board_id: string;
  label: string;
  description: string;
  score_definition: { label: string; description: string };
  /** Required in envelope 1.x. In 2.0 optional, with children owned by the extension. */
  eligibility?: DbdEligibility | Record<string, unknown>;
  rows: RankingRow[];
}

export interface PublicSchemaReference {
  schema_id: string;
  schema_version: string;
  schema_path: string;
  documentation_path: string;
  description: string;
}

export interface PublicRankingProfile {
  profile_id: string;
  kind: 'participant' | 'group';
  display_name: string;
  group_members: { profile_id: string; display_name: string }[] | null;
}

export interface IncludedMatchEvidence {
  match_id: string;
  sides: {
    side_id: string;
    participants: { profile_id: string; role_ids: string[] }[];
  }[];
  outcome_id: string;
  /** Envelope 1.1: required key, null when unknown. Absent in 1.0 snapshots. */
  played_at?: string | null;
  public_facts: unknown;
}

export interface RankingSnapshot {
  schema_version: string;
  deployment_id: string;
  generated_at: string;
  publication: {
    publication_id: string;
    label: string;
    description: string;
    competition: PublicDefinition;
    scope: { category: PublicDefinition; value: PublicDefinition }[];
  };
  season: { season_id: string; label: string; starts_at: string; ends_at: string };
  methodology_description: string;
  boards: RankingBoard[];
  profiles: PublicRankingProfile[];
  result_metrics: PublicDefinition[];
  public_outcomes: PublicDefinition[];
  side_definitions: PublicDefinition[];
  role_definitions: PublicDefinition[];
  public_facts_schema: PublicSchemaReference;
  /** Envelope 2.0 only: the extension that defines eligibility and extra row fields. */
  extension_schema?: PublicSchemaReference;
  included_matches: IncludedMatchEvidence[];
}

// ---- Evidence facts ----

/** ranking-evidence-dbd-1v1-symmetric.md §2.1 */
interface DbdSymmetricFacts {
  winner_side_id: string;
  rounds_won_by_side: Record<string, number>;
}

/** ranking-evidence-dbd-1v4-quartet.md §2.1 */
interface DbdQuartetFacts {
  winner_side_id: string | null;
  generators_remaining: number;
  hooks: number;
  kills: number;
}

/** ranking-evidence-dbd-1v4-pug.md, "Match facts" */
interface DbdPugFacts {
  winner_side_id: string | null;
  generators_remaining: number;
  hooks: number;
  survivor_parties: { member_profile_ids: string[] }[];
  solo_survivor_profile_ids: string[];
}

/** ranking-evidence-dbd-1v4-pug-overall.md, "Match facts" */
interface DbdPugOverallFacts extends DbdPugFacts {
  killer_character: PublicDefinition;
}

const SUPPORTED_ENVELOPE_MAJORS = ['1', '2'];
/** The extension that defines eligibility in a 2.0 snapshot. */
const DBD_RANKING_EXTENSION = { schemaId: 'dbd-ranking', major: '1' };

/** Which evidence contract a snapshot's matches follow. */
export type LeaderboardFormat = 'symmetric' | 'quartet' | 'pug' | 'pug-overall';

const SUPPORTED_FACTS: Record<string, { format: LeaderboardFormat; major: string }> = {
  'dbd-1v1-symmetric': { format: 'symmetric', major: '1' },
  'dbd-1v4-quartet-match': { format: 'quartet', major: '1' },
  'dbd-1v4-pug-match': { format: 'pug', major: '1' },
  'dbd-1v4-pug-overall-match': { format: 'pug-overall', major: '1' },
};

/** Fixed side IDs of the 1v4 contracts (quartet evidence §3.2, PUG envelope usage). */
const SIDES_1V4 = { killer: 'killer', survivors: 'survivors' } as const;
/** Generators the survivors have to repair to power the exit gates. */
export const GENERATORS_1V4 = 5;
/** Survivors in a 1v4 match. */
const SURVIVORS_1V4 = 4;

// ---- Views consumed by RankingLeaderboard.astro ----

export type MatchResult = 'won' | 'lost' | 'draw';

/** Per-match facts, from the row's side. */
export type MatchFactsView =
  | { format: 'symmetric'; ownRounds: number; opponentRounds: number }
  | {
      /** Quartet and PUG: whole-match generator and hook counts. */
      format: '1v4';
      /** Generators the survivors repaired: 5 minus those left unrepaired. */
      generatorsCompleted: number;
      /** Hook stages the killer performed (evidence `hooks`). */
      hookStages: number;
      /**
       * Killer character the killer side played. Only overall PUG matches
       * publish one; per-killer publications name it once, in their scope.
       */
      killerCharacter?: PublicDefinition;
    };

/** A profile as shown in a match, with its row on this page if it has one. */
export interface ProfileLink {
  profile: PublicRankingProfile;
  /**
   * Anchor of the profile's row on this page, if they have one: on the same
   * board if there, otherwise on another board (the 1v4 killer and survivor
   * boards face each other).
   */
  anchor: string | null;
}

/**
 * One unit of a match side as it queued. On PUG survivor sides a party that
 * queued together, or a solo survivor; everywhere else simply the side's one
 * ranked unit (a player or a quartet party), with `partySize` null.
 */
export interface QueueUnit {
  /** Who is shown. Leaves out the row's own player when the unit is their party. */
  members: ProfileLink[];
  /** PUG parties: everyone who queued together, including a left-out row player. Null when solo or not a PUG queue. */
  partySize: number | null;
  /** This is the row's own party (PUG survivor rows only). */
  own: boolean;
}

export interface PlayerMatchView {
  matchId: string;
  /** Published wall-clock time, or null when the publisher has none. */
  playedAt: string | null;
  /** The other side, by queue unit: parties first, then solo players. */
  opponents: QueueUnit[];
  /**
   * The rest of the row's own side, by queue unit, the row's own party first.
   * Empty unless the format ranks individual players on a multi-player side
   * (PUG survivors).
   */
  teammates: QueueUnit[];
  result: MatchResult;
  facts: MatchFactsView;
  /**
   * 1-based chronological position among this row's matches against the same
   * opponent. Null when any of those matches has no time, because their order
   * is then unknown. Only formats with a single opponent and a repeat-encounter
   * policy number encounters; elsewhere encounterTotal is 0.
   */
  encounterIndex: number | null;
  encounterTotal: number;
}

/** Averages over a 1v4 row's included matches. */
export interface MatchAverages {
  generatorsCompleted: number;
  hookStages: number;
}

export interface StandingView {
  row: RankingRow;
  profile: PublicRankingProfile;
  anchor: string;
  /** Shares its rank with another row on the board. */
  tied: boolean;
  /** Included matches this row won, counted from the match evidence. */
  wins: number;
  /** wins / included matches, 0–1; draws count as not won. Null when the row has no included matches. */
  winRate: number | null;
  /** 1v4 boards only; null elsewhere and for a row with no included matches. */
  averages: MatchAverages | null;
  matches: PlayerMatchView[];
}

/** What a board ranks, in UI English: "player"/"players", "party"/"parties". */
export interface UnitNoun {
  one: string;
  other: string;
}

export interface BoardView {
  board: RankingBoard;
  headingId: string;
  /** What each row is. */
  unit: UnitNoun;
  /** What each row's opponents are. */
  opponentUnit: UnitNoun;
  /** Rows have teammates on their own side (PUG survivors). */
  hasTeammates: boolean;
  /** Survivors on PUG boards queue solo or in parties; show how. */
  showsQueues: boolean;
  /** Each match names the killer character played (overall PUG). */
  showsKillerCharacter: boolean;
  /**
   * Entry requirements, when the snapshot publishes them in a shape this
   * loader understands (envelope 1.x, or 2.0 with the DBD ranking extension).
   */
  eligibility: DbdEligibility | null;
  standings: StandingView[];
}

export interface LeaderboardView {
  snapshot: RankingSnapshot;
  format: LeaderboardFormat;
  boards: BoardView[];
  /** Display names used by more than one profile; show the profile ID too. */
  ambiguousNames: Set<string>;
}

const PLAYER: UnitNoun = { one: 'player', other: 'players' };
const KILLER: UnitNoun = { one: 'killer', other: 'killers' };
const PARTY: UnitNoun = { one: 'survivor party', other: 'survivor parties' };
const SURVIVOR: UnitNoun = { one: 'survivor', other: 'survivors' };

export function fail(message: string): never {
  throw new Error(`[ranking snapshot] ${message}`);
}

function major(version: string): string {
  return version.split('.')[0];
}

function indexBy<T>(items: T[], key: (item: T) => string, what: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const id = key(item);
    if (map.has(id)) fail(`duplicate ${what} "${id}"`);
    map.set(id, item);
  }
  return map;
}

type MatchSide = IncludedMatchEvidence['sides'][number];

function readSymmetricFacts(match: IncludedMatchEvidence): DbdSymmetricFacts {
  const facts = match.public_facts as Partial<DbdSymmetricFacts> | null;
  const sideIds = match.sides.map((s) => s.side_id);
  if (!facts || typeof facts.winner_side_id !== 'string' || !facts.rounds_won_by_side) {
    fail(`match "${match.match_id}" has malformed public_facts`);
  }
  if (!sideIds.includes(facts.winner_side_id)) {
    fail(`match "${match.match_id}" winner_side_id does not name one of its sides`);
  }
  const keys = Object.keys(facts.rounds_won_by_side);
  if (keys.length !== sideIds.length || !sideIds.every((id) => keys.includes(id))) {
    fail(`match "${match.match_id}" rounds_won_by_side keys must be exactly its side IDs`);
  }
  return facts as DbdSymmetricFacts;
}

const isCount = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

/**
 * Winner, generators remaining and hooks, which the quartet and PUG contracts
 * define alike (quartet evidence §2, PUG "Match facts").
 */
function check1v4Outcome(where: string, facts: Partial<DbdPugFacts & DbdQuartetFacts>): void {
  const { winner_side_id: winner, generators_remaining: gens, hooks } = facts;
  if (winner !== null && winner !== SIDES_1V4.killer && winner !== SIDES_1V4.survivors) {
    fail(`${where} winner_side_id must be "killer", "survivors" or null`);
  }
  if (!isCount(gens, GENERATORS_1V4) || !isCount(hooks, 3 * SURVIVORS_1V4)) {
    fail(`${where} generators_remaining or hooks is missing or out of range`);
  }
  if (winner === SIDES_1V4.survivors && gens > 1) fail(`${where} is a survivor win with ${gens} generators remaining`);
  if (winner === SIDES_1V4.killer && hooks < 1) fail(`${where} is a killer win without a hook`);
}

/** Fields, ranges and value rules of quartet evidence §2. */
function readQuartetFacts(match: IncludedMatchEvidence): DbdQuartetFacts {
  const where = `match "${match.match_id}"`;
  const facts = match.public_facts as Partial<DbdQuartetFacts> | null;
  if (!facts || typeof facts !== 'object') fail(`${where} has malformed public_facts`);
  const { generators_remaining: gens, hooks, kills } = facts;
  if (!isCount(kills, SURVIVORS_1V4)) fail(`${where} kills is missing or out of range`);
  check1v4Outcome(where, facts);
  if (hooks! < 3 * kills || kills < hooks! - 8) fail(`${where} hooks and kills are inconsistent`);
  if (gens! > 0 && kills !== 4) fail(`${where} has generators remaining without four kills`);
  return facts as DbdQuartetFacts;
}

const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string');

/**
 * Fields and membership rules of the PUG evidence: every survivor on the
 * match's survivor side appears exactly once, in one party or as a solo.
 */
function readPugFacts(match: IncludedMatchEvidence): DbdPugFacts {
  const where = `match "${match.match_id}"`;
  const facts = match.public_facts as Partial<DbdPugFacts> | null;
  if (!facts || typeof facts !== 'object') fail(`${where} has malformed public_facts`);
  check1v4Outcome(where, facts);
  const { survivor_parties: parties, solo_survivor_profile_ids: solos } = facts;
  if (!Array.isArray(parties) || !isIdList(solos)) {
    fail(`${where} survivor_parties or solo_survivor_profile_ids is missing`);
  }
  for (const party of parties) {
    const members = party?.member_profile_ids;
    if (!isIdList(members) || members.length < 2 || members.length > SURVIVORS_1V4) {
      fail(`${where} has a survivor party without two to four members`);
    }
  }
  const listed = [...parties.flatMap((p) => p.member_profile_ids), ...solos];
  const survivors = match.sides.find((s) => s.side_id === SIDES_1V4.survivors)?.participants.map((p) => p.profile_id) ?? [];
  if (listed.length !== survivors.length || new Set(listed).size !== listed.length || !listed.every((id) => survivors.includes(id))) {
    fail(`${where} party and solo lists must name each survivor exactly once`);
  }
  return facts as DbdPugFacts;
}

// played_at is a required key from envelope 1.1 on; a 1.0 snapshot has none,
// which means every time is unknown (envelope §8).
function readPlayedAt(match: IncludedMatchEvidence, envelopeVersion: string): string | null {
  if (envelopeVersion === '1.0') return null;
  if (!('played_at' in match)) fail(`match "${match.match_id}" is missing played_at`);
  const playedAt = match.played_at ?? null;
  if (playedAt !== null && (typeof playedAt !== 'string' || !TIMESTAMP.test(playedAt))) {
    fail(`match "${match.match_id}" played_at "${playedAt}" is not a timestamp with a UTC offset`);
  }
  return playedAt;
}

/**
 * Newest first by instant (offsets are honoured), matches without a time
 * last. Equal or unknown times keep the published order.
 */
function byPlayedAtDescending(a: PlayerMatchView, b: PlayerMatchView): number {
  if (a.playedAt === null || b.playedAt === null) {
    return (a.playedAt === null ? 1 : 0) - (b.playedAt === null ? 1 : 0);
  }
  return Date.parse(b.playedAt) - Date.parse(a.playedAt);
}

/**
 * How one evidence contract fits the envelope: what each board ranks, and how
 * a match reads from a row's side.
 */
interface FormatProfile {
  /** Checks that need the whole snapshot. */
  checkSnapshot(snapshot: RankingSnapshot): void;
  boardUnits(boardIndex: number): { unit: UnitNoun; opponentUnit: UnitNoun };
  /** Checks one row against its board's role in the contract. */
  checkRow(row: RankingRow, profile: PublicRankingProfile, boardIndex: number): void;
  /** The side a row's profile must take in each of its matches, if fixed. */
  ownSideId(boardIndex: number): string | null;
  /** Rows on this board have teammates on their own side. */
  hasTeammates(boardIndex: number): boolean;
  /** Survivors queue solo or in parties. */
  showsQueues: boolean;
  /** Matches name the killer character played. */
  showsKillerCharacter: boolean;
  /** Repeat encounters against one opponent are numbered (they share a contribution limit). */
  numbersEncounters: boolean;
  /** Checks a match on its own; called once per match. */
  checkMatch(match: IncludedMatchEvidence, profiles: Map<string, PublicRankingProfile>): void;
  /** The match from the side of the row's profile `self`, which is on side `own`. */
  readMatch(match: IncludedMatchEvidence, own: MatchSide, other: MatchSide, self: string): MatchRead;
}

/** A queue unit before its profile IDs are resolved. */
interface QueueIds {
  members: string[];
  partySize: number | null;
  own: boolean;
}

interface MatchRead {
  result: MatchResult;
  facts: MatchFactsView;
  opponents: QueueIds[];
  teammates: QueueIds[];
}

/** The one ranked unit on a side, as a queue unit. */
const singleUnit = (side: MatchSide): QueueIds[] => [{ members: [side.participants[0].profile_id], partySize: null, own: false }];

const symmetricProfile: FormatProfile = {
  checkSnapshot() {},
  boardUnits: () => ({ unit: PLAYER, opponentUnit: PLAYER }),
  checkRow() {},
  ownSideId: () => null,
  hasTeammates: () => false,
  showsQueues: false,
  showsKillerCharacter: false,
  numbersEncounters: true,
  checkMatch(match) {
    if (match.sides.length !== 2 || match.sides.some((s) => s.participants.length !== 1)) {
      fail(`match "${match.match_id}" must have two sides with one participant each`);
    }
    readSymmetricFacts(match);
  },
  readMatch(match, own, other) {
    const facts = readSymmetricFacts(match);
    return {
      // Every duel has exactly one winner (evidence §3.5).
      result: facts.winner_side_id === own.side_id ? 'won' : 'lost',
      facts: {
        format: 'symmetric',
        ownRounds: facts.rounds_won_by_side[own.side_id],
        opponentRounds: facts.rounds_won_by_side[other.side_id],
      },
      opponents: singleUnit(other),
      teammates: [],
    };
  },
};

// Quartet evidence §3: the killer board comes first and ranks killer players,
// the survivor board second and ranks survivor parties (groups).
const QUARTET_BOARDS = [
  { side: SIDES_1V4.killer, kind: 'participant', unit: KILLER, opponentUnit: PARTY },
  { side: SIDES_1V4.survivors, kind: 'group', unit: PARTY, opponentUnit: KILLER },
] as const;

// PUG envelope usage: the killer board first, then the survivor board; both
// rank individual players.
const PUG_BOARDS = [
  { side: SIDES_1V4.killer, kind: 'participant', unit: KILLER, opponentUnit: SURVIVOR },
  { side: SIDES_1V4.survivors, kind: 'participant', unit: SURVIVOR, opponentUnit: KILLER },
] as const;

// Overall PUG envelope usage: one board, of individual survivors. Killer
// players appear in matches only.
const PUG_OVERALL_BOARDS = [
  { side: SIDES_1V4.survivors, kind: 'participant', unit: SURVIVOR, opponentUnit: KILLER },
] as const;

type Board1v4 =
  | (typeof QUARTET_BOARDS)[number]
  | (typeof PUG_BOARDS)[number]
  | (typeof PUG_OVERALL_BOARDS)[number];

/**
 * What the quartet and PUG contracts share: the killer and survivors sides,
 * one board per ranked side, wins/losses/draws counted from the row's side,
 * and outcome IDs that consistently mean decided or draw. `scoped` is whether
 * the publication is scoped to one killer (per-killer) or covers them all
 * (overall PUG, with an empty scope).
 */
function oneVFourChecks(name: string, boards: readonly Board1v4[], scoped = true) {
  // A side without a board of its own is individual players (overall PUG killers).
  const kindOf = (sideId: string) => boards.find((b) => b.side === sideId)?.kind ?? 'participant';
  // Outcome IDs are the publication's choice (quartet §3.4); learn which one
  // means "decided" and which "draw" from the matches and require them to agree.
  const outcomeOf: { decided?: string; draw?: string } = {};
  return {
    checkSnapshot(snapshot: RankingSnapshot) {
      const sideIds = snapshot.side_definitions.map((s) => s.id);
      if (sideIds.length !== 2 || sideIds[0] !== SIDES_1V4.killer || sideIds[1] !== SIDES_1V4.survivors) {
        fail(`a ${name} snapshot defines exactly the sides "killer" and "survivors"`);
      }
      if (snapshot.boards.length !== boards.length) {
        fail(`a ${name} snapshot has ${boards.map((b) => `a ${b.unit.one} board`).join(' and ')}`);
      }
      if (scoped && snapshot.publication.scope.length !== 1) fail(`a ${name} snapshot is scoped to exactly one killer`);
      if (!scoped && snapshot.publication.scope.length !== 0) fail(`a ${name} snapshot covers every killer, so its scope is empty`);
      if (snapshot.result_metrics.length !== 3) fail(`a ${name} snapshot defines wins, losses and draws`);
    },
    boardUnits: (boardIndex: number) => boards[boardIndex],
    checkRow(row: RankingRow, profile: PublicRankingProfile, boardIndex: number) {
      const { kind, unit } = boards[boardIndex];
      if (profile.kind !== kind) fail(`row "${row.profile_id}" on the ${unit.one} board must be a ${kind} profile`);
      const total = Object.values(row.result_counts).reduce((a, b) => a + b, 0);
      if (total !== row.included_match_ids.length) {
        fail(`row "${row.profile_id}" result_counts do not add up to its included matches`);
      }
    },
    ownSideId: (boardIndex: number) => boards[boardIndex].side,
    /** Side order, side sizes and profile kinds; returns the two sides. */
    checkSides(match: IncludedMatchEvidence, profiles: Map<string, PublicRankingProfile>, survivorCount: number) {
      const where = `match "${match.match_id}"`;
      const [killer, survivors] = match.sides;
      if (match.sides.length !== 2 || killer.side_id !== SIDES_1V4.killer || survivors.side_id !== SIDES_1V4.survivors) {
        fail(`${where} must list the killer side, then the survivors side`);
      }
      for (const [side, size] of [[killer, 1], [survivors, survivorCount]] as const) {
        const kind = kindOf(side.side_id);
        const ids = side.participants.map((p) => p.profile_id);
        if (ids.length !== size || new Set(ids).size !== size) {
          fail(`${where} ${side.side_id} side must have ${size === 1 ? 'one participant' : `${size} distinct participants`}`);
        }
        for (const id of ids) {
          const profile = profiles.get(id);
          if (profile && profile.kind !== kind) fail(`${where} ${side.side_id} side must be ${kind} profiles`);
        }
      }
    },
    checkOutcomeId(match: IncludedMatchEvidence, winner: string | null) {
      const outcome = winner === null ? 'draw' : 'decided';
      outcomeOf[outcome] ??= match.outcome_id;
      if (outcomeOf[outcome] !== match.outcome_id || outcomeOf.decided === outcomeOf.draw) {
        fail(`match "${match.match_id}" outcome_id "${match.outcome_id}" disagrees with the other ${outcome === 'draw' ? 'drawn' : 'decided'} matches`);
      }
    },
  };
}

function resultFor(winner: string | null, own: MatchSide): MatchResult {
  return winner === null ? 'draw' : winner === own.side_id ? 'won' : 'lost';
}

function facts1v4(
  facts: { generators_remaining: number; hooks: number },
  killerCharacter: PublicDefinition | null = null,
): MatchFactsView {
  return {
    format: '1v4',
    generatorsCompleted: GENERATORS_1V4 - facts.generators_remaining,
    hookStages: facts.hooks,
    ...(killerCharacter && { killerCharacter }),
  };
}

function quartetProfile(): FormatProfile {
  const shared = oneVFourChecks('quartet', QUARTET_BOARDS);
  return {
    ...shared,
    hasTeammates: () => false,
    showsQueues: false,
    showsKillerCharacter: false,
    numbersEncounters: true,
    checkMatch(match, profiles) {
      shared.checkSides(match, profiles, 1);
      shared.checkOutcomeId(match, readQuartetFacts(match).winner_side_id);
    },
    readMatch(match, own, other) {
      const facts = readQuartetFacts(match);
      return {
        result: resultFor(facts.winner_side_id, own),
        facts: facts1v4(facts),
        opponents: singleUnit(other),
        teammates: [],
      };
    },
  };
}

/**
 * The survivor side of a PUG match as it queued: parties (largest first, then
 * as published), then solo survivors. `self` is the row's own player when the
 * row is a survivor: their party comes first, marked own, without them.
 */
function pugQueues(facts: DbdPugFacts, self: string | null): QueueIds[] {
  const parties = facts.survivor_parties
    .map((p) => p.member_profile_ids)
    .map((ids) => ({ ids, own: self !== null && ids.includes(self) }))
    .sort((a, b) => Number(b.own) - Number(a.own) || b.ids.length - a.ids.length);
  return [
    ...parties.map(({ ids, own }) => ({ members: ids.filter((id) => id !== self), partySize: ids.length, own })),
    ...facts.solo_survivor_profile_ids.filter((id) => id !== self).map((id) => ({ members: [id], partySize: null, own: false })),
  ];
}

/** A PUG match from the row's side, with the character played if the facts name one. */
function readPugMatch(
  facts: DbdPugFacts,
  killerCharacter: PublicDefinition | null,
  own: MatchSide,
  other: MatchSide,
  self: string,
): MatchRead {
  const survivorRow = own.side_id === SIDES_1V4.survivors;
  return {
    result: resultFor(facts.winner_side_id, own),
    facts: facts1v4(facts, killerCharacter),
    opponents: survivorRow ? singleUnit(other) : pugQueues(facts, null),
    teammates: survivorRow ? pugQueues(facts, self) : [],
  };
}

function pugProfile(): FormatProfile {
  const shared = oneVFourChecks('PUG', PUG_BOARDS);
  return {
    ...shared,
    hasTeammates: (boardIndex) => PUG_BOARDS[boardIndex].side === SIDES_1V4.survivors,
    showsQueues: true,
    showsKillerCharacter: false,
    // No repeat-encounter policy applies, and a killer meets four survivors at once.
    numbersEncounters: false,
    checkMatch(match, profiles) {
      shared.checkSides(match, profiles, SURVIVORS_1V4);
      shared.checkOutcomeId(match, readPugFacts(match).winner_side_id);
    },
    readMatch: (match, own, other, self) => readPugMatch(readPugFacts(match), null, own, other, self),
  };
}

const isDefinition = (value: unknown): value is PublicDefinition => {
  const d = value as Partial<PublicDefinition> | null;
  return !!d && typeof d === 'object' && [d.id, d.label, d.description].every((v) => typeof v === 'string' && v !== '');
};

/** PUG facts plus the killer character (overall PUG evidence, "Match facts"). */
function readPugOverallFacts(match: IncludedMatchEvidence): DbdPugOverallFacts {
  const facts = readPugFacts(match) as Partial<DbdPugOverallFacts>;
  if (!isDefinition(facts.killer_character)) fail(`match "${match.match_id}" killer_character is missing or malformed`);
  return facts as DbdPugOverallFacts;
}

function pugOverallProfile(): FormatProfile {
  const shared = oneVFourChecks('PUG overall', PUG_OVERALL_BOARDS, false);
  // Repeated definitions of one character ID must agree.
  const characters = new Map<string, PublicDefinition>();
  return {
    ...shared,
    hasTeammates: () => true,
    showsQueues: true,
    showsKillerCharacter: true,
    // As on the per-killer PUG boards: no repeat-encounter policy applies.
    numbersEncounters: false,
    checkMatch(match, profiles) {
      shared.checkSides(match, profiles, SURVIVORS_1V4);
      const facts = readPugOverallFacts(match);
      shared.checkOutcomeId(match, facts.winner_side_id);
      const { id, label, description } = facts.killer_character;
      const known = characters.get(id);
      if (known && (known.label !== label || known.description !== description)) {
        fail(`match "${match.match_id}" defines killer character "${id}" differently from an earlier match`);
      }
      characters.set(id, { id, label, description });
    },
    readMatch(match, own, other, self) {
      const facts = readPugOverallFacts(match);
      return readPugMatch(facts, facts.killer_character, own, other, self);
    },
  };
}

const formatProfiles: Record<LeaderboardFormat, () => FormatProfile> = {
  symmetric: () => symmetricProfile,
  quartet: quartetProfile,
  pug: pugProfile,
  'pug-overall': pugOverallProfile,
};

/**
 * A board's entry requirements, when published in a shape this loader knows:
 * required in envelope 1.x; in 2.0 only with the DBD ranking extension.
 */
function readEligibility(snapshot: RankingSnapshot, board: RankingBoard): DbdEligibility | null {
  const where = `board "${board.board_id}"`;
  if (major(snapshot.schema_version) === '1') {
    if (!board.eligibility) fail(`${where} is missing eligibility`);
  } else {
    const ext = snapshot.extension_schema;
    if (board.eligibility !== undefined && !ext) fail(`${where} publishes eligibility without an extension_schema`);
    if (!ext || ext.schema_id !== DBD_RANKING_EXTENSION.schemaId || major(ext.schema_version) !== DBD_RANKING_EXTENSION.major) {
      return null;
    }
    if (!board.eligibility) return null;
  }
  const e = board.eligibility as Partial<DbdEligibility>;
  if (
    !e.rating ||
    typeof e.rating.label !== 'string' ||
    typeof e.minimum_rating_value !== 'number' ||
    typeof e.minimum_eligible_match_count !== 'number' ||
    typeof e.description !== 'string'
  ) {
    fail(`${where} eligibility is malformed`);
  }
  return e as DbdEligibility;
}

const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export function loadLeaderboard(snapshot: RankingSnapshot): LeaderboardView {
  if (!SUPPORTED_ENVELOPE_MAJORS.includes(major(snapshot.schema_version))) {
    fail(`unsupported envelope schema_version "${snapshot.schema_version}"`);
  }
  const factsSchema = snapshot.public_facts_schema;
  const supported = SUPPORTED_FACTS[factsSchema.schema_id];
  if (!supported || major(factsSchema.schema_version) !== supported.major) {
    fail(`unsupported public_facts_schema ${factsSchema.schema_id}@${factsSchema.schema_version}`);
  }
  const { format } = supported;
  const contract = formatProfiles[format]();
  contract.checkSnapshot(snapshot);

  const profiles = indexBy(snapshot.profiles, (p) => p.profile_id, 'profile');
  const matches = indexBy(snapshot.included_matches, (m) => m.match_id, 'match');
  const sides = indexBy(snapshot.side_definitions, (s) => s.id, 'side definition');
  for (const match of snapshot.included_matches) {
    for (const side of match.sides) {
      if (!sides.has(side.side_id)) fail(`match "${match.match_id}" uses unknown side "${side.side_id}"`);
    }
    contract.checkMatch(match, profiles);
  }

  const nameCounts = new Map<string, number>();
  for (const p of snapshot.profiles) {
    nameCounts.set(p.display_name, (nameCounts.get(p.display_name) ?? 0) + 1);
  }
  const ambiguousNames = new Set([...nameCounts].filter(([, n]) => n > 1).map(([name]) => name));

  // Row anchors, per board. A profile link goes to the profile's row on the
  // same board if there is one, otherwise to their row on another board (the
  // 1v4 killers and survivors face each other across the two boards).
  const anchorsByBoard = snapshot.boards.map(
    (board, boardIndex) =>
      new Map(board.rows.map((row, rowIndex) => [row.profile_id, `standing-${boardIndex + 1}-${rowIndex + 1}`])),
  );
  const anyAnchor = new Map<string, string>();
  for (const anchors of anchorsByBoard) for (const [id, anchor] of anchors) if (!anyAnchor.has(id)) anyAnchor.set(id, anchor);

  const boards = snapshot.boards.map((board, boardIndex): BoardView => {
    const anchorOf = anchorsByBoard[boardIndex];
    const ownSideId = contract.ownSideId(boardIndex);
    const rankCounts = new Map<number, number>();
    for (const row of board.rows) rankCounts.set(row.rank, (rankCounts.get(row.rank) ?? 0) + 1);

    const standings = board.rows.map((row): StandingView => {
      const profile = profiles.get(row.profile_id) ?? fail(`row profile "${row.profile_id}" is not in profiles`);

      const metricIds = Object.keys(row.result_counts);
      if (
        metricIds.length !== snapshot.result_metrics.length ||
        !snapshot.result_metrics.every((m) => metricIds.includes(m.id))
      ) {
        fail(`row "${row.profile_id}" result_counts keys must be exactly result_metrics ids`);
      }
      contract.checkRow(row, profile, boardIndex);

      const link = (id: string, matchId: string): ProfileLink => ({
        profile: profiles.get(id) ?? fail(`match "${matchId}" references unknown profile "${id}"`),
        anchor: anchorOf.get(id) ?? anyAnchor.get(id) ?? null,
      });
      const resolve = (units: QueueIds[], matchId: string): QueueUnit[] =>
        units.map((u) => ({ ...u, members: u.members.map((id) => link(id, matchId)) }));

      const views = row.included_match_ids.map((matchId): PlayerMatchView => {
        const match = matches.get(matchId) ?? fail(`row "${row.profile_id}" references unknown match "${matchId}"`);
        const own = match.sides.find((s) => s.participants.some((p) => p.profile_id === row.profile_id));
        const other = match.sides.find((s) => s !== own);
        if (!own || !other) fail(`row "${row.profile_id}" does not appear in match "${matchId}"`);
        if (ownSideId !== null && own.side_id !== ownSideId) {
          fail(`row "${row.profile_id}" must be on the ${ownSideId} side of match "${matchId}"`);
        }
        const { opponents, teammates, ...read } = contract.readMatch(match, own, other, row.profile_id);
        return {
          matchId,
          playedAt: readPlayedAt(match, snapshot.schema_version),
          opponents: resolve(opponents, matchId),
          teammates: resolve(teammates, matchId),
          ...read,
          encounterIndex: 0,
          encounterTotal: 0,
        };
      });

      // Show the most recent match first. played_at is informational: it
      // orders this evidence list only and never affects ranks (envelope §6.1).
      views.sort(byPlayedAtDescending);

      // Number repeat encounters so a reader can see the same opponent twice
      // is intentional evidence, not a duplicated record. Numbering is
      // chronological, so it is left out when any of the matches has no time.
      const perOpponent = new Map<string, PlayerMatchView[]>();
      for (const v of contract.numbersEncounters ? views : []) {
        const opponentId = v.opponents[0].members[0].profile.profile_id;
        const list = perOpponent.get(opponentId) ?? [];
        list.push(v);
        perOpponent.set(opponentId, list);
      }
      for (const list of perOpponent.values()) {
        const ordered = list.every((v) => v.playedAt !== null);
        list.forEach((v, i) => {
          v.encounterIndex = ordered ? list.length - i : null;
          v.encounterTotal = list.length;
        });
      }

      // Wins and the win rate follow from the evidence itself. The
      // publication's result_metrics IDs are its own choice, so they are not
      // used to find the win count.
      const wins = views.filter((v) => v.result === 'won').length;
      const matchFacts = views.flatMap((v) => (v.facts.format === '1v4' ? [v.facts] : []));

      return {
        row,
        profile,
        anchor: anchorOf.get(row.profile_id)!,
        tied: (rankCounts.get(row.rank) ?? 0) > 1,
        wins,
        winRate: views.length > 0 ? wins / views.length : null,
        averages:
          matchFacts.length > 0
            ? {
                generatorsCompleted: average(matchFacts.map((f) => f.generatorsCompleted)),
                hookStages: average(matchFacts.map((f) => f.hookStages)),
              }
            : null,
        matches: views,
      };
    });

    const { unit, opponentUnit } = contract.boardUnits(boardIndex);
    return {
      board,
      headingId: `board-${boardIndex + 1}`,
      unit,
      opponentUnit,
      hasTeammates: contract.hasTeammates(boardIndex),
      showsQueues: contract.showsQueues,
      showsKillerCharacter: contract.showsKillerCharacter,
      eligibility: readEligibility(snapshot, board),
      standings,
    };
  });

  return { snapshot, format, boards, ambiguousNames };
}

// ---- Timestamp display ----
//
// Snapshot timestamps carry an explicit UTC offset. Show the wall-clock time
// in that offset, as published, instead of converting to the build machine's
// or reader's zone.

const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i;
const DATE_FORMAT = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });

export function formatTimestamp(timestamp: string): string {
  const m = TIMESTAMP.exec(timestamp);
  if (!m) return timestamp;
  const [, y, mo, d, h, mi, offset] = m;
  const date = DATE_FORMAT.format(new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))));
  const zone = offset.toUpperCase() === 'Z' ? 'UTC' : `UTC${offset}`;
  return `${date}, ${h}:${mi} (${zone})`;
}

/** Whole-percent win rate, e.g. "67%"; an em dash when there is none. */
export function formatWinRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

/** A per-match average to one decimal place, e.g. "3.5"; an em dash when there is none. */
export function formatAverage(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toFixed(1);
}

/** Calendar date only, in the timestamp's own offset, e.g. "Oct 4, 2026". */
export function formatDate(timestamp: string): string {
  const m = TIMESTAMP.exec(timestamp);
  if (!m) return timestamp;
  const [, y, mo, d] = m;
  return DATE_FORMAT.format(new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))));
}
