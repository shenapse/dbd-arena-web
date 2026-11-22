# DBD 1v4 PUG Overall Survivors - Public Evidence Schema

This contract supports the
[overall survivor sample](examples/ranking-snapshot-dbd-1v4-pug-survivors-overall.json).
Its schema identity is `dbd-1v4-pug-overall-match`, version `1.0`, supporting
envelope `2.0`. Base types and identity rules belong to the
[public snapshot contract](ranking-system-data-schema.md).

## Match facts

Each `public_facts` object contains exactly four required fields:

- `winner_side_id`, `survivor_parties`, and `solo_survivor_profile_ids` use the
  definitions and membership constraints in
  [PUG match facts](ranking-evidence-dbd-1v4-pug.md#match-facts). Only these
  shared fact definitions are reused; the envelope usage below is independent.
- `killer_character` is a non-null `PublicDefinition` naming the character
  used by the killer-side player in this match. Its `id` belongs to a
  publication-scoped character namespace, independent of player profile IDs.
  Repeated definitions for the same character ID must agree. IDs remain stable
  across refreshes and seasons and must never be reassigned to other characters.
  Labels and descriptions provide the meaning without requiring a catalog.

Killer player identity comes from the match's killer-side `profile_id`, which
resolves to the player's display name in `profiles`. The character definition
does not replace that identity. A player may use several characters across
matches and still count as one distinct opponent.

## Envelope usage

- `publication.scope` is empty: the publication covers the whole PUG competition
  across killer characters. A character is a match fact, not a publication filter.
- Exactly one board ranks individual survivors across the included matches.
  Every row profile appears on the survivor side in each referenced match.
  Killer players have public profiles and appear in match evidence, without
  requiring a killer board or ranking rows.
- Every match lists `killer` then `survivors`, with one killer player and four
  distinct survivor players. All profiles are individuals with
  `kind = participant` and `group_members = null`. `role_definitions` and every
  participant's `role_ids` are empty.
- The outcomes are `decided` when `winner_side_id` is non-null and `draw` when
  it is null. Row metrics `wins`, `losses`, and `draws` describe the survivor
  side's outcome, not individual escape. They sum to the row's included match
  count. `opponent_count` counts distinct opposing killer players across those
  matches, independent of which characters they used.

## Eligibility and scores

The sample uses the existing
[DBD ranking extension](ranking-extension-dbd-1.0.md). Its
`eligibility.rating` identifies and explains an equal-weight average of survivor
entry ratings across all available killer characters. The snapshot is the source
of truth for the component selection rule, common scale, missing-component policy,
evaluation time, and thresholds. No new eligibility fields are required.

The blend gates entry into the eligible pool. Matches across all killer characters
contribute to overall performance and the eligible match count. The displayed
score measures overall survivor performance and is
separate from the blended entry rating. Individual component ratings and blended
values remain private. Opponent eligibility is explained in the snapshot's
methodology; an eligible opponent need not have a published ranking row.

## Validation and versioning

The [evidence JSON Schema](schemas/dbd-1v4-pug-overall-match-1.0.schema.json)
checks fact types and required fields by referencing the existing PUG field
schemas and envelope types. Publish those transitive dependencies and the linked
documentation with their relative paths preserved.

Whole-snapshot validation must also check the envelope usage above, character
definition consistency, complete and disjoint survivor party/solo membership,
profile references, outcome consistency, ranking order, and row counts. Apply
the base and eligibility extension validation rules as well. Actual character
selection and eligibility remain publisher guarantees; public data cannot
verify private ratings or reconstruct the blend for individual players.

This identity and version are immutable. Compatible optional additions require
a new minor version. Changes to required fields, meanings, or envelope usage
require a new major version. Consumers must validate against the declared
version and must not assume support for an unknown major version.
