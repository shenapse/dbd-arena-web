---
version: "0.1"
doc_type: "UX"
scope:
  in_scope:
    - canonical-user-facing-operations
    - staff-facing-operations
    - interface-layer-rules
    - consent-and-readiness-rules
    - ux-vs-framework-enforcement-boundary
  out_of_scope:
    - ui-form-factors: "Chat bot, web UI, voice, etc. are deployment choices"
    - widget-and-screen-design: "Layout, copy, and component-level UX are deployment choices"
    - authentication-mechanism: "Identity verification is a deployment concern"
    - regulation-and-rating-configuration: "Operator concern; see SLA §1, §6"
    - dispute-resolution-and-anti-cheat: "Service-owning community concern"
    - framework-internals: "See SLA, CLA"
  cross_reference_allowed:
    - SLA
    - CF
    - CLA
---

# Matchmaking Framework — User-Facing Interface Contract

> Defines the canonical user-facing surface that **any** interface deployment of the framework must support, independent of UI form factor (chat bot, membership site, voice client, etc.).
>
> The framework itself exposes no user-facing surface (SLA §1). Every deployment builds an interface layer over the framework's API. This document fixes the minimum operations end users see and the rules the interface layer must enforce, so that users moving between deployments encounter the same canonical model.

---

## 1. Scope and Audience

This contract is for engineers building an interface layer over the framework — both the player-facing surface and any staff or moderator surface — and for operators specifying what their deployment must offer.

It states **what** the user can do and **what rules** the interface enforces. It does not prescribe how operations are surfaced (commands, buttons, voice phrases), how identity is established, or how messages are transported. Framework behaviour referenced here is anchored to the SLA; this document does not redefine it.

The interface layer is **stateless in general** with respect to authoritative matchmaking domain state. It must not be the durable owner of participant, group, ticket, match, rating, or history state; when a UX rule needs current facts, the interface layer reads them from the framework immediately before acting. Any deployment-local interaction state is transient UX workflow state and must not replace framework-owned state.

Soft-delete is the narrow exception to "stateless in general": user-facing deactivation and restore state is UX-layer-owned account eligibility state, not framework participant state. The interface layer may persist this status in deployment storage keyed by the participant handle or user-facing service identity so it can reject removed callers before contacting the framework. The framework Participant Registry does not store soft-delete flags, tombstones, restore metadata, or audit fields; hard-delete is the framework operation that removes the participant record.

A rule labelled **UX-layer enforced** means the interface layer is responsible — the framework permits the underlying action and will not reject it. A rule labelled **framework-enforced** is honoured by the framework itself per the SLA. A rule labelled **UX precheck + framework-enforced** means the interface layer rejects the user-facing case first where possible, and the framework still protects its own state if it receives an unknown or invalid handle.

---

## 2. Canonical Operations (Overview)

The table below covers the five **player-facing** canonical operations. Staff-facing canonical operations are defined separately in §8.

| # | Operation | Purpose |
|---|---|---|
| 1 | **Player Registration** | Establish a long-lived player identity in the deployment. |
| 2 | **Group Formation** | Define and inspect reusable groups of registered players. |
| 3 | **Matchmaking Request** | Apply for a match; check status; cancel before match-found. |
| 4 | **Matchmaking Notification** | Receive match-found or no-match-found and confirm readiness. |
| 5 | **Result Report** | Submit a played match's result and receive the accepted outcome. |

Sign-up (operation 1) is the user-facing precondition for every other operation. The interface layer rejects unregistered or removed callers before any framework call is made; a rejection is a no-op on user state. This user-facing rule is distinct from framework admission checks: framework components may still reject unknown participant handles when creating groups or match-request tickets.

---

## 3. Player Registration

Sub-operations: **Sign-up**, **Edit**, **Remove**.

- **Sign-up** registers the player with the framework's Participant Registry (SLA §2). The interface layer supplies the player's display name, in-game player id, and authenticated user-facing service identity. Successful sign-up is a precondition for all operations 2–5.
- **Edit** covers the player's display name and one-time completion of optional platform bindings that are not yet filled out. Canonical identity fields (`in_game_player_id`, `user_identity`) are not player-editable in this contract. Existing platform binding values are not player-editable; correcting them is a staff administration operation.
- **Remove** is a **soft-delete** owned by the UX layer: the player is deactivated for further user-facing operations, but the underlying participant identity, ratings, and group memberships are preserved so that historical match records remain stable. Hard-delete is a staff-only operation defined in §8.3; cascade behaviour on dependent records is deployment-specified.

