---
version: "0.1"
doc_type: "UX concept"
scope:
  in_scope:
    - discord-server-layout
    - canonical-player-journeys
    - public-and-private-interaction-boundaries
    - group-thread-lifecycle
    - match-thread-lifecycle
  out_of_scope:
    - canonical-operation-rules: "Source of truth is docs/UX-matchmaking-service.md"
    - detailed-command-behaviour: "Source of truth is docs/discord-ui/UX-discord-bot-commands.md and its referenced command documents"
    - exact-message-copy-and-component-layout: "Deployment-owned"
    - community-chat-support-and-voice-layout: "Deployment-owned"
    - framework-internals: "See SLA and CLA documents"
  cross_reference_allowed:
    - UX
    - SLA
    - CLA
---

# Discord Server Experience

> Defines the conceptual Discord server layout and the canonical player interaction journeys for the Dead by Daylight matchmaking deployment.
>
> This document owns **where** user-facing operations happen and **how** players move between those spaces. `docs/UX-matchmaking-service.md` remains authoritative for operation rules. Detailed commands and controls remain in the Discord command UX documents.

---

## 1. Experience Model

Discord is the user-facing interface. The matchmaking framework remains the authoritative owner of players, groups, queue tickets, matches, results, and ratings.

The server follows four principles:

- Public channels provide guidance and stable entrypoint panels, not private matchmaking state.
- A survivor group has one permanent private thread for group coordination and request management; each formed match uses a separate request-scoped readiness thread.
- Match participants remain mutually concealed until everyone confirms readiness.
- Once everyone is ready, one shared private match thread becomes the workspace for coordination and result reporting.

Persistent bot panels are the canonical public entrypoints. Slash commands may remain available as contextual fallbacks, except that opening a group thread has no user-facing slash command.

---

## 2. Server Layout

### 2.1 Player Registration

One server-wide registration channel contains a persistent Player Profile panel.

Players use it to register, edit their player-editable profile fields, and inspect their profile. Forms and responses are ephemeral so identity and profile data do not appear publicly.

### 2.2 Groups Category

One server-wide Groups category contains:

- A public group entrypoint channel with a persistent **Create Group Thread** panel.
- Private group threads created from that panel.

Groups are server-wide rather than regulation-specific. A durable group may submit requests to any compatible regulation.

### 2.3 Regulation Categories

Every enabled Regulation Context has a dedicated category containing:

- **Guide**: a read-only explanation of the regulation, eligibility, queue mode, and expected match flow.
- **Matchmaking**: a public persistent panel for regulation-scoped matchmaking actions.
- **Match notices**: a text channel used as the parent for private notice and shared match threads; no private match state is posted to the public channel itself.

The category pattern is repeated for every configured regulation. Regulation-specific forms, roles, and declarations come from that regulation's configuration. DBD 1v4 is the primary deployment example.

### 2.4 Staff Area

The matchmaking-owned staff area contains:

- A private operations channel for staff commands and intervention.
- A separate read-only audit-log channel for bot and staff actions.

Rules, welcome, support, general chat, community voice, and moderation-discussion channels are outside this document.

---

## 3. Public And Private Boundaries

Public matchmaking channels contain only guides and entrypoint panels.

The following remain private:

- Player profiles and identity details.
- Queue membership and queue status.
- Match formation and readiness.
- Participant identities and assignments.
- Result proposals, accepted results, and rating outcomes.

The bot does not create or manage match voice channels. Communities may provide voice or streaming infrastructure separately.

---

## 4. Canonical Player Journeys

### 4.1 Register And Manage A Profile

1. The player opens the Player Profile panel in the registration channel.
2. The player registers, edits permitted fields, or views their profile.
3. The bot collects form input and returns the outcome ephemerally.
4. Registration is required before group or matchmaking operations.

### 4.2 Create A Survivor Group

