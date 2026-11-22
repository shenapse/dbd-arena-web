# DBD 1v4 PUG - Public Evidence Schema

This contract defines `public_facts` for the
[PUG sample snapshot](examples/ranking-snapshot-dbd-1v4-pug.json). It uses
the types and identity rules in the
[public snapshot contract](ranking-system-data-schema.md). Its schema identity
is `dbd-1v4-pug-match`, version `1.0`, and it supports envelope `2.0`.

## Match facts

Every match contains exactly these fields:

| Field | Type | Meaning |
|---|---|---|
| `winner_side_id` | `PublicId` or null | `killer` or `survivors`, referencing the winning side in this match; null means a draw. The accepted side outcome is supplied, not calculated from party composition. |
| `generators_remaining` | `Count` | Generators left unrepaired at the end of the match. `0` to `5`. |
| `hooks` | `Count` | Total hook stages the killer performed during the match, across all survivors. `0` to `12`. |
| `survivor_parties` | list of objects | Parties that queued together for this match. Each object contains only `member_profile_ids`, a list of two to four distinct survivor profile IDs. Empty when all survivors queued solo. |
| `solo_survivor_profile_ids` | list of `PublicId` | Distinct survivors who queued alone for this match. Empty when every survivor queued in a party. |

All fields are required; only `winner_side_id` may be null. A survivor-side win
implies `generators_remaining <= 1`, and a killer-side win implies `hooks >= 1`;
a draw adds no further rule. `generators_remaining` and `hooks` describe the
whole match, not any individual survivor. Membership is
complete, not unknown or partially published. Each survivor appears exactly
once across all party member lists and the solo list. Their union equals the
four profiles on this match's survivor side. Every membership reference must
resolve to a survivor participant in the enclosing match and therefore to an
individual profile in the snapshot. Killer profiles cannot appear in these lists.

A party object describes historical queue membership in one match. It has no
persistent group identity or rating. Players in the same member list queued
together; players in different lists did not. Array order has no competitive
meaning. Membership in one match implies nothing about another match. A player
can queue solo, with different partners, or in a full party across matches
without changing their profile ID or creating another ranking row.

## Envelope usage

- Every match lists `killer` and then `survivors`: one individual killer and
  four distinct individual survivors. All profiles have `kind = participant`
  and `group_members = null`.
- The snapshot has separate killer and survivor boards, in that order. Each
  row references the player's matches on that board's side. A survivor party
  never occupies a row. Opponent counts follow the base contract: killers count
  opposing individuals; survivors count killers, excluding their teammates.
- `publication.scope` contains one killer-character selection. All included
  matches use that character. `role_definitions` and all `role_ids` are empty;
  sides already identify the competitive roles.
- The two outcomes are `decided` for a non-null winner and `draw` for a null
  winner. The three result metrics are `wins`, `losses`, and `draws`, counting
  the outcome from the individual row's side. They sum to the row's included
  match count. A survivor-side win does not assert that every survivor escaped.
- This evidence contract does not prescribe eligibility, score calculation, or
  party-related score adjustments. The sample's methodology explains its
  illustrative scores. The sample uses the
  [DBD ranking extension](ranking-extension-dbd-1.0.md) for board eligibility
  requirements and each row's `eligible_match_count`.

## Validation and versioning

The [JSON Schema](schemas/dbd-1v4-pug-match-1.0.schema.json) validates each
`public_facts` object's structure and field constraints. It reuses types from
the envelope `2.0` schema by relative reference; publish both artifacts together.
Whole-snapshot checks must additionally enforce the membership partition,
profile references, side sizes, outcome consistency, and row counts described
above, along with the base contract's validation rules. No private catalog or
matchmaking record is needed to interpret this evidence.

The schema and this documentation are immutable for this identity and version.
A compatible optional addition requires a new minor version; changed meanings,
required fields, or envelope usage rules require a new major version. Consumers
must validate against the declared version and must not assume support for an
unknown major version. This contract publishes no per-survivor escape, hook, or repair results,
private account IDs, entry ratings, or rating changes.
