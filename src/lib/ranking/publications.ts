// Registry of the per-killer leaderboards shown under /preview/leaderboards/.
//
// Each game mode is one publication group with an umbrella page and one page
// per killer:
//   - /preview/leaderboards/1v1-symmetric/ from the fixtures named
//     ranking-snapshot-dbd-1v1-symmetric*.json, and
//   - /preview/leaderboards/1v4-quartet/ from those named
//     ranking-snapshot-dbd-1v4-quartet*.json, and
//   - /preview/leaderboards/1v4-pug/ from those named
//     ranking-snapshot-dbd-1v4-pug*.json, except the overall survivor
//     ranking (ranking-snapshot-dbd-1v4-pug-survivors-overall.json), which
//     covers every killer and so is not a per-killer leaderboard,
// all in docs/ref/examples/. The overall survivor ranking has a page of its
// own, /preview/leaderboards/1v4-pug/survivors/, and must belong to the same
// deployment and competition as the per-killer PUG leaderboards. Every fixture is one publication: one killer's
// leaderboard (every evidence contract's scope is exactly one killer
// selection). Adding a fixture adds a killer to its umbrella page and killer
// switcher; no website catalog is involved. Killers without a snapshot are
// simply absent.
//
// The publications of one group must agree on deployment and competition,
// because the umbrella page presents them as one competition. Anything else
// fails the build.

import { fail, loadLeaderboard, type LeaderboardView, type PublicDefinition, type RankingSnapshot } from './snapshot';

export const SYMMETRIC_LEADERBOARDS_PATH = '/preview/leaderboards/1v1-symmetric/';
export const QUARTET_LEADERBOARDS_PATH = '/preview/leaderboards/1v4-quartet/';
export const PUG_LEADERBOARDS_PATH = '/preview/leaderboards/1v4-pug/';
/** Segment of the overall PUG survivor page; no killer may use it as a slug. */
export const PUG_SURVIVORS_OVERALL_SEGMENT = 'survivors';
export const PUG_SURVIVORS_OVERALL_PATH = `${PUG_LEADERBOARDS_PATH}${PUG_SURVIVORS_OVERALL_SEGMENT}/`;

// import.meta.glob needs literal patterns, so each group has its own call.
const symmetricFixtures = import.meta.glob<RankingSnapshot>(
  '../../../docs/ref/examples/ranking-snapshot-dbd-1v1-symmetric*.json',
  { eager: true, import: 'default' },
);
const quartetFixtures = import.meta.glob<RankingSnapshot>(
  '../../../docs/ref/examples/ranking-snapshot-dbd-1v4-quartet*.json',
  { eager: true, import: 'default' },
);
const pugFixtures = import.meta.glob<RankingSnapshot>(
  [
    '../../../docs/ref/examples/ranking-snapshot-dbd-1v4-pug*.json',
    '!../../../docs/ref/examples/ranking-snapshot-dbd-1v4-pug-survivors-overall.json',
  ],
  { eager: true, import: 'default' },
);
const pugSurvivorsOverallFixture = import.meta.glob<RankingSnapshot>(
  '../../../docs/ref/examples/ranking-snapshot-dbd-1v4-pug-survivors-overall.json',
  { eager: true, import: 'default' },
);

export interface PublicationEntry {
  /** URL segment: the scope value ID, used verbatim (never parsed). */
  slug: string;
  /** Scope value label, e.g. "The Trapper". */
  label: string;
  href: string;
  view: LeaderboardView;
}

/** A page of the group that covers every killer, such as the overall PUG survivor ranking. */
export interface OverviewEntry {
  /** URL segment under the group's path; never a killer's slug. */
  slug: string;
  label: string;
  href: string;
}

export interface PublicationGroup {
  /** Umbrella page of the group. */
  href: string;
  competition: PublicDefinition;
  entries: PublicationEntry[];
  /** Pages across every killer, shown beside the umbrella link in the killer switcher. */
  overviews: OverviewEntry[];
}

// The scope value ID becomes a URL segment as is. Reject anything that would
// need escaping instead of inventing a slug from it.
const URL_SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

