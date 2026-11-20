// Ranking snapshot loader for the sample leaderboard previews.
//
// A snapshot is one published fixture in docs/ref/examples/ (collected by
// ./publications.ts). It is read as is: the public contracts are
// docs/ref/ranking-system-data-schema.md (the envelope) and, for the
// per-match facts, one of
//   - docs/ref/ranking-evidence-dbd-1v1-symmetric.md (symmetric 1v1 duels), or
//   - docs/ref/ranking-evidence-dbd-1v4-quartet.md (one killer against one
//     survivor party of four).
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
  eligible_match_count: number;
  result_counts: Record<string, number>;
  opponent_count: number;
  included_match_ids: string[];
}

export interface RankingBoard {
  board_id: string;
  label: string;
  description: string;
  score_definition: { label: string; description: string };
  eligibility: {
    rating: PublicDefinition;
    minimum_rating_value: number;
    minimum_eligible_match_count: number;
    description: string;
  };
  rows: RankingRow[];
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
  public_facts_schema: {
    schema_id: string;
    schema_version: string;
    schema_path: string;
    documentation_path: string;
    description: string;
  };
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

const SUPPORTED_ENVELOPE_MAJOR = '1';

/** Which evidence contract a snapshot's matches follow. */
export type LeaderboardFormat = 'symmetric' | 'quartet';

const SUPPORTED_FACTS: Record<string, { format: LeaderboardFormat; major: string }> = {
  'dbd-1v1-symmetric': { format: 'symmetric', major: '1' },
  'dbd-1v4-quartet-match': { format: 'quartet', major: '1' },
};

/** Fixed side IDs of the quartet contract (evidence §3.2). */
const QUARTET_SIDES = { killer: 'killer', survivors: 'survivors' } as const;
/** Generators a survivor party has to repair to power the exit gates. */
export const QUARTET_GENERATORS = 5;

// ---- Views consumed by RankingLeaderboard.astro ----

export type MatchResult = 'won' | 'lost' | 'draw';

/** Per-match facts, from the row's side. */
export type MatchFactsView =
  | { format: 'symmetric'; ownRounds: number; opponentRounds: number }
  | {
      format: 'quartet';
      /** Generators the survivors repaired: 5 minus those left unrepaired. */
      generatorsCompleted: number;
      /** Hook stages the killer performed (evidence `hooks`). */
      hookStages: number;
    };

export interface PlayerMatchView {
  matchId: string;
  /** Published wall-clock time, or null when the publisher has none. */
  playedAt: string | null;
  opponent: PublicRankingProfile;
  /**
   * Anchor of the opponent's row on this page, if they have one: on the same
   * board for symmetric 1v1, on the other side's board for the quartet.
   */
  opponentAnchor: string | null;
  result: MatchResult;
  facts: MatchFactsView;
  /**
   * 1-based chronological position among this row's matches against the same
   * opponent. Null when any of those matches has no time, because their order
   * is then unknown.
   */
  encounterIndex: number | null;
  encounterTotal: number;
}

/** Averages over a quartet row's included matches. */
export interface QuartetAverages {
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
  /** Quartet boards only; null elsewhere and for a row with no included matches. */
  averages: QuartetAverages | null;
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

/** Fields, ranges and value rules of quartet evidence §2. */
function readQuartetFacts(match: IncludedMatchEvidence): DbdQuartetFacts {
  const where = `match "${match.match_id}"`;
  const facts = match.public_facts as Partial<DbdQuartetFacts> | null;
  if (!facts || typeof facts !== 'object') fail(`${where} has malformed public_facts`);
  const { winner_side_id: winner, generators_remaining: gens, hooks, kills } = facts;
  if (winner !== null && winner !== QUARTET_SIDES.killer && winner !== QUARTET_SIDES.survivors) {
    fail(`${where} winner_side_id must be "killer", "survivors" or null`);
  }
  if (!isCount(gens, QUARTET_GENERATORS) || !isCount(hooks, 12) || !isCount(kills, 4)) {
    fail(`${where} generators_remaining, hooks or kills is missing or out of range`);
  }
  if (hooks < 3 * kills || kills < hooks - 8) fail(`${where} hooks and kills are inconsistent`);
  if (gens > 0 && kills !== 4) fail(`${where} has generators remaining without four kills`);
  if (winner === QUARTET_SIDES.survivors && gens > 1) fail(`${where} is a survivor win with ${gens} generators remaining`);
  if (winner === QUARTET_SIDES.killer && hooks < 1) fail(`${where} is a killer win without a hook`);
  return facts as DbdQuartetFacts;
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
  /** Checks a match on its own; called once per match. */
  checkMatch(match: IncludedMatchEvidence, profiles: Map<string, PublicRankingProfile>): void;
  readMatch(match: IncludedMatchEvidence, own: MatchSide, other: MatchSide): { result: MatchResult; facts: MatchFactsView };
}

const symmetricProfile: FormatProfile = {
  checkSnapshot() {},
  boardUnits: () => ({ unit: PLAYER, opponentUnit: PLAYER }),
  checkRow() {},
  ownSideId: () => null,
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
    };
  },
};