1. A registered player uses the Groups panel to create a private coordination thread.
2. Thread members invite the intended survivor players into that thread.
3. A member runs `/group create` inside the thread.
4. The bot snapshots the human thread members and validates registration, eligibility, and group size.
5. Every proposed member explicitly consents to create the permanent group.
6. After unanimous consent, the bot creates the durable group and binds the thread to it.
7. Ordinary member invitations are then disabled. A different survivor lineup requires another thread and another durable group.

The group member set is immutable. Renaming the durable group also updates the Discord thread name.

The group thread contains group details, rename, matchmaking request, queue-again, status, and cancellation controls. Group creation consent and matchmaking consent are separate decisions.

### 4.3 Join Matchmaking

Each player or group may have at most one active matchmaking request across all regulations.

For solo matchmaking:

1. The player uses the Matchmaking panel inside the desired regulation category.
2. The channel determines the Regulation Context; the player does not select it again.
3. The bot collects any regulation-required declaration and submits the request.

For group matchmaking:

1. A member starts the request from the permanent group thread.
2. The bot presents only regulations compatible with that group and queue mode.
3. The group selects a regulation and supplies any required declarations.
4. Every group member approves that exact request.
5. The bot submits the request only after unanimous approval.

For DBD 1v4, killers always queue individually. In the ranked modes survivors queue only as a complete group: a quartet for `dbd.1v4.quartet.rank`, a duo for `dbd.1v4.2duo.rank`. `dbd.1v4.pug.casual` also accepts solo survivors and survivor parties of 2, 3 or 4. In that mode the Join Queue button lets a solo player pick killer or survivor, and a party queues from its permanent group thread like any other group. Which party sizes a mode accepts is decided by the Queue Manager at admission, and the group thread's mode picker only offers modes the party's size fits: a duo chooses between duo+duo and PUG casual, a quartet between quartet and PUG casual, and a trio can only join PUG casual.

In the queue stats post, each game mode is its own card with a fixed colour stripe. The colours are defined in one place: `DBD_QUEUE_STATS_COLORS` in `apps/dbd/bot/presentation/registry.py`.

The queue stats post counts survivor players, not requests. For `dbd.1v4.pug.casual` it shows `Killers: 2`, then `Survivors: 9 players`, then a bulleted breakdown by queue-unit size such as `• solo x3, duo x1, quartet x1`.

For `dbd.1v1.symmetric.rank` it shows `3 players waiting`, then one bullet line per queued killer such as `• Nurse: 2`. Two players only match when they share a killer, so these lines show which killers are queued. A player who picked several killers is counted on each of those killers' lines, so the line counts can add up to more than the players waiting. Killers are listed with the most queued first, then by name.

Before match formation, the requester may inspect status or cancel. A timed-out or cancelled request ends; continuing requires a fresh request.

#### PUG casual parties

This is the one place that describes the PUG party model for players. Other documents link here.

- **A party is one queue unit.** A permanent group queues as one group-owned ticket in the same queue as the solo survivors. Any member can cancel it, and cancelling removes the whole party. A party is never split.
- **Teams are any exact packing of four survivor seats**: 1+1+1+1, 2+1+1, 2+2, 3+1 or 4. A solo survivor takes one seat and a party takes one seat per member.
- **Ratings stay individual.** A party is never a rating unit in PUG casual. Each member's own rating is the one that is stored and updated after the match, so a player has one PUG rating whether they play alone or in a party. A party is treated as stronger than the sum of its members, and more so the bigger it is. This applies both when an opponent is chosen and when the result is scored. So a party tends to face stronger killers, gains a little less for a win and loses a little more for a loss than the same players would as solos. The ranked quartet and duo+duo modes still rate the group. The rule is chosen per mode (`rating_unit_policy`, see `src/matchmaking/rating_unit_mapping.py`).
- **Members are fixed when the ticket is created.** The Queue Manager records the party's members on the ticket and copies them to the match, and the seat count and the rating units are read from that record.
- **Fairness rules live in code, not here.** The profile is `apps/dbd/regulation/family_1v4/pug_casual/regulation.py`. The tunable thresholds are in `apps/dbd/regulation/tuning.py`. How to measure the effect of the rules, including whether any team shape is favoured, is in `apps/dbd/eval/README.md` (section "PUG casual").