function buildGroup(fixtures: Record<string, RankingSnapshot>, basePath: string, what: string): PublicationGroup {
  const snapshots = Object.values(fixtures);
  if (snapshots.length === 0) fail(`no ${what} fixtures found`);

  const [first] = snapshots;
  const competition = first.publication.competition;
  const publicationIds = new Set<string>();
  const slugs = new Set<string>();
  let categoryId: string | undefined;

  const entries = snapshots.map((snapshot): PublicationEntry => {
    const { publication } = snapshot;
    const where = `publication "${publication.publication_id}"`;

    if (snapshot.deployment_id !== first.deployment_id) fail(`${where} is from a different deployment`);
    if (publication.competition.id !== competition.id) fail(`${where} is from a different competition`);
    if (publicationIds.has(publication.publication_id)) fail(`duplicate ${where}`);
    publicationIds.add(publication.publication_id);

    if (publication.scope.length !== 1) fail(`${where} must have exactly one scope selection`);
    const [{ category, value }] = publication.scope;
    categoryId ??= category.id;
    if (category.id !== categoryId) fail(`${where} uses scope category "${category.id}", expected "${categoryId}"`);
    if (!URL_SAFE_ID.test(value.id)) fail(`${where} scope value ID "${value.id}" is not usable as a URL segment`);
    if (slugs.has(value.id)) fail(`two publications share scope value "${value.id}"`);
    slugs.add(value.id);

    return {
      slug: value.id,
      label: value.label,
      href: `${basePath}${value.id}/`,
      view: loadLeaderboard(snapshot),
    };
  });

  entries.sort((a, b) => a.label.localeCompare(b.label, 'en'));
  return { href: basePath, competition, entries, overviews: [] };
}

export const symmetricLeaderboards: PublicationGroup = buildGroup(
  symmetricFixtures,
  SYMMETRIC_LEADERBOARDS_PATH,
  'ranking-snapshot-dbd-1v1-symmetric*.json',
);

export const quartetLeaderboards: PublicationGroup = buildGroup(
  quartetFixtures,
  QUARTET_LEADERBOARDS_PATH,
  'ranking-snapshot-dbd-1v4-quartet*.json',
);

const pugPerKiller = buildGroup(pugFixtures, PUG_LEADERBOARDS_PATH, 'ranking-snapshot-dbd-1v4-pug*.json');

/** Overall PUG survivor ranking across every killer, at PUG_SURVIVORS_OVERALL_PATH. */
export const pugSurvivorsOverall: LeaderboardView = (() => {
  const [snapshot] = Object.values(pugSurvivorsOverallFixture);
  if (!snapshot) fail('no ranking-snapshot-dbd-1v4-pug-survivors-overall.json fixture found');
  const where = `publication "${snapshot.publication.publication_id}"`;
  const [perKiller] = pugPerKiller.entries;
  if (snapshot.deployment_id !== perKiller.view.snapshot.deployment_id) fail(`${where} is from a different deployment`);
  if (snapshot.publication.competition.id !== pugPerKiller.competition.id) fail(`${where} is from a different competition`);
  if (pugPerKiller.entries.some((e) => e.slug === PUG_SURVIVORS_OVERALL_SEGMENT)) {
    fail(`a PUG killer's scope value ID "${PUG_SURVIVORS_OVERALL_SEGMENT}" clashes with the overall survivor page`);
  }
  return loadLeaderboard(snapshot);
})();

export const pugLeaderboards: PublicationGroup = {
  ...pugPerKiller,
  overviews: [
    { slug: PUG_SURVIVORS_OVERALL_SEGMENT, label: 'Overall survivors', href: PUG_SURVIVORS_OVERALL_PATH },
  ],
};

/** Frontmatter shared by the unlisted preview pages (UX structure §5). */
export const UNLISTED_PREVIEW = {
  pagefind: false,
  tableOfContents: false,
  prev: false,
  next: false,
  head: [{ tag: 'meta' as const, attrs: { name: 'robots', content: 'noindex' } }],
};