// Quartet evidence §3: the killer board comes first and ranks killer players,
// the survivor board second and ranks survivor parties (groups).
const QUARTET_BOARDS = [
  { side: QUARTET_SIDES.killer, kind: 'participant', unit: KILLER, opponentUnit: PARTY },
  { side: QUARTET_SIDES.survivors, kind: 'group', unit: PARTY, opponentUnit: KILLER },
] as const;

function quartetProfile(): FormatProfile {
  // Outcome IDs are the publication's choice (§3.4); learn which one means
  // "decided" and which "draw" from the matches and require them to agree.
  const outcomeOf: { decided?: string; draw?: string } = {};
  return {
    checkSnapshot(snapshot) {
      const sideIds = snapshot.side_definitions.map((s) => s.id);
      if (sideIds.length !== 2 || sideIds[0] !== QUARTET_SIDES.killer || sideIds[1] !== QUARTET_SIDES.survivors) {
        fail('a quartet snapshot defines exactly the sides "killer" and "survivors"');
      }
      if (snapshot.boards.length !== QUARTET_BOARDS.length) fail('a quartet snapshot has a killer board and a survivor board');
      if (snapshot.publication.scope.length !== 1) fail('a quartet snapshot is scoped to exactly one killer');
      if (snapshot.result_metrics.length !== 3) fail('a quartet snapshot defines wins, losses and draws');
    },
    boardUnits: (boardIndex) => QUARTET_BOARDS[boardIndex],
    checkRow(row, profile, boardIndex) {
      const { kind, unit } = QUARTET_BOARDS[boardIndex];
      if (profile.kind !== kind) fail(`row "${row.profile_id}" on the ${unit.one} board must be a ${kind} profile`);
      const total = Object.values(row.result_counts).reduce((a, b) => a + b, 0);
      if (total !== row.eligible_match_count) {
        fail(`row "${row.profile_id}" result_counts do not add up to eligible_match_count`);
      }
    },
    ownSideId: (boardIndex) => QUARTET_BOARDS[boardIndex].side,
    checkMatch(match, profiles) {
      const where = `match "${match.match_id}"`;
      const [killer, survivors] = match.sides;
      if (match.sides.length !== 2 || killer.side_id !== QUARTET_SIDES.killer || survivors.side_id !== QUARTET_SIDES.survivors) {
        fail(`${where} must list the killer side, then the survivors side`);
      }
      for (const [side, kind] of [[killer, 'participant'], [survivors, 'group']] as const) {
        if (side.participants.length !== 1) fail(`${where} ${side.side_id} side must have one participant`);
        const profile = profiles.get(side.participants[0].profile_id);
        if (profile && profile.kind !== kind) fail(`${where} ${side.side_id} side must be a ${kind} profile`);
      }
      const facts = readQuartetFacts(match);
      const outcome = facts.winner_side_id === null ? 'draw' : 'decided';
      outcomeOf[outcome] ??= match.outcome_id;
      if (outcomeOf[outcome] !== match.outcome_id || outcomeOf.decided === outcomeOf.draw) {
        fail(`${where} outcome_id "${match.outcome_id}" disagrees with the other ${outcome === 'draw' ? 'drawn' : 'decided'} matches`);
      }
    },
    readMatch(match, own) {
      const facts = readQuartetFacts(match);
      return {
        result: facts.winner_side_id === null ? 'draw' : facts.winner_side_id === own.side_id ? 'won' : 'lost',
        facts: {
          format: 'quartet',
          generatorsCompleted: QUARTET_GENERATORS - facts.generators_remaining,
          hookStages: facts.hooks,
        },
      };
    },
  };
}

