---
version: "0.2"
doc_type: "DS"
scope:
  in_scope:
    - public-facts-fields
    - envelope-usage-profile
    - reference-rules
    - validation-rules
    - evidence-versioning
  out_of_scope:
    - envelope-field-definitions: "Owned by ranking-system-data-schema.md"
    - source-to-public-mapping: "Owned by ranking-generator-dbd-1v1-symmetric-mapping.md"
    - ranking-calculation: "Owned by ranking-system-design.md"
    - concrete-json-schema-artifact: "Implemented by schemas/dbd-1v1-symmetric-1.0.schema.json; this document stays authoritative"
  cross_reference_allowed:
    - DS
---

# DBD 1v1 Symmetric - Public Evidence Schema

> **Purpose:** Define the public match facts for Dead by Daylight 1v1 symmetric
> duels, and the rules a ranking snapshot follows when it uses them.
>
> This document is published to consumers. It extends the
> [public snapshot contract](ranking-system-data-schema.md), which defines the
> envelope. Envelope types such as `PublicId`, `Count`, and `PublicDefinition`
> are used here by reference. No matchmaking schema or private catalog is
> needed to read this document.

## 1. Overview

### 1.1 Schema identity

| Property | Value |
|---|---|
| `schema_id` | `dbd-1v1-symmetric` |
| `schema_version` | `1.0` |

A snapshot uses this contract when its `public_facts_schema` declares this
`schema_id` and a supported `schema_version`. Section 6 defines compatibility.

### 1.2 The format

A DBD 1v1 symmetric duel has two players. Both players use the same killer
character. Each player plays both the killer and the survivor during the duel.

The duel is a best-of-3. Each round goes to the player with the longer chase.
The first player to win 2 rounds wins the match. A match ends 2-0 or 2-1. There
are no draws.

### 1.3 What this contract adds

The envelope already says which players met, on which sides, and with which
outcome. This contract adds two facts per match:

- which side won the match;
- how many rounds each side won.

The killer character is not a per-match fact. It comes from the snapshot's
scope, as Section 3 requires.

## 2. Public Facts

### 2.1 `DbdSymmetricFacts`

This is the shape of every `included_matches[].public_facts` object.

| Field | Type | Meaning / constraint |
|---|---|---|
| `winner_side_id` | `PublicId` | Side that won the match. Equals the `side_id` of one of this match's two sides. |
| `rounds_won_by_side` | map[`PublicId`, `Count`] | Rounds each side won in this match. Keys are exactly this match's two `side_id` values. |

Both fields are required and non-null. A version `1.0` object contains no other
fields.

### 2.2 Value rules

- The winning side has exactly `2` rounds won.
- The other side has `0` or `1` rounds won.
- So every match score is `2-0` or `2-1`.

### 2.3 Reference scope

Both fields refer to envelope side IDs. The scope is the enclosing match:

- `winner_side_id` must match a `sides[].side_id` of the same
  `IncludedMatchEvidence` record.
- Each key of `rounds_won_by_side` must match a `sides[].side_id` of that same
  record, and every such side must appear as a key.

A side ID from a different match, or one that is only in `side_definitions`,
is not a valid reference. To find the winning player, take the side whose
`side_id` equals `winner_side_id`. Its only participant is the winner.

## 3. Envelope Usage Profile

A snapshot that declares this schema uses the envelope as follows. These rules
narrow the envelope; they never contradict it.

### 3.1 Scope

`publication.scope` contains exactly one selection whose category is the killer
character. Both players in every included match used that killer. The category
and value labels name the killer for display.

### 3.2 Sides

`side_definitions` contains exactly two definitions. Each one is a neutral
seat. A seat tells the two players apart within a match. It carries no
published competitive meaning: it does not say who played killer first, and it
is not an advantage.

Every included match lists both seats in `sides`. Seat IDs do not follow a
player across matches. The same player can hold either seat in different
matches.

### 3.3 Participants and roles

- Each side has exactly one participant.
- Every match participant has `kind = participant`. Groups do not compete in
  this format.
- `role_definitions` is empty, and every `role_ids` list is empty. Both players
  play both roles, so no single role describes a player's part in the match.

### 3.4 Outcome

`public_outcomes` contains exactly one definition. Every included match uses
it as its `outcome_id`. Its description says that the match was decided and
that `public_facts.winner_side_id` identifies the winner.

### 3.5 Result metrics

`result_metrics` contains exactly two definitions:

| Meaning | Count for a row |
|---|---|
| Match wins | Included matches where the row's profile was on the winning side. |
| Match losses | Included matches where the row's profile was on the other side. |

The publication chooses the IDs, labels, and descriptions. Because there are no
draws, a row's wins plus losses equal its `eligible_match_count`.

