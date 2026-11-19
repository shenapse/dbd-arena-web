// Ranking snapshot loader for the sample leaderboard previews.
//
// A snapshot is one published fixture in docs/ref/examples/ (collected by
// ./publications.ts). It is read as is: the public contracts are
// docs/ref/ranking-system-data-schema.md (the envelope) and
// docs/ref/ranking-evidence-dbd-1v1-symmetric.md (the per-match facts).
// Nothing here recalculates the ranking. The loader only resolves references
// and turns each row's included matches into a player-perspective view. A
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

// ---- Evidence facts (ranking-evidence-dbd-1v1-symmetric.md §2.1) ----

interface DbdSymmetricFacts {
  winner_side_id: string;
  rounds_won_by_side: Record<string, number>;
}

const SUPPORTED_ENVELOPE_MAJOR = '1';
const SUPPORTED_FACTS = { schemaId: 'dbd-1v1-symmetric', major: '1' } as const;

// ---- Views consumed by RankingLeaderboard.astro ----

export interface PlayerMatchView {
  matchId: string;
  /** Published wall-clock time, or null when the publisher has none. */
  playedAt: string | null;
  opponent: PublicRankingProfile;
  /** Anchor of the opponent's row on the same board, if they have one. */
  opponentAnchor: string | null;
  won: boolean;
  ownRounds: number;
  opponentRounds: number;
  /**
   * 1-based chronological position among this row's duels against the same
   * opponent. Null when any of those duels has no time, because their order
   * is then unknown.
   */
  encounterIndex: number | null;
  encounterTotal: number;
}

export interface StandingView {
  row: RankingRow;
  profile: PublicRankingProfile;
  anchor: string;
  /** Shares its rank with another row on the board. */
  tied: boolean;
  /** Included matches this player won, counted from the match evidence. */
  wins: number;
  /** wins / included matches, 0–1. Null when the row has no included matches. */
  winRate: number | null;
  matches: PlayerMatchView[];
}

export interface BoardView {
  board: RankingBoard;
  headingId: string;
  standings: StandingView[];
}

export interface LeaderboardView {
  snapshot: RankingSnapshot;
  boards: BoardView[];
  /** Display names used by more than one profile; show the profile ID too. */
  ambiguousNames: Set<string>;
}

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

function readFacts(match: IncludedMatchEvidence): DbdSymmetricFacts {
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

export function loadLeaderboard(snapshot: RankingSnapshot): LeaderboardView {
  if (major(snapshot.schema_version) !== SUPPORTED_ENVELOPE_MAJOR) {
    fail(`unsupported envelope schema_version "${snapshot.schema_version}"`);
  }
  const factsSchema = snapshot.public_facts_schema;
  if (factsSchema.schema_id !== SUPPORTED_FACTS.schemaId || major(factsSchema.schema_version) !== SUPPORTED_FACTS.major) {
    fail(`unsupported public_facts_schema ${factsSchema.schema_id}@${factsSchema.schema_version}`);
  }

  const profiles = indexBy(snapshot.profiles, (p) => p.profile_id, 'profile');
  const matches = indexBy(snapshot.included_matches, (m) => m.match_id, 'match');
  const sides = indexBy(snapshot.side_definitions, (s) => s.id, 'side definition');

  const nameCounts = new Map<string, number>();
  for (const p of snapshot.profiles) {
    nameCounts.set(p.display_name, (nameCounts.get(p.display_name) ?? 0) + 1);
  }
  const ambiguousNames = new Set([...nameCounts].filter(([, n]) => n > 1).map(([name]) => name));

  const boards = snapshot.boards.map((board, boardIndex): BoardView => {
    const anchorOf = new Map(
      board.rows.map((row, rowIndex) => [row.profile_id, `standing-${boardIndex + 1}-${rowIndex + 1}`]),
    );
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

      const views = row.included_match_ids.map((matchId) => {
        const match = matches.get(matchId) ?? fail(`row "${row.profile_id}" references unknown match "${matchId}"`);
        if (match.sides.length !== 2 || match.sides.some((s) => s.participants.length !== 1)) {
          fail(`match "${matchId}" must have two sides with one participant each`);
        }
        const own = match.sides.find((s) => s.participants[0].profile_id === row.profile_id);
        const other = match.sides.find((s) => s !== own);
        if (!own || !other) fail(`row "${row.profile_id}" does not appear in match "${matchId}"`);

        for (const side of match.sides) {
          if (!sides.has(side.side_id)) fail(`match "${matchId}" uses unknown side "${side.side_id}"`);
        }
        const facts = readFacts(match);
        const opponentId = other.participants[0].profile_id;
        return {
          matchId,
          playedAt: readPlayedAt(match, snapshot.schema_version),
          opponent: profiles.get(opponentId) ?? fail(`match "${matchId}" references unknown profile "${opponentId}"`),
          opponentAnchor: anchorOf.get(opponentId) ?? null,
          won: facts.winner_side_id === own.side_id,
          ownRounds: facts.rounds_won_by_side[own.side_id],
          opponentRounds: facts.rounds_won_by_side[other.side_id],
          encounterIndex: 0,
          encounterTotal: 0,
        } satisfies PlayerMatchView;
      });

      // Show the most recent duel first. played_at is informational: it orders
      // this evidence list only and never affects ranks (envelope §6.1).
      views.sort(byPlayedAtDescending);

      // Number repeat encounters so a reader can see the same opponent twice
      // is intentional evidence, not a duplicated record. Numbering is
      // chronological, so it is left out when any of the duels has no time.
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

      // Every duel has exactly one winner (evidence §3.5), so wins and the win
      // rate follow from the evidence itself. The publication's result_metrics
      // IDs are its own choice, so they are not used to find the win count.
      const wins = views.filter((v) => v.won).length;

      return {
        row,
        profile,
        anchor: anchorOf.get(row.profile_id)!,
        tied: (rankCounts.get(row.rank) ?? 0) > 1,
        wins,
        winRate: views.length > 0 ? wins / views.length : null,
        matches: views,
      };
    });

    return { board, headingId: `board-${boardIndex + 1}`, standings };
  });

  return { snapshot, boards, ambiguousNames };
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

/** Calendar date only, in the timestamp's own offset, e.g. "Oct 4, 2026". */
export function formatDate(timestamp: string): string {
  const m = TIMESTAMP.exec(timestamp);
  if (!m) return timestamp;
  const [, y, mo, d] = m;
  return DATE_FORMAT.format(new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))));
}
