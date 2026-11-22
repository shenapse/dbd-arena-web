# Sample ranking snapshots

All snapshots use envelope `2.0` and the
[DBD ranking extension](../ranking-extension-dbd-1.0.md). Their
`extension_schema` references identify the contract for eligibility and
`eligible_match_count`; these meanings are not part of the base envelope.

## Symmetric 1v1

[ranking-snapshot-dbd-1v1-symmetric.json](ranking-snapshot-dbd-1v1-symmetric.json)
is a fictional fixture for reviewing a rendered leaderboard, player details,
and match evidence. It contains one Trapper board, six players, and twelve duels.
Load the JSON directly; the website needs no private catalogs or generator data.

The [public snapshot contract](../ranking-system-data-schema.md) and
[symmetric 1v1 evidence contract](../ranking-evidence-dbd-1v1-symmetric.md)
remain authoritative. Scores are hand-authored, not model output. The entry
rating scale, thresholds, and repeat-encounter policy are illustrative choices,
not proposed production settings.

| Review case | What the fixture makes visible |
|---|---|
| Competition context | Killer scope, season dates, generation time, score meaning, eligibility, and methodology all come from the snapshot. |
| Tied standings | Two players share third place; the next rank is fifth. Preserve the supplied row order. |
| Identity and typography | Two distinct profiles are named Echo. A Japanese name and a long English name exercise font support and wrapping. Join records by profile ID. |
| Repeat opponents | The top two players meet twice, exchange seats, and split the wins. Match counts differ from opponent counts. Both encounters remain visible despite the contribution cap. |
| Match detail | Both 2–0 and 2–1 results appear, with winners in either seat. The Echo-versus-Echo duel also exercises navigation between identically named profiles. |
| Participation boundary | Mika has exactly the minimum match count and zero wins. A zero win count must remain visible. |
| Score versus entry rating | Some ranking scores are below the entry threshold. These are separate scales; a website must not infer ineligibility from the ranking score. |

The snapshot supports a substantive single-page review with a standings table,
player details, match detail, and explanations of the ranking rules. It does
not demonstrate pagination or empty standings. Match times use `played_at`,
which is null when unknown. Rank movement and chase durations are unavailable;
match IDs and list order do not establish chronology.

## 1v4 quartet

[ranking-snapshot-dbd-1v4-quartet.json](ranking-snapshot-dbd-1v4-quartet.json)
is a fictional fixture with separate killer and survivor-party boards for
The Nurse. It contains three killer players, three survivor parties with four
published members each, and ten matches. Survivors queue together as a group
of four; each party occupies one leaderboard row and counts as one opponent.

The [public snapshot contract](../ranking-system-data-schema.md) and
[quartet evidence contract](../ranking-evidence-dbd-1v4-quartet.md) remain
authoritative. Scores, entry thresholds, and the repeat-encounter policy are
illustrative. Load the JSON directly; no private catalogs are needed.

| Review case | What the fixture makes visible |
|---|---|
| Party identity | Each survivor side references one group profile. Its four members are published on the group, not as separate ranked match participants. Membership describes the generation-time roster, not historical match lineups. |
| Separate standings | Killer players and survivor parties have distinct boards and Nurse-specific entry ratings. Scores are comparable only within the same board and snapshot. |
| Independent eligibility | The boards publish different minimum ratings and match counts. Read each board's own `eligibility`; the shared field names do not imply shared values. |
| Results from both sides | Killer wins, survivor wins, and draws appear. Each row counts results from its own perspective; draws have a null winning side. |
| Repeat opponents | Hush and Team Fog meet twice and split the wins. Each has four matches but three opponents. Both encounters remain visible despite the contribution cap. |
| Match facts | Evidence includes generators remaining, hooks, and kills, including a zero-hook survivor win and a killer win with five generators remaining. |
| Participation boundary | Two killer rows meet their board's match minimum exactly; all survivor parties exceed their own board's minimum. Wisp and Four Lanterns have zero wins, and their ranking scores are below their respective entry-rating thresholds. |
| Match time | Known times are published in `played_at`; one match has null because its time is unavailable. IDs and list order do not establish chronology. |

## 1v4 PUG

[ranking-snapshot-dbd-1v4-pug.json](ranking-snapshot-dbd-1v4-pug.json)
contains two killer players, six survivor players, and twenty-two matches against
The Nurse. Both boards rank individuals and use the DBD ranking extension.
Killers require an entry rating of at least 1200 points and more than ten matches
against eligible opponents; survivors require at least 300 points and more than
five matches. The inclusive match minimums are therefore eleven and six.
Each match counts once per player regardless of opponent count or party size.
All displayed rows meet their board's requirements. Scores are illustrative;
no repeat-encounter limits apply.

The [PUG evidence contract](../ranking-evidence-dbd-1v4-pug.md) defines party
membership under each match's `public_facts`. `survivor_parties` lists who
queued together, and `solo_survivor_profile_ids` explicitly lists solo entrants.
Every survivor appears exactly once across these lists. Party membership can
change between matches without changing the player's ranking identity.
Each match also publishes `generators_remaining` and `hooks` for the whole
match, as the quartet evidence does; they include a zero-hook survivor win and
killer wins with every generator repaired or four left unrepaired.

| Match | Survivor queue composition |
|---|---|
| `pug-01` | Four solo survivors. |
| `pug-02` | One duo and two solo survivors. |
| `pug-03` | Two separate duos. |
| `pug-04` | One trio and one solo survivor. |
| `pug-05` | One party of four, with each member still ranked individually. |

The first five matches above cover every queue composition; additional matches
supply the evidence needed to meet eligibility requirements.
The fixture also includes changed party partners, side wins and draws, and two
survivors tied at second place followed by fourth place. Side result counts
do not describe whether an individual survivor escaped.

## 1v4 PUG overall survivors

[ranking-snapshot-dbd-1v4-pug-survivors-overall.json](ranking-snapshot-dbd-1v4-pug-survivors-overall.json)
contains one overall survivor board, six ranked survivors, two killer opponents,
and twenty-two matches across four killer characters. `publication.scope` is
empty. Killer players appear in match sides and public profiles; there is no
killer board. Each match records its generators remaining and hooks as the
per-killer PUG sample does, and identifies its killer character in
`public_facts.killer_character` under the
[overall PUG evidence contract](../ranking-evidence-dbd-1v4-pug-overall.md).

The board's `eligibility.rating` defines an equal-weight average of survivor
ratings across all available killer characters, including how missing ratings
are handled. Read that definition for the calculation. The gate requires at
least 300 blended points and six matches against eligible killer players.
The blended entry value and displayed ranking score are separate.

Trapper matches contribute naturally to overall survivor performance alongside
matches against the other killer characters. Killer players use multiple
characters but still count as one opponent each. Party and solo membership
remain explicit for every match. Scores are hand-authored illustrations.

## Previewing a snapshot

For a local preview, serve this directory with its parent documentation and
`schemas` directory so the relative extension and evidence links resolve. For a
published preview, also publish the envelope schema and linked documentation,
preserve their relative paths, and pin extension and evidence artifacts to their
declared versions as required by the public contract. Do not copy schema
definitions into the fixture or website. Evidence schemas retain references to
common types in the `1.0` envelope artifact, so publish that transitive dependency
as well as `2.0`.