### 4.4 Respond To A Match

Readiness happens before opposing participants are revealed.

- A solo killer receives a request-scoped private thread under the regulation's Match notices channel.
- A survivor group receives one request-scoped private thread under the same Match notices channel, with every group member gathered in that thread.
- In `dbd.1v4.pug.casual` each solo survivor receives their own request-scoped private thread, like the killer. A match can therefore have one thread per solo and one per party; solos never share a thread.

The survivor notice shows the regulation, the match's region (when the deployment uses real regions), the survivor roster, response deadline, and each group member's **Ready** or **Leave** state. This individual response state is visible only to the survivor group; the killer cannot see which group members are ready, have left, or have not responded. The notice does not reveal the killer player or killer character.

Every participant independently chooses **Ready** or **Leave**. A timeout acts as Leave. One Leave or timeout cancels the match for everyone.

When readiness fails, the bot posts the cancellation outcome and archives every request-scoped notice thread. Participants outside the survivor group may learn that readiness failed, but not which group member left or timed out. Players must submit fresh matchmaking requests to try again.

### 4.5 Enter The Shared Match Workspace

When every participant is ready:

1. The bot creates one shared private match thread under the regulation's Match notices channel.
2. The bot adds every match participant.
3. The bot reveals the full match assignment: participant identities, sides, selected killer character, regulation, region (when the deployment uses real regions), and next steps.
4. The bot deletes the isolated readiness threads.
5. A permanent survivor group thread remains available for its group.

The shared match thread is the canonical workspace for match coordination, result proposals, no-game proposals, accepted outcomes, and rating status.

### 4.6 Report A Result

1. Any participant submits a regulation-specific result proposal in the shared match thread.
2. Submission counts as approval from the proposer's side.
3. One participant from the opposing side approves the exact proposal.
4. The bot submits the authorized result to the framework.
5. The accepted result and final rating status are posted in the shared thread.

Rejected or expired proposals do not change framework state. Players may submit a corrected proposal while the match remains unresolved. Detailed proposal concurrency and timeout rules are defined in `docs/discord-ui/user/result/result-commands.md`.

To record that the match was not played, all five DBD 1v4 participants must approve the same no-game proposal.

---

## 5. Thread Completion

The shared match thread becomes read-only and is archived as follows:

- **Rating-bearing result**: one hour after the final rating-applied or rating-failed status is posted.
- **Non-rating result**: one hour after the accepted result is persisted and posted.
- **Not played**: immediately after the not-played outcome is persisted and posted.

Before archival, workflow controls are disabled and the terminal outcome remains visible to participants.

---

## 6. Interaction Map

| User intent | Canonical Discord location |
|---|---|
| Register, edit, or view profile | Registration channel panel; ephemeral flow |
| Open a survivor coordination thread | Groups entrypoint panel |
| Create or manage a durable group | Permanent private group thread |
| Queue as a solo player | Regulation Matchmaking panel |
| Queue as a survivor group | Permanent private group thread |
| Receive a solo match ready check | Request-scoped private notice thread |
| Receive a group match ready check | Request-scoped private notice thread containing every group member |
| Coordinate a ready match | Shared private match thread |
| Propose and approve a result | Shared private match thread |
| Receive accepted result and rating status | Shared private match thread |
| Perform staff intervention | Private staff operations channel |

---

## 7. References

| Topic | Source |
|---|---|
| Canonical player and staff operation rules | `docs/UX-matchmaking-service.md` |
| Discord command and button surface | `docs/discord-ui/UX-discord-bot-commands.md` |
| Group consent and member resolution | `docs/discord-ui/group-channel-consent-flow.md` |
| Detailed group and queue behavior | `docs/discord-ui/user/group-queue/group-queue-commands.md` |
| Detailed result proposal behavior | `docs/discord-ui/user/result/result-commands.md` |