Rules:

- The interface layer rejects any operation 2–5 from an unregistered or removed caller before the framework is contacted. Removed status is read from UX-layer-owned deployment state, not from the Participant Registry. **UX-layer enforced.**
- The interface layer supplies `user_identity` only after authenticating the caller through the deployment's chosen user-facing service. The authentication mechanism is deployment-owned. **UX-layer enforced.**
- The interface layer may allow a player to fill an empty optional platform binding through **Edit**, but must reject attempts to overwrite an already-filled platform binding through player-facing edit. **UX-layer enforced.**
- The Participant Registry rejects duplicate in-game player ids or duplicate user-facing service identities during sign-up. **Framework-enforced.**
- Framework components reject unknown participant handles where they would otherwise create framework state that references those handles. **Framework-enforced.**
- Rejecting an unregistered call or unknown participant handle changes nothing about user, framework, or persistence state.

---

## 4. Group Formation

Sub-operations: **Register**, **Edit**, **List**.

- **Register** creates a reusable group with a fixed member set, recorded against the framework's Group Registry (SLA §2).
- **Edit** covers the group's display name only. The member set of a registered group is immutable.
- **List** returns the groups the calling player belongs to.

Rules:

- All members must already be signed up. The interface layer rejects unregistered or removed users for user-facing clarity; the Group Registry rejects unknown participant handles to protect framework state. **UX precheck + framework-enforced.**
- The member count must respect the deployment's pre-configured group-size restriction. **UX-layer enforced.**
- No two groups may share the same exact member set (uniqueness by membership). **UX-layer enforced.**
- A player may belong to many groups simultaneously.
- Groups are **permanent**: there is no remove, leave, or archive operation. This keeps match-history references stable and is a deliberate choice; deployments must not surface group deletion.
- A player may not see or edit groups they do not belong to. **UX-layer enforced.**

---

## 5. Matchmaking Request

Sub-operations: **Request**, **Status**, **Cancel**.

- **Request** enqueues a match application for a player or group under a chosen regulation, optionally including any role or character declaration the regulation requires. The framework returns a ticket handle (SLA §3.1 step 4).
- **Status** reports the requester's current regulation and pending state while waiting.
- **Cancel** withdraws an active request before a match is found.

Under the general stateless interface-layer rule (§1), the interface layer does not retain per-participant request state or the ticket handle returned by **Request**. **Status** and **Cancel** therefore resolve the calling participant's pending ticket via the Queue Manager's pending filtered listing by participant or group handle before invoking the Queue Manager's ticket-id-keyed path — the participant or group handle is the caller's input; the pending ticket snapshot is recovered from the framework.

Rules:

- A participant (player or group) may have **at most one active match request at a time**, across all regulations. **UX-layer enforced.** The framework permits multiple concurrent tickets across regulation contexts (SLA §1); this contract narrows that capability for end-user simplicity. A second request is rejected by the interface before reaching the framework. The precheck is realised by a Queue Manager pending filtered listing by participant or group handle immediately before the create call: the policy decision (reject a second concurrent request) is UX-layer; the fact-finding (does a pending ticket already exist for this participant?) is a framework read, because the interface layer is not the durable owner of participant or ticket state.
- A match request must name an existing participant or group handle. The interface layer rejects unregistered or removed callers as deployment policy; the Queue Manager rejects unknown framework handles as an admission invariant. **UX precheck + framework-enforced.**
- A request as a group must be sent **explicitly as a group**, not as one of its members acting alone. **UX-layer enforced.**
- All members of the group must agree to the request before it is sent. **UX-layer enforced.** The consent mechanism (real-time approval, pre-authorisation at group creation, role-based delegation, etc.) is a deployment choice.
- Cancel is permitted any time before match-found notification. After match-found, withdrawal is handled by the readiness flow (§6).

---

## 6. Matchmaking Notification

After a request, the player eventually receives one of two outcomes: **match-found** or **no-match-found**.

### 6.1 Match-found

The notification carries match information and information about the other players in the match. The exact fields depend on the regulation and the deployment.

Each notified player must respond with **Ready** or **Leave**:

- **Ready** indicates willingness to play the formed match.
- **Leave** withdraws the player from the formed match.
- If a player neither readies nor leaves within the deployment's pre-configured timeout, an **auto-leave** is recorded.
- For a group request, **every member must individually confirm Ready**. **UX-layer enforced.**