const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export function loadLeaderboard(snapshot: RankingSnapshot): LeaderboardView {
  if (major(snapshot.schema_version) !== SUPPORTED_ENVELOPE_MAJOR) {
    fail(`unsupported envelope schema_version "${snapshot.schema_version}"`);
  }
  const factsSchema = snapshot.public_facts_schema;
  const supported = SUPPORTED_FACTS[factsSchema.schema_id];
  if (!supported || major(factsSchema.schema_version) !== supported.major) {
    fail(`unsupported public_facts_schema ${factsSchema.schema_id}@${factsSchema.schema_version}`);
  }
  const { format } = supported;
  const contract = format === 'quartet' ? quartetProfile() : symmetricProfile;
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

  // Row anchors, per board. An opponent link goes to the opponent's row on the
  // same board if there is one, otherwise to their row on another board (the
  // quartet's killers and parties face each other across the two boards).
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

      const views = row.included_match_ids.map((matchId): PlayerMatchView => {
        const match = matches.get(matchId) ?? fail(`row "${row.profile_id}" references unknown match "${matchId}"`);
        const own = match.sides.find((s) => s.participants[0].profile_id === row.profile_id);
        const other = match.sides.find((s) => s !== own);
        if (!own || !other) fail(`row "${row.profile_id}" does not appear in match "${matchId}"`);
        if (ownSideId !== null && own.side_id !== ownSideId) {
          fail(`row "${row.profile_id}" must be on the ${ownSideId} side of match "${matchId}"`);
        }
        const opponentId = other.participants[0].profile_id;
        return {
          matchId,
          playedAt: readPlayedAt(match, snapshot.schema_version),
          opponent: profiles.get(opponentId) ?? fail(`match "${matchId}" references unknown profile "${opponentId}"`),
          opponentAnchor: anchorOf.get(opponentId) ?? anyAnchor.get(opponentId) ?? null,
          ...contract.readMatch(match, own, other),
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
      for (const v of views) {
        const list = perOpponent.get(v.opponent.profile_id) ?? [];
        list.push(v);
        perOpponent.set(v.opponent.profile_id, list);
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
      const quartetFacts = views.flatMap((v) => (v.facts.format === 'quartet' ? [v.facts] : []));

      return {
        row,
        profile,
        anchor: anchorOf.get(row.profile_id)!,
        tied: (rankCounts.get(row.rank) ?? 0) > 1,
        wins,
        winRate: views.length > 0 ? wins / views.length : null,
        averages:
          quartetFacts.length > 0
            ? {
                generatorsCompleted: average(quartetFacts.map((f) => f.generatorsCompleted)),
                hookStages: average(quartetFacts.map((f) => f.hookStages)),
              }
            : null,
        matches: views,
      };
    });

    return { board, headingId: `board-${boardIndex + 1}`, ...contract.boardUnits(boardIndex), standings };
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
