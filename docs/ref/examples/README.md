# Sample ranking snapshot

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
not demonstrate pagination or empty standings. Per-match dates, rank movement,
and chase durations are unavailable in this contract; match IDs and list order
do not establish chronology.

For a local preview, serve this directory with its parent documentation and
`schemas` directory so the relative evidence links resolve. For a published
preview, also publish the envelope schema and linked documentation, preserve
their relative paths, and pin the evidence artifacts to the declared version
as required by the public contract. Do not copy schema definitions into the
fixture or website.