If any player leaves (or auto-leaves), **the match is cancelled for everyone**. Cancelled players' downstream state — re-queue, cooldown, penalty, or none — is the **service-owning community's** responsibility, governed by regulation and community rule, and is not prescribed here.

The match-found → ready/leave stage is a deployment-local UX workflow coordinated by the interface layer. The framework's match-formation event has already fired (SLA §3.1 step 5); any pending-ready data is transient workflow state, not authoritative match state, and the interface layer only proceeds to Result Report (§7) once all players are Ready.

### 6.2 No-match-found

If the request times out without a match (SLA §3.1 step 6), the application is cancelled and the player is notified. To continue trying, the player must submit a fresh request.

---

## 7. Result Report

Once all players in a formed match have confirmed Ready, the system sends a **result-report form** to each player.

- The accepted result is what gets reported to the framework's Result Reporting Service (SLA §3.2). The framework trusts the reported result without verification (SLA §7).
- Ensuring the reported result is **correct** is the joint responsibility of the **service-owning community** and the **interface layer**: how reports are collected, who is permitted to report, and how multiple or conflicting reports are reconciled are deployment concerns.
- After the framework processes the result, the system notifies all players of the **accepted match result** and optionally a **rating-update summary**.
- **Disputes** about the result and **in-game trouble** (rule violations, no-shows, harassment, etc.) are out of scope of this contract; the service-owning community handles them.

---

## 8. Staff Interface

### 8.1 Staff Role

The framework has no staff concept — it does not distinguish staff callers from player callers. The interface layer enforces all staff access control. Staff authentication, authorisation, and designation are deployment choices not prescribed by this contract.

A single flat **staff** role is prescribed here; permission tiers within staff (e.g., moderator vs. administrator) are deployment choices. A rule labelled **UX-layer enforced** in this section means the interface layer controls it; the framework will not reject the underlying call on the basis of caller identity.

### 8.2 Canonical Staff Operations

| # | Operation | Purpose |
|---|---|---|
| S1 | **Player Administration** | View, correct identity, deactivate, restore, or permanently remove a player's framework record. |
| S2 | **Queue Administration** | Force-cancel an active match-request ticket; void a formed match before a result is reported. |
| S3 | **Match Administration** | Input a result for a disputed match; submit a corrected result for a wrongly reported match. |
| S4 | **Administrative Visibility** | View any player record, group membership, and queue state regardless of player-level visibility scope. |

---

### 8.3 Player Administration

Sub-operations: **View**, **Correct Identity**, **Deactivate**, **Restore**, **Hard-Delete**.

- **View** gives staff access to any player's framework record, group memberships, and current ticket state, regardless of the player's own visibility scope.
- **Correct Identity** updates a player's display name, in-game player id, user-facing service identity, or platform bindings on the existing Participant Registry record. This is an administrative correction path only; it preserves the participant handle, ratings, group memberships, and historical match references.
- **Deactivate** applies the same UX-layer-owned soft-delete effect as a user-initiated Remove (§3): the player is deactivated for user-facing operations 2–5; their identity, ratings, and group memberships are preserved so that historical match records remain stable. Staff may apply this without the player's consent.
- **Restore** reverses a soft-delete: the player's account is reactivated and they become eligible for operations 2–5 again. Restore applies only to soft-deleted players; hard-deleted players cannot be restored.
- **Hard-Delete** permanently removes the participant identity from the Participant Registry and the persistence layer. The framework's non-cascading deletion principle applies (CLA-participant-registry): dependent records (ratings, group memberships, active tickets) are **not** automatically removed. The interface layer is responsible for cleaning up dependent state before or after calling the framework. Hard-delete is irreversible.

Rules:

- Staff may view any player record, group membership, or ticket state. **UX-layer enforced.**
- Staff may correct a player's display name, in-game player id, user-facing service identity, or platform bindings without changing the participant handle. The Participant Registry rejects corrections that would duplicate another player's in-game player id or user-facing service identity. **UX-layer enforced** (staff authority); **Framework-enforced** (identity uniqueness).
- Staff may deactivate or hard-delete any player regardless of the player's consent. **UX-layer enforced.**
- Hard-delete requires explicit staff confirmation before the framework is called; the interface layer must not bypass this prompt. **UX-layer enforced.**
- Cleanup of dependent state (active tickets, group memberships, rating values) is the interface layer's responsibility before or after hard-delete; the framework enforces non-cascading deletion. **UX-layer enforced (cleanup); Framework-enforced (non-cascade).**
- A hard-deleted participant handle is permanently invalid and cannot be restored; any stale references to it in framework state are defunct. **Framework-enforced.**
- Restore is only applicable to soft-deleted players. **UX-layer enforced.**

