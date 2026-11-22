---
version: "0.4"
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
    - source-to-public-mapping: "Owned by ranking-generator-dbd-1v4-quartet-mapping.md"
    - ranking-calculation: "Owned by ranking-system-design.md"
    - concrete-json-schema-artifact: "Implemented by schemas/dbd-1v4-quartet-match-1.0.schema.json; this document stays authoritative"
  cross_reference_allowed:
    - DS
---

# DBD 1v4 Quartet - Public Evidence Schema

> **Purpose:** Define the public match facts for Dead by Daylight 1v4 quartet
> matches, and the rules a ranking snapshot follows when it uses them.
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
| `schema_id` | `dbd-1v4-quartet-match` |
| `schema_version` | `1.0` |

A snapshot uses this contract when its `public_facts_schema` declares this
`schema_id` and a supported `schema_version`. Section 7 defines compatibility.

This evidence contract supports envelopes `1.0`, `1.1`, and `2.0`. Its field
meanings and format constraints are unchanged. In `1.x`, the envelope defines
eligibility and `eligible_match_count`. With `2.0`, the publications described
here use the [DBD ranking extension](ranking-extension-dbd-1.0.md) to supply
those same definitions. The base `2.0` schema alone does not define them.

### 1.2 The format

A DBD 1v4 quartet match has two sides:

- the **killer** side: one player, using one killer character;
- the **survivor** side: one party of four players, who compete together as a
  single ranked unit.

A match ends in a killer win, a survivor win, or a draw.

### 1.3 What this contract adds

The envelope already says which units met, on which side, and with which
outcome. This contract adds four facts per match:

- which side won, or that the match was a draw;
- generators left unrepaired at the end;
- hooks the killer performed;
- survivors killed.

The killer character is not a per-match fact. It comes from the snapshot's
scope, as Section 3 requires.

## 2. Public Facts

### 2.1 `DbdQuartetMatchFacts`

This is the shape of every `included_matches[].public_facts` object.

| Field | Type | Meaning / constraint |
|---|---|---|
| `winner_side_id` | `PublicId` or null | Side that won the match. Null exactly when the match was a draw. Otherwise equals the `side_id` of one of this match's two sides. |
| `generators_remaining` | `Count` | Generators left unrepaired at the end of the match. `0` to `5`. |
| `hooks` | `Count` | Total hooks the killer performed during the match. `0` to `12`. |
| `kills` | `Count` | Survivors killed. `0` to `4`. |

All four fields are required. Only `winner_side_id` may be null. A version
`1.0` object contains no other fields.

### 2.2 Value rules

Every match satisfies all of these rules:

| Rule | Why |
|---|---|
| `hooks >= 3 * kills` | Each counted kill takes three hooks. |
| `kills >= hooks - 8` | At most eight hooks fit without a kill. |
| `generators_remaining > 0` implies `kills = 4` | Generators can remain only if the killer killed every survivor. |
| A survivor-side win implies `generators_remaining <= 1` | Survivors cannot win with two or more generators left. |
| A killer-side win implies `hooks >= 1` | The killer cannot win without a hook. |

A draw adds no further rule.

### 2.3 Reference scope

`winner_side_id` refers to an envelope side ID. Its scope is the enclosing
match: when non-null, it must match a `sides[].side_id` of the same
`IncludedMatchEvidence` record. A side ID that is only in `side_definitions` is
not a valid reference.

The winner rules in Section 2.2 use the fixed side IDs in Section 3.2.

## 3. Envelope Usage Profile

A snapshot that declares this schema uses the envelope as follows. These rules
narrow the envelope; they never contradict it.

### 3.1 Scope

`publication.scope` contains exactly one selection whose category is the killer
character. The killer side of every included match used that killer. The
category and value labels name the killer for display.

### 3.2 Sides

`side_definitions` contains exactly two definitions, with these fixed IDs:

| `id` | Meaning |
|---|---|
| `killer` | The killer side. |
| `survivors` | The survivor side. |

The publication supplies the labels and descriptions. Every included match
lists both sides, `killer` first.

### 3.3 Participants and roles

- The `killer` side has exactly one participant, with `kind = participant`.
- The `survivors` side has exactly one participant, with `kind = group`. The
  group is the survivor party.
- `role_definitions` is empty, and every `role_ids` list is empty. The side
  already says what each unit does in the match.

A group's `group_members` are its published members when the snapshot was
generated. They do not say which four players played any particular match.

### 3.4 Outcomes

`public_outcomes` contains exactly two definitions:

| Meaning | Used by |
|---|---|
| Decided: one side won, identified by `public_facts.winner_side_id`. | Every match whose `winner_side_id` is non-null. |
| Draw: neither side won. | Every match whose `winner_side_id` is null. |

The publication chooses the IDs, labels, and descriptions.

### 3.5 Result metrics

`result_metrics` contains exactly three definitions. Each one counts from the
row's own perspective:

| Meaning | Count for a row |
|---|---|
| Wins | Included matches where the row's profile was on the winning side. |
| Losses | Included matches where the other side won. |
| Draws | Included matches that were draws. |

The publication chooses the IDs, labels, and descriptions. A row's wins,
losses, and draws add up to its `eligible_match_count`.

### 3.6 Boards

`boards` contains exactly two boards, in this order:

| Board | Ranks | Row profile appears in each included match as |
|---|---|---|
| Killer board | Killer players (`kind = participant`). | The `killer` side's participant. |
| Survivor board | Survivor parties (`kind = group`). | The `survivors` side's participant. |

