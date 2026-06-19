---
version: "0.1"
doc_type: "service concept"
scope:
  in_scope:
    - service-purpose
    - player-value
    - dbd-deployment-context
  out_of_scope:
    - exact-page-layout-and-copy: "Downstream website design concern"
    - player-facing-copy-and-advertising-guidance: "Downstream website content concern"
    - rating-algorithm-details: "Owned by rating-system and deployment configuration docs"
    - public-leaderboard-contract: "Future product scope; not defined here"
  cross_reference_allowed:
    - UX
    - SLA
---

# DBD Arena Service Concept

> Internal concept note for the service owner, developers, and future
> maintainers. This explains what value the Dead by Daylight deployment is meant
> to deliver and why the current shape exists.

## 1. Purpose

DBD Arena exists to create exciting, serious custom Dead by Daylight matches for
both sides.

The service is not only a queue. The queue is infrastructure. The product value
is a competitive arena where players can find matches worth preparing for, play
under published conditions, and receive better evidence of how strong they are.

The format and rating model are easiest to understand from the killer side,
because killer strength in DbD is character-specific. That does not make the
service a killer-only product. The match experience depends on both sides, and
survivor teams are active competitors.

## 2. The DbD Comparison Problem

Dead by Daylight is asymmetric. In many PvP games, strong players can be
compared directly because they face each other in the same role. In DbD, killers
do not face killers, and survivors do not face survivors.

That makes direct skill comparison difficult:

- A killer player's result depends on which killer character they played.
- A survivor result depends heavily on the team, not only one player.
- Public matches contain many uncontrolled factors: map, tile generation,
  teammates, loadouts, surprise information, and opponent quality.
- Official matchmaking is built to form games, not to produce public proof of
  competitive strength.

Competitive tournaments partly solve this by using stricter rules and mirrored
match structures. They are useful, but they are not a practical answer for most
serious players who simply want regular high-quality matches and credible skill
evidence.

## 3. Service Concept

DBD Arena is a controlled custom-match arena for serious community competition.

It should be understood as:

- a place to find stronger, more intentional matches;
- a place to test killer-specific strength;
- a place for survivor teams to prove coordination against serious killers;
- a rating-backed environment where results are more comparable than ordinary
  public matches.

The service is not:

- a perfect measurement of pure skill;
- a replacement for official matchmaking;
- a replacement for existing comp tournaments;
- a public leaderboard product until that surface is deliberately designed.

## 4. Value For Players

The player value is:

1. Challenge: find serious matches worth playing.
2. Proof: get better evidence of strength under controlled rules.
3. Recognition: build visible service rating now; add public recognition only
   when a leaderboard or ranking surface is formally designed.

For killers, the value is specific proof. A player does not merely show that
they won a match. They show what they can do with a particular killer, against a
serious survivor team, under conditions other players can also play.

For survivor teams, the value is coordinated competition. The team is not a
background variable in the rating model. It is the opponent that serious killers
must beat.

For both sides, the value is match quality. Better rules and ratings are not the
end product by themselves. They support matches that feel earned.

## 5. Role Balance

The current format is killer-specific, but the competition belongs to both
sides.

This distinction matters. The service needs killer-specific measurement because
DbD killers are mechanically different and vary heavily in strength. It also
needs survivor teams because high-level survivor play is coordinated by nature,
and individual survivor measurement is much harder to isolate reliably at
the current stage.

Survivors are not a source of noise or a tool for evaluating killers. The design
reduces rating noise by rating full survivor teams, but the concept is broader:

- killers prove their strength on a specific killer;
- survivor teams prove coordinated strength;
- both sides receive serious matches under shared rules.

## 6. Design Pillars

### 6.1 Per-killer rating

Killer characters are not interchangeable. A result on Blight and a result on
Doctor do not provide the same skill signal, even if the final match outcome
looks identical.

The service should preserve that distinction. Killer performance evidence is
collected per killer character so the rating has a clearer meaning.

### 6.2 Team-based survivor evaluation

Individual survivor skill is real, but match results are a weak way to isolate
it. One weak link can decide the whole match, especially when the killer can
pressure or eliminate that player early.

The current model rates the survivor side as a full team. That makes the match
closer to a clean 1v1 rating problem: one killer player against one survivor
team.

### 6.3 Controlled regulations

Comparable results need comparable conditions. Fixed or tightly controlled
rules reduce how often the result is explained by map luck, unusual builds, or
hidden information rather than performance.

This does not remove all uncertainty. DbD still has execution variance,
adaptation, and in-game decisions. Controlled regulations create less noise and
more comparable results than ordinary public matches, but they do not eliminate
luck or uncertainty.

### 6.4 Visible personal rating

Ratings are visible to the relevant player or team. They help players understand
their level and help the service form better matches.

Rating is not final proof by itself. Rating is useful evidence, but it is also a
matchmaking tool. It can be affected by activity, population shape, and who was
available to play.

### 6.5 Future recognition layer

A public leaderboard or ranked recognition layer is a future product surface,
not part of the current service concept. It should be designed separately
because it needs clear publication rules, privacy treatment, ranking criteria,
and data access.

The concept is still useful:

- rating can identify likely high-skill competitors;
- direct results among qualified competitors can support stronger recognition;
- matchmaking rating and public ranking should not be treated as the same
  thing.

Until that surface exists, the service concept includes visible personal or team
rating only. Public leaderboard-style recognition remains future scope.
