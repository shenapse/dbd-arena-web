---
version: "0.3"
doc_type: "DS"
scope:
  in_scope:
    - public-json-contracts
    - field-definitions
    - constraints
    - relationships
    - validation-rules
    - public-identity
    - versioning
  out_of_scope:
    - generator-configuration-and-source-mappings: "Owned by ranking-system-generator-data-schema.md"
    - ranking-calculation: "Owned by ranking-system-design.md"
    - publication-mechanics: "Owned by ranking-system-architecture.md"
    - website-ui-behavior: "Owned by consumers"
    - game-specific-fact-fields: "Owned by separately published public evidence schemas"
    - concrete-json-schema-artifacts: "Implemented by schemas/ranking-snapshot-1.0.schema.json; this document stays authoritative"
  cross_reference_allowed:
    - DS
---

# Ranking Snapshot - Public Data Schema / Dictionary

> **Purpose:** Define the complete game-agnostic public contract for leaderboard
> snapshots. An external program can interpret the envelope using this document
> and the snapshot itself. Detailed game-specific match facts additionally use
> the public schema and documentation identified in the snapshot.
>
> No matchmaking schema, database, registry, catalog, or generator configuration
> is a dependency of this public contract. Ranking owns all types defined here.

## 1. Overview

A snapshot describes a competition, a publication scope, and a season. It
contains ordered leaderboards, public participant and group profiles, included
match summaries, and understandable eligibility requirements.

The envelope has no fixed games, characters, competitive roles, or outcome
vocabulary. The snapshot supplies public names and explanations for these
concepts. Consumers decide how to present them.

```text
RankingSnapshot
  -> publication (competition and scope metadata)
  -> season
  -> boards[] (metadata, eligibility, score definition, ordered rows)
       -> rows[].profile_id -> profiles[].profile_id
       -> rows[].included_match_ids[] -> included_matches[].match_id
  -> profiles[]
  -> result_metrics[], public_outcomes[], side_definitions[], role_definitions[]
  -> included_matches[]
       -> sides[].participants[].profile_id -> profiles[].profile_id
       -> public_facts (separately published public schema)
```

Consumers use published ranks and row order. They do not reconstruct eligibility
or ranking calculations. Eligibility is evaluated when the snapshot is
generated, including when no new matches have been played.

## 2. Common Types and Identity

Unless explicitly stated otherwise, every field in the tables below is required
and non-null. Lists may be empty unless constrained otherwise.

| Type | Public definition |
|---|---|
| `PublicId` | Non-empty opaque JSON string. Compared exactly and case-sensitively. Consumers must not parse it or infer meaning from its spelling. |
| `PublicText` | JSON string containing at least one non-whitespace character. Plain text, not HTML or executable markup. |
| `Timestamp` | RFC 3339 timestamp with an explicit UTC offset. |
| `Count` | JSON integer greater than or equal to zero. |
| `Number` | Finite JSON number. |

### 2.1 Identity scopes and stability

`deployment_id` identifies the publisher's stable identity namespace. IDs from
different deployments are not assumed to identify the same entity.

Within a deployment:

- Profile IDs are unique across participants and groups, and remain stable
  across boards, publication targets, refreshes, and seasons. A group profile
  identifies the group, not an individual member.
- Match IDs remain stable wherever the same match is included. An updated
  summary keeps the same match ID; its contents may change.
- Publication IDs identify a competition and scope independently of season.
  Board IDs and season IDs are scoped to a publication. A board retains its ID
  across seasons; a different competitive category requires a different board ID.
- Competition IDs are deployment-scoped. Scope category IDs are scoped to a
  competition; scope value IDs are scoped to their category.
- Metric, outcome, eligibility-rating, side, and role definition IDs are scoped
  to a publication and their respective definition kind. They retain their
  meaning across refreshes and seasons. A materially different meaning requires
  a different ID. Labels and descriptions may be corrected without changing ID.
- Evidence schema identity is `(schema_id, schema_version)` within a deployment.
  Published definitions for that pair are immutable.

IDs are never reassigned to different entities. Display names are not IDs and
need not be unique. Absence in a later snapshot does not invalidate an identity.
Consumers identify a profile across files by `(deployment_id, profile_id)`, and
a board by `(deployment_id, publication_id, board_id)`.

### 2.2 `PublicDefinition`

| Field | Type | Meaning / constraint |
|---|---|---|
| `id` | `PublicId` | Identity in the applicable scope from Section 2.1. |
| `label` | `PublicText` | Human-readable name. |
| `description` | `PublicText` | Meaning of the concept, understandable without internal documentation. |

## 3. Snapshot and Publication Metadata

### 3.1 `RankingSnapshot`