Killers and survivor parties are never ranked against each other. The
publication chooses the board IDs, labels, and descriptions.

Each board's entry rating is specific to the scoped killer and to the board's
side. Its `eligibility.rating` definition explains this.

Killer and survivor-party thresholds are configured independently under the
[DBD extension's per-board rules](ranking-extension-dbd-1.0.md#2-dbdeligibilityrequirements).
A killer's minimum match count applies against eligible survivor parties; a
survivor party's minimum applies against eligible killers. Different thresholds
do not remove that dependence on the opposing eligible pool.

## 4. Example

IDs and names below are illustrative, except the fixed side IDs. Only the
fields this contract constrains are shown.

```json
{
  "publication": {
    "scope": [
      {
        "category": { "id": "killer", "label": "Killer", "description": "Killer character used by the killer side." },
        "value": { "id": "nurse", "label": "The Nurse", "description": "The killer side played The Nurse." }
      }
    ]
  },
  "side_definitions": [
    { "id": "killer", "label": "Killer", "description": "The single player hunting the survivors." },
    { "id": "survivors", "label": "Survivors", "description": "The party of four trying to escape." }
  ],
  "role_definitions": [],
  "public_outcomes": [
    { "id": "decided", "label": "Decided", "description": "One side won. public_facts.winner_side_id identifies it." },
    { "id": "draw", "label": "Draw", "description": "Neither side won." }
  ],
  "result_metrics": [
    { "id": "wins", "label": "Wins", "description": "Included matches this unit's side won." },
    { "id": "losses", "label": "Losses", "description": "Included matches the other side won." },
    { "id": "draws", "label": "Draws", "description": "Included matches that ended in a draw." }
  ],
  "public_facts_schema": {
    "schema_id": "dbd-1v4-quartet-match",
    "schema_version": "1.0"
  },
  "included_matches": [
    {
      "match_id": "m-91c2",
      "sides": [
        { "side_id": "killer", "participants": [{ "profile_id": "p-carol", "role_ids": [] }] },
        { "side_id": "survivors", "participants": [{ "profile_id": "g-team-fog", "role_ids": [] }] }
      ],
      "outcome_id": "decided",
      "public_facts": {
        "winner_side_id": "killer",
        "generators_remaining": 2,
        "hooks": 12,
        "kills": 4
      }
    },
    {
      "match_id": "m-91c3",
      "sides": [
        { "side_id": "killer", "participants": [{ "profile_id": "p-carol", "role_ids": [] }] },
        { "side_id": "survivors", "participants": [{ "profile_id": "g-team-fog", "role_ids": [] }] }
      ],
      "outcome_id": "draw",
      "public_facts": {
        "winner_side_id": null,
        "generators_remaining": 0,
        "hooks": 7,
        "kills": 2
      }
    }
  ]
}
```

In the first match, the killer killed all four survivors with two generators
left. The second match was a draw.

## 5. Validation

### 5.1 What a consumer can check

Using one match record:

- `public_facts` has exactly the fields in Section 2.1, with valid types and
  ranges.
- `winner_side_id` follows Section 2.3.
- The facts satisfy every rule in Section 2.2.

Using the whole snapshot:

- The scope, sides, participants, roles, outcomes, metrics, and boards follow
  Section 3.
- Matches with a winner share one outcome; draws share the other.
- Each row's wins, losses, and draws add up to its `eligible_match_count`.

### 5.2 Publisher guarantees

A consumer cannot check these. The publisher guarantees them:

- The killer side of each match used the killer named in the scope.
- The outcome, metric, and board descriptions match the meanings in Section 3.
- Each board's entry rating is specific to the scoped killer and its side.
- Facts match the accepted result of the match.

## 6. Not Published

These facts are not part of this contract:

- which survivors died or escaped, and per-survivor details;
- the four players who played a match for the survivor party;
- maps, perks, add-ons, offerings, and match duration;
- in-game player IDs, platform accounts, and result reporters;
- private result records or their revision history.

The envelope's exclusion rules also apply in full.

## 7. Versioning and Compatibility

`schema_version` uses `major.minor` form. It is independent of the envelope
version and of this document's frontmatter version.

- A **minor** version may add optional fields to `public_facts`. Existing
  fields keep their meaning. A consumer that supports `1.0` may ignore unknown
  fields in any `1.x` object.
- A **major** version is needed for any other change. Examples: a removed or
  renamed field, a changed type, a changed range, a changed value rule, or a
  change to the envelope usage profile.
- A consumer must not assume support for an unknown major version.

The definition of a published `(schema_id, schema_version)` pair never changes.
The JSON Schema artifact and this documentation are published at the paths the
snapshot gives in `public_facts_schema`.

## 8. Current Limits

This is the logical contract. Its machine-checkable form for version `1.0` is
[schemas/dbd-1v4-quartet-match-1.0.schema.json](schemas/dbd-1v4-quartet-match-1.0.schema.json).
If the two disagree, this document is authoritative. The schema reuses envelope
types from the envelope schema by relative reference, so both files are
published in the same folder.

The JSON Schema checks one `public_facts` object: its fields, types, ranges, and
every rule in Section 2.2. Because Section 3.2 fixes the side IDs, it also
limits `winner_side_id` to `killer`, `survivors`, or null. It cannot check that
the side appears in the same match (Section 2.3) or the profile rules in
Section 3. Those need a check that reads the enclosing match or the whole
snapshot.

This contract covers only the quartet format. The duo+duo format has two
survivor parties on one side, so it needs its own contract.
