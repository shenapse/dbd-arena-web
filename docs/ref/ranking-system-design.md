# Ranking System Design

## Background

The matchmaking system and the ranking system serve different purposes and are designed independently.

* **MMR**: Estimates team skill for matchmaking quality.
* **Ranking**: Measures competitive performance among top teams.

For matchmaking purposes, a newly created team may inherit an initial MMR derived from its members' existing teams. Consequently, a newly formed team may begin with a relatively high MMR without having established competitive results.

Therefore, MMR is not an appropriate metric for determining competitive rankings directly. Instead, the ranking system is designed as an independent evaluation system.

---

## Design Overview

The ranking process consists of two stages.

1. Use current MMR and participation requirements to identify the pool of teams eligible for ranking.
2. Compute a dedicated ranking rating using only matches played within the eligible pool.

MMR is used **only as an entry criterion** and does not directly influence the ranking score.

Eligibility is evaluated at calculation time. The ranking is therefore a snapshot of the current eligible pool, not a permanent historical judgment about whether each match was eligible when it was played.

Although MMR does not directly contribute to the ranking score, it indirectly affects ranking by determining which teams enter the eligible pool.

---

## Ranking Rating

### Initialization

All teams start with the same initial ranking rating.

The ranking rating is intentionally independent of MMR and does not inherit any information from a team's matchmaking rating or previous team history.

### Match Scope

The ranking rating is estimated using current-season matches played between teams in the calculation-time eligible pool.

A team must satisfy a hard minimum participation requirement to enter the eligible pool. The minimum match count is based on current-season matches against teams in the calculation-time eligible pool.

### Estimation Method

The ranking rating is estimated from the entire set of eligible matches as a batch optimization problem rather than through sequential updates.

This design aims to:

* minimize dependence on match order,
* minimize dependence on initial values,
* decouple the ranking system from the underlying matchmaking rating algorithm.

A Bradley-Terry family model (or another equivalent batch-estimation model) is assumed for the ranking calculation.

The batch model must include regularization. For example, the implementation may use a zero-centered prior on each team's ranking strength and an explicit scale anchor such as mean rating = 0.

Regularization is required to handle common edge cases:

* undefeated or winless teams must not receive infinite estimates,
* low-sample teams should remain close to the average until they have enough evidence,
* disconnected match graphs should still produce finite ratings, while making cross-cluster ordering mostly prior-driven.

---

## Match Selection

All current-season matches between teams in the calculation-time eligible pool are included in the ranking calculation.

Since seasons are intentionally short, no time-decay mechanism is applied.

To prevent excessive influence from repeatedly playing the same opponent, the contribution of any single matchup is capped. This reduces the impact of:

* repeatedly farming the same opponent,
* accidental overrepresentation of specific matchups.

The exact cap policy is intentionally left as a later implementation detail. The policy must define whether the cap applies to team pairs, team pairs by side or role, or another matchup key, and whether the cap limits raw match count or model weight.

---

## Design Rationale

The primary goal of this design is to separate:

* matchmaking quality, and
* competitive ranking.

MMR estimates which teams should be matched against each other, while the ranking system evaluates how successfully teams compete within the top competitive pool.

Accordingly, the ranking system depends on actual competitive results rather than on the matchmaking rating itself.

Because eligibility is evaluated at calculation time, rankings may change when the eligible pool changes, even if no new matches are played. This is acceptable because the leaderboard is defined as a recalculated snapshot of current-season performance among currently eligible teams.

---

## Assumptions and Constraints

* Matchmaking and ranking are independent systems with different objectives.
* MMR is used only to determine ranking eligibility and does not directly contribute to ranking score.
* MMR still influences ranking indirectly by determining the calculation-time eligible pool.
* Eligibility is evaluated at calculation time.
* A team must meet a hard minimum match count against teams in the calculation-time eligible pool.
* All teams begin with the same ranking rating.
* Ranking ratings are estimated from the complete set of eligible matches rather than through sequential updates.
* Batch estimation must use regularization so edge cases produce finite, stable ratings.
* Seasons are assumed to be sufficiently short; therefore, time decay is not applied.
* The influence of repeated matches between the same pair of teams is capped.
* Detailed participation requirements beyond the minimum match-count rule, such as inactivity rules, are intentionally excluded from this design and will be specified separately.