| Field | Type | Meaning / constraint |
|---|---|---|
| `schema_version` | string | Public envelope version in `major.minor` form. See Section 8. |
| `deployment_id` | `PublicId` | Publisher's stable public identity namespace. |
| `generated_at` | `Timestamp` | Time the snapshot was generated. |
| `publication` | `PublicPublication` | Competition and scope covered by this snapshot. |
| `season` | `PublicSeason` | Season covered by this snapshot. |
| `methodology_description` | `PublicText` | Public explanation of ranking scores and repeated-match contribution limits. See Section 3.4. |
| `boards` | list[`RankingBoard`] | Non-empty. Unique by `board_id`. List order is the public board order. |
| `profiles` | list[`PublicRankingProfile`] | Unique by `profile_id`. Includes every profile referenced by rows and match participants. |
| `result_metrics` | list[`PublicDefinition`] | Unique by `id`. Defines row result counts. May be empty. |
| `public_outcomes` | list[`PublicDefinition`] | Non-empty. Unique by `id`. Defines match outcomes. |
| `side_definitions` | list[`PublicDefinition`] | Unique by `id`. Defines the sides used in match summaries. |
| `role_definitions` | list[`PublicDefinition`] | Unique by `id`. Defines optional competitive roles used in match summaries. |
| `public_facts_schema` | `PublicEvidenceSchemaReference` | Public schema and documentation for every match's `public_facts`. |
| `included_matches` | list[`IncludedMatchEvidence`] | Unique by `match_id`. Only matches included in this snapshot's ranking calculation. |

### 3.2 `PublicPublication` and `PublicScopeSelection`

| Field | Type | Meaning / constraint |
|---|---|---|
| `publication_id` | `PublicId` | Stable identity of this competition-and-scope publication target. |
| `label` | `PublicText` | Name suitable for a leaderboard heading. |
| `description` | `PublicText` | Explains what this publication covers. |
| `competition` | `PublicDefinition` | Public name and explanation of the competitive rules or format. |
| `scope` | list[`PublicScopeSelection`] | Unique by `category.id`. Empty means the whole competition. List order is the public metadata order. |

Each `PublicScopeSelection` contains:

| Field | Type | Meaning / constraint |
|---|---|---|
| `category` | `PublicDefinition` | Public category being selected, such as character or format. |
| `value` | `PublicDefinition` | The selected value, with its public name and meaning. |

Each category has one selected value. No catalog lookup is needed to interpret
the selection. Labels are supplied as data; they are not inferred from IDs.

### 3.3 `PublicSeason`

| Field | Type | Meaning / constraint |
|---|---|---|
| `season_id` | `PublicId` | Season identity within this publication. |
| `label` | `PublicText` | Human-readable season name. |
| `starts_at` | `Timestamp` | Inclusive beginning of the season's match-selection window. |
| `ends_at` | `Timestamp` | Exclusive end of that window. Must be after `starts_at`. |

### 3.4 Methodology explanation

`methodology_description` explains that ranking scores measure competitive
performance among currently eligible units, independently of the rating used
for entry requirements. It must explain how repeated encounters are limited in
this publication, including which encounters share a limit and what is limited.

If the explanation states a numeric limit, it must name the quantity and unit
(for example, match count or calculation weight). An opaque implementation
policy name or an unexplained number is not a public explanation. The envelope
does not prescribe the calculation formula or require consumers to implement it.

## 4. Boards, Eligibility, and Rows

### 4.1 `RankingBoard`

| Field | Type | Meaning / constraint |
|---|---|---|
| `board_id` | `PublicId` | Board identity within the publication. |
| `label` | `PublicText` | Human-readable board name. |
| `description` | `PublicText` | Explains who is ranked and the competitive category. |
| `score_definition` | `PublicScoreDefinition` | Meaning and scale of this board's displayed score. |
| `eligibility` | `PublicEligibilityRequirements` | Entry requirements and public explanation. |
| `rows` | list[`RankingRow`] | Authoritative ranking order. May be empty. Unique by `profile_id`. |

Board metadata and rows are defined together. Consumers do not join a separate
board configuration or derive board meaning from an internal selector.

### 4.2 `PublicScoreDefinition`

| Field | Type | Meaning / constraint |
|---|---|---|
| `label` | `PublicText` | Public name of the displayed ranking score. |
| `description` | `PublicText` | Explains the score scale and any supported comparisons across boards, seasons, or refreshes. |

Higher displayed scores rank ahead of lower scores within a board. Scores are
integers. Cross-board or cross-snapshot score comparisons are not guaranteed
unless this description explicitly supports them.

### 4.3 `PublicEligibilityRequirements`

| Field | Type | Meaning / constraint |
|---|---|---|
| `rating` | `PublicDefinition` | Public identity, name, and explanation of the entry rating, including the scale needed to interpret its minimum. |
| `minimum_rating_value` | `Number` | Inclusive lower bound for the entry rating. A policy threshold, not any profile's rating. |
| `minimum_eligible_match_count` | `Count` | Minimum current-season matches against units eligible when the snapshot is generated. |
| `description` | `PublicText` | Explains these requirements and that eligibility is evaluated at generation time. |