---

### 8.4 Queue Administration

Sub-operations: **Force-Cancel Ticket**, **Void Formed Match**.

- **Force-Cancel Ticket** cancels an active match-request ticket on behalf of any player or group (e.g., a deactivated account with a pending ticket, or a stuck or invalid ticket the player cannot cancel themselves). The same Queue Manager cancellation path is used; the framework emits a cancellation event carrying the ticket id, which the Notification Dispatcher delivers to affected callbacks. Staff identifies the target by participant or group handle; the interface layer resolves the target's pending ticket via the same Queue Manager pending filtered listing the player-facing **Status**/**Cancel** flows use, then invokes the Queue Manager cancellation path with the recovered ticket id.
- **Void Formed Match** abandons a formed match that is in the pending-ready state (after match-found has been emitted, before a result is reported). This is a UX-layer operation: the interface layer discards the pending-ready state without submitting a result to the Result Reporting Service. No framework call is made for the void itself. Affected players must submit fresh match-request tickets to participate again.

Rules:

- Force-cancel uses the framework's existing cancellation path; the resulting cancellation event is delivered to the interface layer through the normal notification path. **Framework-enforced** (notification); **UX-layer enforced** (staff initiation).
- Void of a formed match submits no result; no rating changes occur. **UX-layer enforced.**
- A voided match cannot be un-voided. **UX-layer enforced.**
- Downstream consequences for affected players (re-queue, cooldown, penalty, or none) after a staff-forced cancellation or match void are service-owning community responsibility, not prescribed here.

---

### 8.5 Match Administration

Sub-operations: **Input Disputed Result**, **Submit Corrected Result**.

- **Input Disputed Result**: When the normal result-report flow fails — players do not report, reports conflict, or the match is flagged for administrative review — staff submits a result directly to the Result Reporting Service using the same framework path as player-reported results. The framework trusts the submitted result without verification (SLA §7).
- **Submit Corrected Result (History-Based Correction)**: If a result was incorrectly reported, the interface layer marks it as superseded for user-facing audit and display, then submits the corrected result to the Result Reporting Service with the superseded source result id. The framework applies the correction through the Rating System's correction path, using Rating History as the baseline for the superseded result rather than treating the corrected result as an unrelated fresh submission (SLA §3.2).

Rules:

- Staff can submit a result for any formed match regardless of whether players have already reported. **UX-layer enforced.**
- The framework trusts the result as submitted; staff authority over result correctness does not change the trust model. **Framework-enforced.**
- A corrected result must name the superseded source result id. The interface layer is responsible for selecting the result to supersede and for preventing ambiguous user-facing correction flows; the framework is responsible for applying the correction from Rating History rather than from the current rating state alone. **UX + Framework-enforced.**
- Staff identity as result reporter is an audit concern for the interface layer; the framework does not record who submitted the result. **UX-layer enforced.**

---

### 8.6 Administrative Visibility

- Staff can view any player's registration record, group memberships, and current ticket state — not limited to groups or tickets the staff member belongs to. **UX-layer enforced.**
- Staff visibility extends to queue state (pending tickets per Regulation Context). **UX-layer enforced.**
- The interface layer controls what staff-visible data it surfaces; the framework's normal point-read operations (Participant Registry, Group Registry, Queue Manager) are the underlying call path.

---

## 9. Boundary Principle

The framework enforces reusable domain invariants: stable identities, ticket lifecycle, structural match formation, notification events, result ingestion, rating resolution, and persistence. The interface layer enforces deployment policy: who may invoke operations, which user-facing restrictions narrow framework capability, consent and readiness workflows, visibility rules, result collection, and community consequences.

A UX rule may reject an otherwise valid framework action before calling the framework. A framework rule must reject requests that would create invalid framework state or violate reusable matchmaking or rating semantics.

The same boundary principle applies to staff-facing operations: the framework does not distinguish staff callers from player callers. The interface layer is solely responsible for enforcing staff access control, authorisation, and audit.

---

## 10. UX-Layer Responsibilities (Summary)

This table consolidates which rules the interface layer must enforce versus which the framework enforces per the SLA. Where an operation is rejected at the UX layer, the framework is never called and no framework state changes.

