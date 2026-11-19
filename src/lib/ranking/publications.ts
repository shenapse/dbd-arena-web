// Registry of the symmetric 1v1 leaderboards shown under
// /preview/leaderboards/1v1-symmetric/.
//
// Every fixture named ranking-snapshot-dbd-1v1-symmetric*.json in
// docs/ref/examples/ is one publication: one killer's leaderboard (evidence
// §3.1: the scope is exactly one killer selection). Adding a fixture adds a
// killer to the umbrella page and the killer switcher; no website catalog is
// involved. Killers without a snapshot are simply absent.
//
// The publications must agree on deployment and competition, because the
// umbrella page presents them as one competition. Anything else fails the
// build.

import { fail, loadLeaderboard, type LeaderboardView, type PublicDefinition, type RankingSnapshot } from './snapshot';

export const SYMMETRIC_LEADERBOARDS_PATH = '/preview/leaderboards/1v1-symmetric/';

const fixtures = import.meta.glob<RankingSnapshot>(
  '../../../docs/ref/examples/ranking-snapshot-dbd-1v1-symmetric*.json',
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

export interface PublicationGroup {
  competition: PublicDefinition;
  entries: PublicationEntry[];
}

// The scope value ID becomes a URL segment as is. Reject anything that would
// need escaping instead of inventing a slug from it.
const URL_SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

function buildGroup(): PublicationGroup {
  const snapshots = Object.values(fixtures);
  if (snapshots.length === 0) fail('no ranking-snapshot-dbd-1v1-symmetric*.json fixtures found');

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
      href: `${SYMMETRIC_LEADERBOARDS_PATH}${value.id}/`,
      view: loadLeaderboard(snapshot),
    };
  });

  entries.sort((a, b) => a.label.localeCompare(b.label, 'en'));
  return { competition, entries };
}

export const symmetricLeaderboards: PublicationGroup = buildGroup();

/** Frontmatter shared by the unlisted preview pages (UX structure §5). */
export const UNLISTED_PREVIEW = {
  pagefind: false,
  tableOfContents: false,
  prev: false,
  next: false,
  head: [{ tag: 'meta' as const, attrs: { name: 'robots', content: 'noindex' } }],
};