### 3.6 Boards

`boards` contains exactly one board. It ranks players (`kind = participant`).
In each of a row's included matches, the row's profile is the participant of
one of the two seats. The publication chooses the board ID, label, and
description.

The board's entry rating is specific to the scoped killer. Its
`eligibility.rating` definition explains this.

## 4. Example

IDs and names below are illustrative. Only the fields this contract constrains
are shown.

```json
{
  "publication": {
    "scope": [
      {
        "category": { "id": "killer", "label": "Killer", "description": "Killer character used by both players." },
        "value": { "id": "trapper", "label": "The Trapper", "description": "Both players used The Trapper." }
      }
    ]
  },
  "side_definitions": [
    { "id": "seat-1", "label": "Player 1", "description": "First of the two seats in a duel. Seats have no competitive meaning." },
    { "id": "seat-2", "label": "Player 2", "description": "Second of the two seats in a duel. Seats have no competitive meaning." }
  ],
  "role_definitions": [],
  "public_outcomes": [
    { "id": "decided", "label": "Decided", "description": "One player won the best-of-3. public_facts.winner_side_id identifies the winner." }
  ],
  "result_metrics": [
    { "id": "wins", "label": "Wins", "description": "Included matches this player won." },
    { "id": "losses", "label": "Losses", "description": "Included matches this player lost." }
  ],
  "public_facts_schema": {
    "schema_id": "dbd-1v1-symmetric",
    "schema_version": "1.0"
  },
  "included_matches": [
    {
      "match_id": "m-7f3a",
      "sides": [
        { "side_id": "seat-1", "participants": [{ "profile_id": "p-alice", "role_ids": [] }] },
        { "side_id": "seat-2", "participants": [{ "profile_id": "p-bob", "role_ids": [] }] }
      ],
      "outcome_id": "decided",
      "public_facts": {
        "winner_side_id": "seat-2",
        "rounds_won_by_side": { "seat-1": 1, "seat-2": 2 }
      }
    }
  ]
}
```

In this match, `p-bob` won 2-1.

## 5. Validation and Exclusions

### 5.1 What a consumer can check

Using one match record:

- `public_facts` has exactly the fields in Section 2.1, with valid types.
- `winner_side_id` and the `rounds_won_by_side` keys follow Section 2.3.
- The scores follow Section 2.2.

Using the whole snapshot:

- The scope, sides, participants, roles, outcome, metric counts, and boards
  follow Section 3.
- Each row's wins plus losses equal its `eligible_match_count`.

### 5.2 Publisher guarantees

A consumer cannot check these. The publisher guarantees them:

- Both players in each match used the killer named in the scope.
- Seat assignment carries no competitive meaning.
- The outcome, metric, and board descriptions match the meanings in Section 3.
- The board's entry rating is specific to the scoped killer.
- Facts match the accepted result of the match.

### 5.3 Not published

These facts are not part of this contract:

- chase durations and other per-round details;
- the order in which rounds were won;
- which player played killer or survivor in each round;
- in-game player IDs, platform accounts, and result reporters;
- private result records or their revision history.

The envelope's exclusion rules also apply in full.

## 6. Versioning and Compatibility

`schema_version` uses `major.minor` form. It is independent of the envelope
version and of this document's frontmatter version.

- A **minor** version may add optional fields to `public_facts`. Existing
  fields keep their meaning. A consumer that supports `1.0` may ignore unknown
  fields in any `1.x` object.
- A **major** version is needed for any other change. Examples: a removed or
  renamed field, a changed type, new allowed scores, permitting draws, a new
  round count to win, or a change to the envelope usage profile.
- A consumer must not assume support for an unknown major version.

The definition of a published `(schema_id, schema_version)` pair never changes.
The JSON Schema artifact and this documentation are published at the paths the
snapshot gives in `public_facts_schema`.

## 7. Current Limits

This is the logical contract. Its machine-checkable form for version `1.0` is
[schemas/dbd-1v1-symmetric-1.0.schema.json](schemas/dbd-1v1-symmetric-1.0.schema.json).
If the two disagree, this document is authoritative. The schema reuses envelope
types from the envelope schema by relative reference, so both files are
published in the same folder.

The JSON Schema checks one `public_facts` object: its fields, its types, and
that the score is `2-0` or `2-1`. It cannot check that the side with `2` rounds
is `winner_side_id`, because that depends on a value in the same object. It
also cannot check the reference rules in Section 2.3 or the profile rules in
Section 3. Those need a check that reads the enclosing match or the whole
snapshot.

This contract covers only the symmetric format. The asymmetric 1v1 format has
fixed killer and survivor sides, so it needs its own contract.