The rating threshold determines entry into the candidate pool. The match-count
requirement applies against the calculation-time eligible pool. The entry
rating does not become the ranking score. Consumers display these rules; they
cannot independently determine eligibility from public profiles because
individual entry-rating values are not published.

### 4.4 `RankingRow`

| Field | Type | Meaning / constraint |
|---|---|---|
| `rank` | integer | Competition rank, greater than or equal to `1`. |
| `profile_id` | `PublicId` | Resolves in this snapshot's `profiles`. |
| `display_score` | integer | Public ranking score interpreted using the board's `score_definition`. |
| `eligible_match_count` | `Count` | Included current-season matches involving this profile against calculation-time eligible units. Must meet the board's minimum. |
| `result_counts` | map[`PublicId`, `Count`] | Keys are exactly `result_metrics[].id`. Definitions explain counts from this row's perspective. |
| `opponent_count` | `Count` | Distinct opposing profiles represented in this row's included matches. A group counts as one profile. |
| `included_match_ids` | list[`PublicId`] | Unique IDs resolving in `included_matches`. These matches support this row's score and counts; each includes this row's profile. |

Rows are sorted by descending `display_score`. A row's rank is one plus the
number of rows with a strictly higher score. Rows with the same score share
the same competition rank; the next rank skips the number of tied rows. For
example, scores `100`, `100`, `90` have ranks `1`, `1`, `3`. Within a tie, the
supplied row order is authoritative. Consumers do not need unrounded model
scores or internal tie-breaking rules.

`eligible_match_count` equals the number of `included_match_ids`. Contribution
limits can reduce a match's influence without removing it from this evidence
list. Result metrics can overlap; their counts need not sum to the match count.

## 5. Public Profiles

### 5.1 `PublicRankingProfile`

| Field | Type | Meaning / constraint |
|---|---|---|
| `profile_id` | `PublicId` | Stable participant or group identity. |
| `kind` | string | Exactly `participant` or `group`. A participant competes individually; a group competes as one ranked unit. |
| `display_name` | `PublicText` | Display-safe public name. Always non-empty, regardless of source naming rules. |
| `group_members` | list[`PublicGroupMemberProfile`] or null | Required non-null list for a group, unique by `profile_id`; null for a participant. An empty group list means no members are published. |

### 5.2 `PublicGroupMemberProfile`

| Field | Type | Meaning / constraint |
|---|---|---|
| `profile_id` | `PublicId` | Stable participant identity in the same namespace used by participant profiles. |
| `display_name` | `PublicText` | Display-safe public name. |

A member need not have a separate entry in `profiles` unless referenced by a row
or match participant. If present there, that entry must have `kind = participant`
and the same display name. A group ID cannot be used as a member ID.

Member order is the supplied public display order and has no competitive or
formation-slot meaning. Names and published group membership describe the
generation-time view. They do not assert the historical lineup of every match.
A game-specific public evidence schema can define historical lineup facts when
needed.

## 6. Included Match Summaries

### 6.1 `IncludedMatchEvidence`

| Field | Type | Meaning / constraint |
|---|---|---|
| `match_id` | `PublicId` | Stable public match identity. |
| `sides` | list[`PublicMatchSide`] | Non-empty. Unique by `side_id`. Public display order. |
| `outcome_id` | `PublicId` | Resolves in `public_outcomes`. Neutral match-level outcome interpreted using its definition and public facts. |
| `public_facts` | JSON object | Conforms to the snapshot's `public_facts_schema`. Contains only approved public facts. |

Each record describes a current-season match included in this snapshot's ranking
calculation. Per-match timestamps are not part of this envelope version.

### 6.2 `PublicMatchSide` and `PublicMatchParticipant`

| Field | Type | Meaning / constraint |
|---|---|---|
| `side_id` | `PublicId` | Resolves in `side_definitions`. Identifies a competitive side, not a profile or a persistent team roster. |
| `participants` | list[`PublicMatchParticipant`] | Non-empty. Profiles competing together on this side. Public display order. |

Each `PublicMatchParticipant` contains:

| Field | Type | Meaning / constraint |
|---|---|---|
| `profile_id` | `PublicId` | Resolves in `profiles`. Appears only once in this match's sides. |
| `role_ids` | list[`PublicId`] | Unique references to `role_definitions`. Empty when no roles need to be published. |

A ranked group remains one participating profile. Its members are not implicitly
expanded into separate competitors. Public roles explain competitive functions;
they do not expose formation slots or slot occurrence indexes.

Different sides represent opposition within the match. A row's `opponent_count`
counts the distinct profile IDs on other sides across its `included_match_ids`.
Profiles on the row's own side do not count as opponents.