| Rule | Enforcing layer | Reference |
|---|---|---|
| Sign-up is required before operations 2–5 | UX | §3 |
| Sign-up supplies display name, in-game player id, and authenticated user-facing service identity | UX + Framework (identity uniqueness) | §3 |
| Player Edit may update display name and fill empty optional platform bindings only | UX | §3 |
| Player Remove is UX-layer-owned soft-delete | UX (operator policy and deployment account eligibility state) | §1, §3 |
| Unknown participant handles are rejected when creating framework state | Framework | SLA §3.1, SLA §5 |
| All group members are signed-up players | UX precheck + Framework | §4 |
| Group size respects pre-configured restriction | UX | §4 |
| Group uniqueness by member set | UX | §4 |
| Groups cannot be removed, left, or archived | UX | §4 |
| Players cannot see/edit groups they do not belong to | UX | §4 |
| One active match request per participant (across all regulations) | UX | §5 |
| Match request names an existing participant or group handle | UX precheck + Framework | §5 |
| Group request sent explicitly as a group with all-members agreement | UX | §5 |
| Match-request ticket lifecycle, timeout eviction, cancellation handling | Framework | SLA §2 (Queue Manager), §3.1 |
| Match formation and structural compatibility | Framework | SLA §2 (Match Formation Engine) |
| Notification delivery for match-found / timeout / cancellation | Framework | SLA §2 (Notification Dispatcher) |
| Ready/Leave check after match-found | UX | §6.1 |
| Result trusted as reported | Framework | SLA §7 |
| Correctness of reported result, dispute handling | Service-owning community + UX | §7 |
| Rating computation and persistence | Framework | SLA §2 (Rating System, Rating Store) |
| Staff access control, authentication, and authorisation | UX | §8.1 |
| Staff may view any player record, group membership, or ticket state | UX | §8.3, §8.6 |
| Staff identity correction preserves the participant handle and is rejected on duplicate canonical identities | UX + Framework | §8.3 |
| Staff deactivation (UX-layer-owned soft-delete) of any player without player consent | UX (deployment account eligibility state) | §8.3 |
| Staff restore of a soft-deleted player | UX (deployment account eligibility state) | §8.3 |
| Staff hard-delete requires explicit confirmation; dependent-state cleanup is interface-layer responsibility | UX + Framework (non-cascade) | §8.3 |
| Hard-deleted participant handle is permanently invalid and cannot be restored | Framework | §8.3 |
| Staff force-cancel uses the framework's cancellation path; cancellation notification is emitted | UX (initiation) + Framework (notification) | §8.4 |
| Staff void of a formed match submits no result; no rating change occurs | UX | §8.4 |
| Staff may submit a result for any formed match through the normal Result Reporting Service path | UX + Framework (trust model) | §8.5 |
| Corrected result names the superseded source result id and is applied through the framework's Rating History-based correction path | UX + Framework | §8.5 |

**Note on participant→ticket resolution.** The UX rules covering an existing pending ticket — single-active-ticket precheck (§5), player **Status** and **Cancel** (§5), and staff **Force-Cancel Ticket** (§8.4) — all rely on the Queue Manager's pending filtered listing by participant or group handle to recover pending ticket records from framework-owned state. This is an example of the general stateless interface-layer rule (§1): the *policy* decisions remain UX-layer, but the *fact-finding* is a framework read.

---

## 11. Out of Scope

This contract does not specify:

- **UI form factor** — chat bot, web UI, voice client, native app, or any other surface.
- **Authentication and identity verification** — how the deployment establishes that a caller is who they claim to be, for both players and staff, and how it proves that the supplied user-facing service identity belongs to that caller.
- **Communication channels and transport** — how notifications and forms reach users.
- **Regulation, rating-dimension, and rating-policy configuration** — operator concern (SLA §1, §6).
- **Dispute resolution, anti-cheat, and in-game procedure** — service-owning community concern; framework explicitly excludes these (SLA §7).
- **Cascade behaviour of hard-delete** on dependent records (ratings, group memberships, active tickets) — the framework enforces non-cascading deletion per CLA-participant-registry; the specific cleanup order and policy are deployment-specified.
- **Staff permission tiers** (e.g., moderator vs. administrator sub-roles) — deployment choice beyond the single flat staff role prescribed here.
- **Group consent mechanism** for match requests — deployment choice.
- **Result-reporter selection and reconciliation policy** — deployment + community concern.