### 6.3 `PublicEvidenceSchemaReference`

| Field | Type | Meaning / constraint |
|---|---|---|
| `schema_id` | `PublicId` | Identity of the public game- or ruleset-specific evidence schema. |
| `schema_version` | string | Non-empty public evidence schema version. |
| `schema_path` | string | Non-empty relative URL path to its JSON Schema, resolved against the snapshot URL. |
| `documentation_path` | string | Non-empty relative URL path to its public field and meaning documentation, resolved against the snapshot URL. |
| `description` | `PublicText` | Explains what kind of public match facts this schema describes. |

Both artifacts must be published and accessible to consumers. Their contents
are immutable for a schema identity and version; paths must not silently serve
a different version. All transitive schema references and required explanatory
documents must also be publicly accessible and version-pinned. No artifact may
require matchmaking schemas or private catalogs.

The evidence schema defines fact types, units, allowed values, nullability,
meaning, and any references to envelope IDs. Such references must specify their
scope and validation rules. Metadata needed to interpret facts must be included
in the snapshot or these public artifacts. An outcome whose meaning depends on
a side must identify that side unambiguously through these definitions and facts.

Consumers can display the generic summary without understanding every specific
fact. Detailed displays require the referenced public schema and documentation.
This is an explicit public projection contract, not permission to expose an
unfiltered operational result payload.

## 7. Validation and Public Data Boundaries

Consumers can validate the public contract using the snapshot and published
schemas and documentation:

- Fields satisfy the types, requiredness, nullability, and constraints above.
- IDs are unique in their declared scopes. Every row and match profile reference
  resolves within the snapshot. Metric, outcome, side, and role references resolve
  to their public definitions.
- Repeated definitions of the same public concept agree within the snapshot.
  Repeated group-member identities have consistent display names.
- Rows satisfy the ordering, rank, match-count, and reference rules in Section 4.
  The row's profile appears in each referenced match.
- Season bounds are valid. Facts conform to the public evidence schema,
  including its reference rules.
- Display text satisfies the public text rules. Empty source names never weaken
  the public requirement for a usable name.

Historical identity stability and the truth of published eligibility, counts,
and match selection are publisher guarantees. Consumers need no source access
to accept them. Public validation does not rerun the calculation or validate
private catalog membership.

The envelope and its public evidence extensions must exclude:

- private user or account identities, platform bindings, and in-game player IDs;
- unfiltered database, registry, or accepted-result records;
- individual entry-rating values, rating-store payloads, and rating deltas;
- source read watermarks, result journal IDs, supersession chains, reporter or
  staff identities, and audit evidence;
- internal selector handles, rating-dimension structures, formation-slot
  coordinates, and raw model scores.

Public IDs identify published entities; they provide no lookup contract into
private systems. The projection must explicitly select allowed public fields.

## 8. Publication and Versioning

Consumers receive static snapshot JSON, the public envelope JSON Schema for its
declared version, this documentation, and the referenced public evidence schema
and documentation. Descriptive metadata for competition, scope, boards,
eligibility ratings, sides, roles, result metrics, and outcomes is included in
the snapshot. Consumers do not fetch separate catalogs for those concepts.

`schema_version` independently versions the public envelope in `major.minor`
form. A major version changes for removed fields, changed types, changed field
meaning, or other incompatible consumer requirements. A minor version permits
compatible optional additions without changing existing fields' meaning.
Consumers must not assume support for an unknown major version. Unknown fields
may be ignored only when permitted by the declared public schema version.
Version `1.0` permits no envelope fields beyond those defined here. The contents
of `public_facts` are governed by their evidence schema.

Evidence schemas are versioned independently. Their public documentation must
state their compatibility rules. Changing an evidence schema does not itself
require an envelope version change if the envelope contract remains intact.

Internal source or configuration schema changes do not automatically change the
public contract. The publisher must adapt them or explicitly publish a new
public version. This document's frontmatter version tracks the document revision
independently of JSON version fields.

## 9. Current Limits

This document defines the logical public contract. Its machine-checkable form
for envelope version `1.0` is
[schemas/ranking-snapshot-1.0.schema.json](schemas/ranking-snapshot-1.0.schema.json).
If the two disagree, this document is authoritative.

The JSON Schema checks types, requiredness, nullability, and per-field
constraints. It cannot check rules that compare values across the snapshot:
reference resolution, uniqueness by key, row order and ranks, match counts,
opponent counts, and season bounds. Those Section 7 checks need a validator
that reads the whole snapshot.

The envelope does not define UI layouts, calculation internals, historical
lineups, individual formation positions, or private audit access. It supports
participant and group profiles; additional kinds require a public contract
revision. Identity stability does not guarantee that a profile remains ranked
or that scores remain comparable across snapshots.
