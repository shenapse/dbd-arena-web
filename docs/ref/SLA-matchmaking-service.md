---
version: "0.1"
doc_type: "SLA"
scope:
  in_scope:
    - system-structure
    - component-identification
    - component-responsibilities
    - data-flows
    - coordination-mechanisms
    - architectural-patterns
    - design-principles
    - quality-attributes
  out_of_scope:
    - detailed-interfaces: "Belongs in CS/API"
    - detailed-algorithms: "Belongs in CS"
    - data-schema-details: "Belongs in DS"
    - implementation-details: "Belongs in IMPL"
    - code-structure: "Belongs in IMPL"
  cross_reference_allowed:
    - CF
    - CLA
    - CS
---

# Matchmaking Framework — System-Level Architecture

> Bridges the conceptual model in `project-brief.md` with the technical realization captured in downstream component specs.
>
> **Framing assumptions** (drawn from upstream decisions, recorded here for reviewers):
> - The framework is a standalone, in-process Python library; the interface layer (e.g., a Discord bot or membership site) imports and calls it.
> - Persistence is owned by the framework but pluggable; the first implementation assumes configured SQL, document, and KV backend resources.
> - An in-memory backend is out of scope for this architecture baseline.
> - Matchmaking progression is invoked through a framework-defined invocation interface, with each invocation targeting one Regulation Context. The invocation policy is pluggable; periodic ticking is one possible policy, not a core architectural requirement.
> - Match-found, timeout, and player-cancellation events reach the interface layer through callbacks registered at construction.
> - Game-specific rules (candidate proposal, composite scoring, rating updates, optional eligibility/format hooks) are supplied as Python objects at construction.
> - Framework setup is an explicit lifecycle phase. Setup ownership stays local to the component or composition boundary that owns the facts being validated; runtime receives only sealed, already-valid capabilities.
> - **Regulation Context** is the framework-visible structural description of a match format. Queue lifecycle policy, candidate-proposal policy, rating dimensions, rating-update policy, and in-game procedure are downstream concerns that consume this context rather than belonging to it.
> - **Region** is the framework-visible matchmaking-pool label carried by each admitted match-request ticket. It is not participant identity and not Regulation Context structure. The Region Catalog owns region vocabulary and global fallback-order facts.
> - Each enqueue creates a **match-request ticket** with a stable identifier returned to the caller. Cancellations target a ticket id, and match-found / timeout / cancellation events carry the ticket id(s) they pertain to. A participant (player or group) may hold multiple concurrent tickets across regulation contexts.

---

## 1. System-Level View

The framework is structured as twenty-two cooperating in-process modules:

| # | Module | One-line responsibility |
|---|---|---|
| 1 | **Participant Registry** | Stores stable participant identities and optional external platform bindings. |
| 2 | **Group Registry** | Stores reusable participant groups and membership composition. |
| 3 | **Regulation Context Catalog** | Holds structural match-format definitions and context-aspect vocabulary referenced by those definitions. |
| 4 | **Rating Dimension Catalog** | Holds rating dimension definitions used by matchmaking and rating policies. |
| 5 | **Context Aspect Metadata Catalog** | Holds declared metadata facts about context-aspect values, such as character tier classifications, for rating projection and interface-layer presentation reads. |
| 6 | **Region Catalog** | Holds matchmaking-pool region vocabulary and global fallback-order facts used by admission and match formation policy contexts. |
| 7 | **Match Result Schema Catalog** | Holds per-Regulation-Context result contracts; validates reported / corrected result payloads against recovered formation facts; returns canonical accepted result facts. |
| 8 | **Rating System** | Infrastructure for rating: owns the canonical rating read surface, dimension→policy bindings, rating-key resolution across rating unit, Regulation Context, and context-local dimension, selected algorithm/facade binding context, projection of raw rating values and configured projection inputs into projected rating values consumed by the Match Formation Engine, result-update preparation reads, correction-baseline reads, rating-side evidence lookup (including cancellation-compensation evidence), and atomic post-update persistence + cause-tagged Rating History append on the result write path. Result-time `rate()` and cancellation-compensation timing are owned by the Rating Update Service, not here. |
| 9 | **Rating Store** | Holds raw current rating values keyed by `(rating unit, Regulation Context, context-local dimension)`. |
| 10 | **Queue Manager** | Owns match-request tickets and pending views over them by Regulation Context, direct owner, and region; honours cancellations and timeouts. |
| 11 | **Invocation Driver** | Coordinates when matchmaking and timeout processing are attempted for a supplied Regulation Context through a framework-defined invocation interface; invocation policy is pluggable and separate from match formation logic. |
| 12 | **Match Formation Engine** | When invoked for a Regulation Context, attempts to assemble matches that satisfy that context's structure and compatibility, with region fallback facts supplied through engine-owned plug-in contexts. |
| 13 | **Plug-in Boundary** | Extension boundary for engineer-supplied domain-decision callables: validates and seals bindings at setup, then provides typed access to validated bindings for call sites owned by the Match Formation Engine, Invocation Driver, Rating Update Service, Rating System, and optional eligibility / format-rule consumers, including the Rating Update Service cancellation-compensation adapter when result cancellation is enabled. |
| 14 | **Result Reporting Service** | Public result-reporting use-case coordinator: accepts reported results, corrected-result requests, source-result cancellation requests, and match-not-played reports; owns setup-time Result Rating Policy declaring whether each Regulation Context's accepted results affect ratings; recovers formation-structural facts from the Match Record Store; validates and normalizes payloads through the Match Result Schema Catalog; appends accepted reports, application-status events, cancellation events, and compensation-status events to the Result Journal; appends not-played dispositions to the Match Disposition Journal; and invokes the Rating Update Service with idempotency and compensation checks when rating work is required. |
| 15 | **Rating Update Service** | Infrastructure for idempotent rating application and cancellation compensation: its plug-in adapter owns result-time `rate()` timing through the Rating Algorithm Facade, and its cancellation-compensation adapter owns compensation arithmetic with values/evidence supplied by the Rating System read surface; it then asks the Rating System to atomically persist and append history. |
| 16 | **Notification Dispatcher** | Delivers match-found, timeout, ticket-cancellation, result-status, result-cancellation, result-cancellation-compensation, and match-not-played events to interface-layer callbacks. |
| 17 | **Repository Layer** | Abstract persistence boundary used by the Participant Registry, Group Registry, Rating Store, Queue Manager, Ticket Journal, Match Record Store, Result Journal, Rating History, and Match Disposition Journal. |
| 18 | **Ticket Journal** | Durable record of every match-request ticket admitted, including its admitted region, full lifecycle, and terminal outcome (matched, timed out, or cancelled). |
| 19 | **Match Record Store** | Durable record of every formed match, sufficient to identify constituent ticket ids, Regulation Context, team/slot composition, admitted ticket regions, and declared context-aspect assignments. |
| 20 | **Result Journal** | Durable append-only record of every accepted reported or corrected result payload, including the source result id, supersession linkage where applicable, result-application status events (`accepted`, `rating_applied`, `rating_failed`, `rating_not_required`), source-result cancellation events, and cancellation-compensation status events. |
| 21 | **Rating History** | Durable record of every changed rating value committed for ordinary application or cancellation compensation, capturing old value, new value, cause, Regulation Context, context-local dimension, rating unit, source match/result id, and correction linkage where applicable. |
| 22 | **Match Disposition Journal** | Durable append-only record that a formed match was deliberately not played, keyed by match id, carrying an opaque reason code and optional note / audit reference. Distinguishes a deliberately abandoned match from one that is merely not yet played (the absence of any disposition and any result). |

A **Regulation Context** defines the framework-visible structure of a playable match format: participant count, team count, team sizes, required slots, and configured **context aspects** that must be declared, assigned, or carried with tickets and formed matches. A **context aspect** is a framework-global named vocabulary category whose values may matter to match structure, matchmaking, rating, records, or plug-ins. Roles and characters are standard aspect categories; other games may define additional categories such as map, side, loadout, or equipment. The framework treats context aspects as declared categories for structure, branching, and rating lookup; game-specific legality, strategy, and procedure remain outside the core unless expressed through Regulation Context structure or delegated plug-in predicates.

Regulation Context intentionally excludes queue lifecycle policy, candidate-proposal policy, rating dimensions, rating-update policy, and in-game procedure such as map selection, side selection, bans, drafts, remakes, disputes, and tactical rules. Those concerns may consume Regulation Context as input, but they do not redefine it.

**Region** is a framework matchmaking-pool label chosen by the interface layer for a specific queue request. The Region Catalog owns the valid region handles and global fallback order between regions. Region is required on admitted queue tickets, preserved in pending and historical records, and supplied by the Match Formation Engine to its plug-in contexts together with expanded fallback facts. Region does not describe match structure, participant identity, server geography, latency, or platform placement.

**Context Aspect Metadata** is declared reference data about context-aspect values, such as a character's tier classification. The Context Aspect Metadata Catalog owns those facts and their metadata-key vocabulary. The Regulation Context Catalog still owns the aspect vocabulary itself, and the Rating System still owns any projection interpretation of metadata facts.

A **rating unit** is the entity to which a rating value belongs for a given dimension within a Regulation Context. A rating unit may be a player, a group, or another rating-policy-defined entity. The **Rating System** owns the caller-facing rating read surface, rating-key resolution for supplied dimensions — selecting rating units for each applicable `(rating unit, Regulation Context, context-local dimension)` key — and the projection capability that turns stored raw rating values and any configured projection inputs, including declared context-aspect metadata where configured, into projected rating values (currently consumed by the matchmaking caller as the matchmaking rating view, conventionally named MMR); the **Rating Store** only persists raw values by `(rating unit, Regulation Context, context-local dimension)`.

These modules cooperate in a closed loop driven by the host application:

1. At framework construction or setup, the interface layer supplies match-structure configuration through the **Regulation Context Catalog**, rating-dimension configuration through the **Rating Dimension Catalog**, context-aspect metadata configuration through the **Context Aspect Metadata Catalog**, region vocabulary and fallback-order facts through the **Region Catalog**, per-Regulation-Context result contracts through the **Match Result Schema Catalog**, and explicit Result Rating Policy entries through the **Result Reporting Service** declaring whether each Regulation Context's accepted results affect ratings.
2. The interface layer registers players through the **Participant Registry** and optionally defines reusable groups through the **Group Registry**.
3. The interface layer calls the **Queue Manager** to create a **match-request ticket**, naming a participant or group, a Regulation Context, one explicit region, timeout facts, and any required pre-match context-aspect declarations; the call returns a ticket handle. As part of the same call, the Queue Manager appends the creation entry, including the admitted region, to the **Ticket Journal**.
4. An **Invocation Driver** advances matchmaking progression for one caller-supplied Regulation Context through the framework's invocation interface. The Driver first triggers timeout evaluation for that context, then invokes the **Match Formation Engine** for the same context. The engine reads pending tickets from the Queue Manager, derives group-owned ticket occupancy from Group Registry membership cardinality where structural validation needs it, reads expanded region fallback facts from the Region Catalog for regions present in the attempt's pending slice, validates proposal-chosen context-local assignment dimensions through the Rating Dimension Catalog under the attempt Regulation Context, asks the **Rating System** for the relevant projected matchmaking rating view using those explicit dimensions plus the attempt Regulation Context, and its plug-in adapter invokes component-owned callables exposed by the **Plug-in Boundary** to propose candidate formations, compute composite scores, and check compatibility against the Regulation Context's match structure and MFE-supplied region context.
5. When a match forms (or a ticket times out, or a player cancels a ticket), the affected tickets receive their terminal entry in the **Ticket Journal**; for a formed match, the Match Formation Engine also persists the formed-match record through the **Match Record Store**. The **Notification Dispatcher** then invokes the appropriate callback with the affected ticket id(s).
6. After the match is played, the interface layer hands the result to the **Result Reporting Service**. The Result Reporting Service reads the **Match Record Store** by point lookup to recover formation-structural facts, including formation-time assignment context-local rating dimensions, assignment regions, and the record-level Regulation Context, validates and normalizes the reported payload through the **Match Result Schema Catalog**, and rejects invalid payloads before any durable result append. For valid payloads, it appends canonical accepted result facts to the **Result Journal** to obtain the source result id and record the initial `accepted` application status, emits the result-accepted event through the **Notification Dispatcher**, checks the recovered Regulation Context's Result Rating Policy entry, checks the latest Result Journal disposition/status for idempotency, and invokes the **Rating Update Service** only when the result is rating-bearing and still needs rating application. For non-rating-bearing results, it records terminal `rating_not_required` in the Result Journal and emits no additional rating-lifecycle notification. For rating-bearing results, the Rating Update Service invokes the **Rating System** read surface to resolve affected rating units for the persisted formation-time dimensions under the match Regulation Context and obtain pre-update raw values plus selected algorithm / Rating Algorithm Facade rate binding context, then its plug-in adapter invokes the Rating Algorithm Facade's `rate()` method to compute post-update values, and invokes the Rating System's commit phase to persist them through the **Rating Store** -> **Repository Layer** and append a cause `result_application` change record to the **Rating History** for each `(rating unit, Regulation Context, context-local dimension)` whose value changed. The Result Reporting Service records `rating_applied` or `rating_failed` in the Result Journal as the durable application outcome and emits the corresponding result-status event through the Notification Dispatcher. If the interface layer later submits a corrected result, the same result contract and Result Rating Policy entry apply with a supersession link to the superseded source result id; the Rating System read surface still returns the Rating History records for the superseded result as the correction baseline rather than treating the corrected result as an unrelated fresh submission. If the interface layer later cancels a source result, the Result Reporting Service appends a durable cancellation event for that exact source result id, blocks further ordinary retries or corrections targeting that id, invokes the Rating Update Service cancellation-compensation flow when compensation is needed, records the resulting compensation status in the Result Journal, and emits cancellation/compensation notifications only after those durable facts exist.

All durable framework state — both mutable operational state and append-mostly historical records — crosses a single boundary, the Repository Layer, so that storage choices remain orthogonal to domain logic. The Ticket Journal, Match Record Store, Result Journal, Rating History, and Match Disposition Journal each own their own contract at this boundary, sibling to the Participant, Group, Rating, and Queue contracts. Catalog definitions are configuration/reference data: they must be present for reads during matchmaking and rating operations, but they do not require Repository Layer write operations after construction.

---

## 2. Core Components and Their Roles

- **Participant Registry**
  - *Input:* registration calls containing player information and optional external platform identity bindings; point lookups by participant handle from callers that need to validate a participant reference.
  - *Output:* stable participant handles and participant lookup.
  - *Key property:* participant identity is long-lived and independent of queue tickets, ratings, groups, and match results.

- **Group Registry**
  - *Input:* reusable group definitions and membership composition using participant handles.
  - *Output:* stable group handles and group membership lookup.
  - *Key property:* a group is a long-lived participant aggregate; the Group Registry defines who belongs to a group, rejects unknown participant handles at admission, and otherwise treats participant identity as owned by the Participant Registry. The Queue Manager decides when a group is waiting for a match.

- **Regulation Context Catalog**
  - *Input:* Regulation Context definitions and the context-aspect vocabulary referenced by those definitions, supplied during construction or setup.
  - *Output:* structural match-format definitions: participant count, team count, team sizes, required slots, and configured context-aspect declaration or assignment requirements.
  - *Key property:* owns structural matchmaking context only. Queue lifecycle policy, candidate-proposal policy, rating dimensions, rating-update policy, and in-game procedure consume Regulation Context but do not belong to it. The catalog is read-facing during runtime; routine repository-backed writes are not part of its demand model.

- **Rating Dimension Catalog**
  - *Input:* rating dimension definitions and their association with rating policies or Regulation Contexts, supplied during construction or setup.
  - *Output:* rating dimension lookup used by the Rating System, Rating Store, and Match Formation Engine; plug-in call inputs may include resolved dimension facts when assembled by an owning component.
  - *Key property:* describes what can be rated; it does not store rating values, select rating algorithms, or decide which rating unit owns a value. The catalog is read-facing during runtime; routine repository-backed writes are not part of its demand model.

- **Context Aspect Metadata Catalog**
  - *Input:* metadata key definitions and metadata entries annotating context-aspect values, supplied during construction or setup after the Regulation Context Catalog's aspect vocabulary is known.
  - *Output:* effective metadata lookup for a context-aspect value, reverse enumeration of aspect values by metadata key/value and aspect category, and full enumeration where needed for presentation or validation.
  - *Key property:* owns declared metadata facts about context-aspect values, not aspect vocabulary, rating dimensions, rating values, projection formulas, matchmaking heuristics, or game procedure. Metadata may be global or Regulation-Context-scoped; scoped metadata overrides global metadata for the same aspect value and metadata key. The catalog is read-facing during runtime; routine repository-backed writes are not part of its demand model.

- **Match Result Schema Catalog**
  - *Input:* one result contract per Regulation Context, supplied during construction or setup after the Regulation Context Catalog has sealed; runtime validation requests from the Result Reporting Service carrying caller-supplied result facts plus recovered formation facts.
  - *Output:* context-bound result validators; canonical accepted result facts or validation failure categories for reported and corrected result payloads.
  - *Key property:* owns result payload contracts and structural result-data validity per Regulation Context. It validates and normalizes reported facts before Result Journal append, but does not verify result truth, handle disputes, own correction-chain policy, translate results into rating-algorithm inputs, or persist anything.

- **Region Catalog**
  - *Input:* region definitions and global fallback-order facts supplied during construction or setup.
  - *Output:* region existence lookup, region enumeration, and expanded fallback-order lookup used by Queue Manager admission, Match Formation Engine region context assembly, and interface-layer presentation / setup tooling.
  - *Key property:* owns matchmaking-pool vocabulary and fallback reference facts only. It does not derive a ticket's region, score regions, enforce fallback eligibility, mutate runtime state, persist repository records, or define server geography. Same-region is implicit rank 0; MFE policy and plug-ins decide how fallback facts affect proposal, compatibility, and scoring.

- **Rating System**
  - *Rating read-surface input (matchmaking):* anchor keys from the Match Formation Engine (each a rating unit paired with the attempt Regulation Context and per-assignment context-local rating dimension MFE derived at proposal); rating-policy and projection policy; declared context-aspect metadata used for policy selection; raw current rating values read through the Rating Store; optional projection callables exposed by the Plug-in Boundary where configured. The Rating System expands each anchor's dimension hierarchy; it does not derive the unit, Regulation Context, or dimension.
  - *Matchmaking read-path output:* resolved projected rating views consumed by the Match Formation Engine as the matchmaking rating view, conventionally including MMR; the engine may pass those values into its own plug-in calls using callables exposed by the Plug-in Boundary.
  - *Rating read-surface input (result preparation):* rating or compensation context from the Rating Update Service (Regulation Context, formation-structural facts — including the per-assignment context-local anchor dimension recovered from the Match Record Store — canonical accepted result facts from the Match Result Schema Catalog, and cancellation reason where compensation is requested); rating-policy and rating-dimension definitions; declared context-aspect metadata where configured; and — for corrections or cancellation compensation — the target source result id. The Rating System privately reads raw current rating values through the Rating Store, or target source-result rating changes through the Rating History as the correction baseline or compensation evidence. There is no rating-key-resolver plug-in: rating units arrive given and the anchor dimension is recovered with its Regulation Context, not derived here.
  - *Rating read-surface output (result preparation):* resolved participating `(rating unit, Regulation Context, context-local dimension)` keys; pre-update, correction-baseline, or compensation-evidence raw values; selected algorithm / Rating Algorithm Facade or compensation binding context for each key's policy — all returned to the Rating Update Service so it can invoke the facade `rate()` method or compensation adapter. The same read surface also exposes source-result-id evidence lookup for Rating Update Service recovery.
  - *Result write-path input (commit phase):* post-update or post-compensation raw values supplied by the Rating Update Service after its facade/adapter call, plus the source result id minted by the Result Journal, record cause, and the superseded source result id where applicable.
  - *Result write-path output (commit phase):* updated rating values persisted through the Rating Store; per-`(rating unit, Regulation Context, context-local dimension)` cause-tagged change records (old value, new value, source match id, source result id, superseded source result id where applicable, and record cause) appended to the Rating History when values changed; commit acknowledgement returned to the Rating Update Service.
  - *Key property:* **infrastructure for rating**, called by the public-API-level Match Formation Engine (matchmaking read path) and the Rating Update Service (result write path). It owns the canonical rating read surface, rating-key resolution, dimension→policy bindings, selected algorithm identity/facade binding context, projection from raw rating values and configured projection inputs into projected rating values, raw-value persistence through the Rating Store, and cause-tagged rating-change recording through the Rating History. It **does not** time result-time `rate()` or cancellation-compensation adapter calls itself — that call timing lives at the Rating Update Service — and it does not read the Match Record Store on the result write path. The Rating Store holds the *raw current* value per `(rating unit, Regulation Context, context-local dimension)`; the Rating History holds the *change record*. Both are written by the Rating System and only the Rating System. Other components do not infer rating ownership, derive group ratings, compute MMR themselves, or consume Rating Store point/view read shapes directly.

- **Rating Store**
  - *Input:* read and write requests from the Rating System.
  - *Output:* stored raw rating values per `(rating unit, Regulation Context, context-local dimension)`.
  - *Key property:* storage-only. It does not decide whether a participant, group, team, or other aggregate should own a rating value, and it does not derive one rating value from another or project raw values into matchmaking MMR.

- **Queue Manager**
  - *Input:* ticket-creation requests (individual or group) naming one Regulation Context and one explicit region; player-initiated ticket cancellations (by ticket id); targeted system-initiated timeout cancellations from the Invocation Driver.
  - *Output:* the current set of pending tickets per Regulation Context, direct owner, or region; ticket handles returned to callers at creation; ticket-lifecycle entries appended to the Ticket Journal at creation, transition, and termination.
  - *Key property:* the **match-request ticket is the unit of admission, cancellation, timeout, and notification**. A ticket names its Regulation Context, carries one admitted region, and, where required by that context, carries pre-match context-aspect declarations. A participant (player or group) may hold multiple concurrent tickets across regulation contexts. Ticket creation rejects unknown participant or group handles, unknown Regulation Context handles, and unknown region handles before pending state is created. Group atomicity is preserved within a single ticket — a group's members are never split across opposing teams. The Queue Manager retains only *pending* state; the historical lifecycle of every ticket lives in the Ticket Journal. Concrete ticket lifecycle states are specified in the Component Specification (CS).

- **Invocation Driver**
  - *Input:* an invocation request naming a Regulation Context from a selected invocation policy, such as manual advancement, periodic advancement, or event-triggered advancement.
  - *Output:* targeted timeout evaluation through the Queue Manager followed by a targeted matchmaking attempt through the Match Formation Engine for the same Regulation Context.
  - *Key property:* the framework-defined boundary through which matchmaking progression occurs; invocation policy is pluggable and separate from match formation logic. The caller / policy owns cross-context ordering, cadence, and starvation prevention.

- **Match Formation Engine**
  - *Input:* a target Regulation Context from the Invocation Driver; pending tickets for that context from the Queue Manager; expanded fallback-order facts from the Region Catalog for regions present in the attempt; group membership cardinality from the Group Registry for group-owned ticket structural occupancy; matchmaking rating views from the Rating System; Regulation Context definitions from the Regulation Context Catalog; setup-selected candidate-proposal, compatibility, and scoring decisions returned by component-owned plug-in bindings exposed by the Plug-in Boundary and executed by the engine's adapter.
  - *Output:* assembled matches identified by their constituent ticket ids, satisfying the Regulation Context's structure and the selected plug-in binding's compatibility predicate; persists each formed match through the Match Record Store, where the match id minted there is the durable handle subsequent components reference and where each assignment preserves its admitted region; emits match-found events carrying those ticket ids and the match id to the Notification Dispatcher.
  - *Key property:* contains the *framework's* structural matching logic but no game-specific procedure rules; defers non-structural game-specific decisions to component-owned plug-ins exposed by the Plug-in Boundary or to the interface layer.

- **Plug-in Boundary**
  - *Input:* engineer-supplied callables installed at construction — at the Match Formation Engine: named candidate-proposal, compatibility-predicate, and composite-scorer bindings selected by MFE setup configuration; at the Invocation Driver: an invocation policy; behind the Rating Algorithm Facade for Rating Update Service timing: a facade factory where plug-in supplied; at the Rating Update Service: a cancellation-compensation adapter binding when result cancellation is enabled; at the Rating System: an optional projection callable; plus any optional eligibility / format-rule hooks. Per-call execution timing is owned by each callable's consuming component or facade path, not by this module.
  - *Output:* validated setup bindings and typed access to sealed callable references for owning adapters. Candidate proposals, compatibility decisions, composite scores, invocation-policy ticks, post-match rating updates, cancellation-compensation values, resolved rating-key sets, and projected rating values are produced by the owning adapters when they execute those callables.
  - *Key property:* stateless and pure-call from the framework perspective; the **only** framework boundary for engineer-supplied decision code, and the only contact surface the framework exposes for plug-in admission. The Plug-in Boundary admits, validates, seals, exposes, and defines failure-surfacing conventions for external callables; it does not execute callables or own matchmaking, rating, invocation, eligibility, format, or result-interpretation semantics.

- **Result Reporting Service**
  - *Input:* match-result reports, corrected-result requests, cancellation requests, and match-not-played reports from the interface layer; formation-structural facts read by point lookup against the Match Record Store; canonical accepted result facts returned by the Match Result Schema Catalog; source result id, latest result-application status, cancellation disposition, and compensation status returned by the Result Journal; existing not-played disposition returned by the Match Disposition Journal.
  - *Output:* accepted result records, application-status events, cancellation events, and compensation-status events appended to the Result Journal; not-played dispositions appended to the Match Disposition Journal; result-status/cancellation and match-not-played events emitted to the Notification Dispatcher after durable append; rating or compensation context handed to the Rating Update Service; source result id, latest disposition/status, and rating or compensation result returned to the interface-layer caller.
  - *Key property:* the **public-API-level boundary for result reporting, correction, cancellation, and match-not-played disposition**. Trusts reported or corrected results without truth verification (per the brief's trust model), but rejects payloads that fail Match Result Schema Catalog structural validation before journaling. Reads the Match Record Store for formation-structural recovery only; canonical accepted result facts and source-result cancellation facts are durably recorded through the Result Journal. It is the only component allowed to combine MRS recovery, result-schema validation, Result Journal accepted-result append, Result Journal cancellation/compensation-status append, Result Journal application-status inspection, and Rating Update Service invocation.

- **Rating Update Service**
  - *Input:* rating or cancellation-compensation context from the Result Reporting Service, source result id from the Result Journal, superseded source result id where applicable, latest Result Journal application/cancellation state, pre-update, correction-baseline, or compensation-evidence raw rating values returned by the Rating System read surface, and selected algorithm / Rating Algorithm Facade or compensation-adapter binding context.
  - *Output:* post-update or post-compensation raw rating values and source result id handed to the Rating System's commit-phase entry point; a rating-application or cancellation-compensation acknowledgement/failure returned to the Result Reporting Service; Rating History evidence used to repair missing `rating_applied` status or recover already-committed cancellation-compensation changes.
  - *Key property:* the **infrastructure boundary for idempotent rating application and cancellation compensation**. It owns result-time `rate()` timing through the Rating Algorithm Facade, owns cancellation-compensation adapter execution, and is the only component allowed to compose the Rating System read surface, facade/compensation invocation, Rating System commit phase, and Rating History cause-aware evidence lookup through that read surface. It never accepts interface-layer result reports directly and never writes Rating Store or Rating History except through the Rating System.

- **Notification Dispatcher**
  - *Input:* events from the Match Formation Engine (match formed), the Queue Manager (timeout-cancelled, player-cancelled, each including the admitted ticket region), and the Result Reporting Service (result accepted, rating applied, rating failed, result cancelled, cancellation compensation not needed/applied/failed, match not played), each carrying producer-supplied identifiers for the fact they pertain to; callbacks registered at framework construction.
  - *Output:* synchronous callback invocations into the interface layer.
  - *Key property:* the framework's only outbound channel to its host. Notifications are transient delivery; durable records of the same events live in the Ticket Journal, Match Record Store, Result Journal, and Match Disposition Journal and are accessible through their query surfaces.

- **Repository Layer**
  - *Input:* read/write operations from the Participant Registry, Group Registry, Rating Store, Queue Manager, Ticket Journal, Match Record Store, Result Journal, Rating History, and Match Disposition Journal.
  - *Output:* whatever the selected Repository Backend Adapters persist and retrieve through configured backend resources.
  - *Key property:* the only boundary across which durable-state persistence backends vary; backend choice is mediated by the Repository Layer through Repository Assembly, selected Repository Backend Adapters, and Backend Resource Provider descriptors, and remains invisible to every state consumer. Each consumer module owns its own contract at this boundary; the journal modules add five append-mostly contracts (with query reads) sibling to the four mutable contracts. Consumers depend on declared repository shapes, while Repository Backend Adapters adapt those shapes to configured backend resources.

- **Ticket Journal**
  - *Input:* lifecycle events from the Queue Manager — ticket creation (with participant or group handle, Regulation Context, admitted region, and declared context-aspect values where required), state transitions, and terminal events (matched with a match id, timed out, or cancelled by the player).
  - *Output:* persisted ticket-lifecycle records; historical query operations by ticket id, with filtered listing by participant or group handle, Regulation Context, and region.
  - *Key property:* complementary to the Queue Manager. The Queue Manager retains only *pending* state and discards a ticket when it leaves pending; the Ticket Journal retains the historical record of every admitted ticket and its terminal outcome. Terminal events (match-found, timeout, cancellation) are recorded as the ticket's terminal lifecycle entry — they do not have separate log modules.

- **Match Record Store**
  - *Input:* match-formation records from the Match Formation Engine — constituent ticket ids, Regulation Context, admitted ticket regions, resolved team/slot composition, and declared context-aspect assignments carried by the formed match.
  - *Output:* persisted formed-match records; mints the durable match id; query operations by match id, with filtered listing by ticket id, Regulation Context, and region.
  - *Key property:* complementary to the Notification Dispatcher. Notifications are transient delivery; the Match Record Store is the durable record of what was formed. The Result Reporting Service and Rating History both reference match ids minted here.

- **Result Journal**
  - *Input:* accepted reported-result and corrected-result records from the Result Reporting Service — source match id, canonical accepted result facts, superseded source result id where applicable, application-status events (`accepted`, `rating_applied`, `rating_failed`, `rating_not_required`), cancellation events keyed by target source result id, and cancellation-compensation status events.
  - *Output:* persisted result records; mints or owns the durable source result id; query operations by source result id, by source match id, by supersession linkage, latest application status, latest cancellation disposition, and latest compensation status by source result id.
  - *Key property:* complementary to the Result Reporting Service. The Result Reporting Service owns the trust boundary and the Result Rating Policy gate, the Match Result Schema Catalog owns structural result-schema validity, and the Rating Update Service owns rating application and cancellation compensation; the Result Journal owns the durable record of the canonical result facts accepted by the framework, the durable status history of whether rating application is still accepted-only, applied, failed, or not required, and the durable cancellation/compensation lifecycle for each source result. Rating History records reference source result ids minted here rather than defining result identity themselves.

- **Rating History**
  - *Input:* cause-tagged rating-change records from the Rating System — per `(rating unit, Regulation Context, context-local dimension)` tuple: old value, new value, source match id, source result id, superseded source result id where applicable, record cause (`result_application` or `result_cancellation_compensation`), and a reference to the rating policy/algorithm that produced the change.
  - *Output:* persisted rating-update records; query operations by rating unit, by source match id, by source result id, and by dimension.
  - *Key property:* complementary to the Rating Store and Result Journal. The Rating Store owns the *raw current* value per `(rating unit, Regulation Context, context-local dimension)`; the Result Journal owns source result identity, accepted payload, cancellation disposition, and lifecycle/status markers; the Rating History owns the *rating-change record* and provides the baseline records needed for corrected-result application and cause-aware evidence needed for cancellation compensation when rating changes exist. Matchmaking receives current rating values through the Rating System read surface, which privately reads the Rating Store — Rating History is not a substitute for current-value lookup.

- **Match Disposition Journal**
  - *Input:* match-not-played dispositions from the Result Reporting Service — match id, the `not_played` disposition value, an opaque reason code, and optional opaque note / audit reference.
  - *Output:* persisted disposition records (mints no id; keyed by match id); a point read by match id returning the stored disposition or a not-found (not-dispositioned / active) outcome.
  - *Key property:* complementary to the Match Record Store and Result Journal. The Match Record Store records *what was formed*, the Result Journal records *what result was accepted*, and the Match Disposition Journal records *that a formed match was deliberately not played*. It makes the deliberately-abandoned case a positively-recorded, queryable fact distinct from the default absence ("not yet played"). It records no result, rating, or compensation facts: a not-played match was never played, so there is nothing to compensate. At most one disposition per match in v1.

---

## 3. Data Flow Through the System

The framework carries two distinct flows. Both are conceptual; concrete record shapes belong in the Data Schema document.

### 3.1 Matchmaking flow

1. **Participant registration** — the interface layer hands player info to the Participant Registry, which returns a stable participant handle.
2. **Group forming (optional)** — pre-agreed group composition is stored against the Group Registry and reusable in future requests. The Group Registry rejects member handles that do not identify registered participants.
3. **Configuration** — Regulation Context definitions are supplied to the Regulation Context Catalog, rating dimension definitions are supplied to the Rating Dimension Catalog, context-aspect metadata definitions are supplied to the Context Aspect Metadata Catalog after the referenced context-aspect vocabulary is available, region definitions and fallback-order facts are supplied to the Region Catalog, one result contract per Regulation Context is supplied to the Match Result Schema Catalog after the Regulation Context Catalog seals, and one Result Rating Policy entry per Regulation Context is supplied to the Result Reporting Service.
4. **Enqueue** — the interface layer asks the Queue Manager to create a match-request ticket for a participant or group under a specific Regulation Context and explicit region, including any required pre-match context-aspect declarations. The Queue Manager rejects unknown participant or group handles, unknown Regulation Context handles, and unknown region handles before creating pending state; otherwise, a ticket handle is returned to the caller and the Queue Manager appends the creation entry, including region, to the Ticket Journal as part of the same call.
5. **Matchmaking invocation** — when an Invocation Driver advances matchmaking for a supplied Regulation Context:
   - the Queue Manager first evaluates timeouts only within that Regulation Context, appends terminal "timed out" entries to the Ticket Journal for evicted tickets, and emits timeout events carrying the ticket id,
   - the Match Formation Engine selects candidate formations for that Regulation Context from the Queue Manager, including proposal-chosen assignment rating dimensions and MFE-assembled region fallback context,
   - validates those dimensions through the Rating Dimension Catalog and follows the Rating System matchmaking read path to obtain each candidate's resolved matchmaking rating view, including projected MMR where configured,
   - invokes the setup-selected component-owned composite scorer exposed by the Plug-in Boundary using the resolved rating values,
   - resolves group-owned ticket occupancy through Group Registry membership cardinality where needed for structural validation,
   - checks the Regulation Context's match structure (team count, team size, slot requirements, and configured context-aspect declaration requirements),
   - checks compatibility via the setup-selected plug-in predicate,
   - and, if both conditions hold, persists the formed match through the Match Record Store (which mints the match id and stores each assignment's region), instructs the Queue Manager to remove the constituent tickets from the pending view (the Queue Manager appends each ticket's terminal "matched" entry to the Ticket Journal at that point), and emits a match-found event referencing those ticket ids and the match id.
6. **Cross-context progression policy** — the framework does not choose the next Regulation Context after a targeted invocation returns. The interface layer, invocation policy, or host-integrated driver decides which context to advance next, and can implement round-robin, priority, throttling, or maintenance-window behaviour there.
7. **Notification** — for matchmaking lifecycle outcomes, the Notification Dispatcher delivers match-found, timeout, and player-cancellation events to the interface-layer callbacks; each event carries the ticket id(s) it pertains to. (Player-initiated cancellation similarly produces the terminal "cancelled" entry in the Ticket Journal at the Queue Manager's cancel call.) Result-status and result-cancellation notifications are produced later by the Result Reporting Service in the result flow.

### 3.2 Result flow

1. The interface layer reports a match result to the Result Reporting Service.
2. The Result Reporting Service reads the Match Record Store by point lookup to recover formation-structural facts (Regulation Context, constituent ticket ids, assignment regions, team/slot composition).
3. The Result Reporting Service obtains the Match Result Schema Catalog's context-bound validator for the recovered Regulation Context and validates / normalizes the caller payload against the recovered formation facts. Invalid payloads stop here before any Result Journal append.
4. The Result Reporting Service appends the canonical accepted result facts to the Result Journal, which returns the durable source result id and records the initial `accepted` application status. It emits *result-accepted* after that status is durable. This append records the canonical result facts even if the later rating calculation produces no rating changes.
5. The Result Reporting Service checks the recovered Regulation Context's Result Rating Policy entry and the latest Result Journal disposition and application status for the source result id. If the policy says the result does not affect ratings, it appends terminal `rating_not_required` and returns without assembling a rating call context or invoking the Rating Update Service.
6. If the source result is cancelled, the Result Reporting Service blocks ordinary rating application for that source result. If the latest status is `rating_applied` or `rating_not_required`, it returns the terminal status without invoking rating application again. If the latest status is `accepted` or `rating_failed` and the result is rating-bearing, it merges formation-structural facts with canonical accepted result facts into a rating call context and invokes the Rating Update Service.
7. The Rating Update Service invokes the Rating System's **read surface** for that context. The Rating System resolves the affected rating unit(s), privately obtains raw current rating values from the Rating Store, and returns them — along with selected algorithm / Rating Algorithm Facade rate binding context for each key's policy — to the Rating Update Service.
8. The Rating Update Service's plug-in adapter invokes the Rating Algorithm Facade's `rate()` method, supplying the pre-update raw values and the rating call context; the facade returns post-update raw values.
9. The Rating Update Service invokes the Rating System's **commit phase** with the post-update values and source result id. The Rating System persists the post-update raw values through the Rating Store (single write or atomic batch) and appends a cause `result_application` change record to the Rating History for each `(rating unit, Regulation Context, context-local dimension)` whose value changed.
10. The Result Reporting Service appends a Result Journal application-status event: `rating_applied` when the Rating Update Service confirms application, including no-change applications, or `rating_failed` for a known rating-application failure before successful rating commit. It emits *result-rating-applied* or *result-rating-failed* after that status is durable. Non-rating-bearing results already stopped at `rating_not_required` and emit no additional rating-lifecycle notification beyond *result-accepted*. The source result id, latest status, and rating-application result are returned to the caller.

A corrected result follows the same Result Reporting Service boundary but is not a blind re-submission from the current rating state. The request identifies the formed match and the superseded source result. The Result Reporting Service blocks the correction if the superseded source result is cancelled. Otherwise, it validates the corrected payload against the same Match Result Schema Catalog contract used for ordinary reports, appends the canonical corrected result facts to the Result Journal as a new source result id linked to the superseded source result id, and records `accepted` for that corrected source result. It then applies the same Result Rating Policy gate. For rating-bearing results it invokes the same Rating Update Service boundary; the Rating System read surface returns the Rating History records for the superseded result as the correction baseline rather than treating the corrected result as an unrelated fresh submission. For non-rating-bearing results it records `rating_not_required` and does not invoke Rating Update Service. Concrete correction arithmetic and replay policy belong in the downstream component specifications; the architectural requirement is that correction is based on recorded result identity plus recorded rating history when rating application is required, not on treating the corrected result as a second unrelated result.

Result application is idempotent by source result id. Retrying a result whose latest Result Journal status is `rating_applied` returns the already-applied outcome without reapplying ratings; retrying a result whose latest status is `rating_not_required` returns the not-required outcome without invoking Rating Update Service; retrying a source result whose latest status is `accepted` or `rating_failed` may invoke the Rating Update Service again only when the result is rating-bearing and not cancelled. If rating changes were committed but the `rating_applied` status event was not recorded, the Rating Update Service uses Rating History lookup by `source_result_id` and cause `result_application` to detect prior application and lets the Result Reporting Service repair the Result Journal status to `rating_applied`. No-change applications rely on the Result Journal status event as the durable applied marker. Non-rating-bearing accepted results rely on `rating_not_required` as the durable terminal marker.

Result cancellation is append-only and targets exactly one source result id. The Result Reporting Service records the cancellation event in the Result Journal with an opaque reason code and optional opaque audit fields, emits *result-cancelled* after that fact is durable, and never mutates or deletes the accepted result record. Cancellation is terminal for that source result: later ordinary rating retries and later corrections targeting that same source result are blocked, and cancellation does not cascade across corrected-result chains. If the source result is `rating_not_required`, compensation is not needed and Rating Update Service is not invoked. If rating compensation is needed, the Rating Update Service checks Rating History evidence even when Result Journal does not say `rating_applied`, invokes the cancellation-compensation adapter admitted through Plug-in Boundary, commits cause `result_cancellation_compensation` rating-history records through the Rating System when values changed, and returns a compensation outcome for the Result Reporting Service to record in the Result Journal. Repeating cancellation after compensation success or not-needed returns the existing state without appending another cancellation event; repeating after `compensation_failed` retries compensation without appending another cancellation event.

The SLA does not prescribe whether group ratings are independent values, derived from member ratings, or both. It also does not prescribe whether matchmaking MMR is a direct field of an algorithm's raw value, a built-in projection, or a plug-in-backed projection over several dimensions, nor how declared context-aspect metadata affects that projection. Those policies belong to the Rating System's downstream component specification and sealed rating-policy / projection configuration. Other components consume the Rating System's resolved rating view rather than making those decisions themselves.

### 3.3 Match-not-played flow

A formed match may be deliberately not played — for example, the participants agree to abandon it before play. This is distinct from a match that is merely *not yet played* (still waiting, in progress, or played-but-unreported), which the framework represents as the absence of any disposition and any result. It is also distinct from result cancellation, which invalidates an *already reported* result and may require rating compensation.

1. The interface layer reports a match-not-played disposition to the Result Reporting Service, naming the match id and an opaque reason code (plus optional note / audit reference).
2. As a producer-side consistency guard, the Result Reporting Service may read the Match Disposition Journal (to detect an existing disposition) and the Result Journal (to detect an already-accepted result for the match) before it writes. The journals themselves perform no cross-journal validation.
3. The Result Reporting Service appends the `not_played` disposition to the Match Disposition Journal, keyed by the match id. The journal mints no id and permits at most one disposition per match in v1; a second append for the same match id is a conflict.
4. After the disposition is durable, the Result Reporting Service emits *match-not-played* through the Notification Dispatcher.

No rating application or cancellation compensation occurs: a not-played match was never played, so there is no rating change to apply or revert. Recording the disposition does not re-open the constituent tickets, which are already terminal (`matched`) in the Ticket Journal; re-queueing players means creating new tickets through the Queue Manager and is an interface-layer concern.

### 3.4 Framework lifecycle

The framework has two explicit lifecycle phases: **setup / construction** and **runtime**.

Setup is a real architectural phase, not merely the first runtime call. During setup, the host supplies configuration, backend resources, repository-adapter choices, callbacks, plug-in bindings, and result contracts. Components validate the facts they own, and composition boundaries validate cross-component wiring. A setup failure aborts framework construction before runtime operations are admitted; partially sealed components, partially built repository bundles, partially validated plug-in bindings, and first-use setup repair are not framework behavior.

Setup ownership stays local:

- Catalogs validate and seal their own configuration/reference facts.
- The Plug-in Boundary admits, validates, and seals engineer-supplied callable bindings, but does not execute them.
- Repository Assembly validates persistence-plan completeness, binding-key resolution, adapter/resource compatibility, and sealed repository-bundle construction.
- Backend Resource Providers own backend resource construction, lifecycle, descriptor publication, and provider-local validation.
- Component-local load-time validators check only that their own required capabilities are available and correctly wired before the component accepts runtime calls.

Runtime receives sealed capabilities and performs use-case work. Runtime components may read sealed catalogs, call repository contracts from the sealed repository bundle, dispatch to construction-time callbacks, and obtain validated plug-in bindings through the Plug-in Boundary. Runtime does not expose hot reload, adapter swapping, plug-in replacement, catalog mutation, setup-registry lookup, or late binding unless a future architecture change introduces those surfaces explicitly.

The lifecycle rule is:

> A component owns setup checks for the facts it owns. A composition owner owns wiring between components. Runtime consumers receive sealed, already-valid capabilities and do not re-run setup logic.

What crosses each boundary:

| From → To | Conceptual payload |
|---|---|
| Interface → Participant Registry | participant info + optional platform bindings; returns a participant handle |
| Interface → Group Registry | group membership composition using participant handles; returns a group handle |
| Interface → Regulation Context Catalog | structural match-format definitions and context-aspect vocabulary |
| Interface → Rating Dimension Catalog | rating dimension definitions |
| Interface → Context Aspect Metadata Catalog | metadata key definitions and aspect-value metadata entries |
| Interface → Region Catalog | region definitions and global fallback-order facts |
| Interface → Match Result Schema Catalog | one result contract per Regulation Context |
| Match Result Schema Catalog → Regulation Context Catalog | setup-only validation of Regulation Context and context-aspect references |
| Interface → Queue Manager | participant/group handle + Regulation Context + region + pre-match context-aspect declarations where required + per-request parameters; returns a ticket handle |
| Participant Registry → Group Registry | point lookup / existence result for participant handles named in group membership |
| Participant Registry → Queue Manager | point lookup / existence result for participant handles named in ticket-creation requests |
| Group Registry → Queue Manager | group lookup / existence result for group handles named in ticket-creation requests |
| Regulation Context Catalog → Queue Manager | Regulation Context lookup for admission constraints and pending-view partitioning |
| Region Catalog → Queue Manager | region lookup for ticket-admission existence checks |
| Regulation Context Catalog → Match Formation Engine | structural match-format definitions, slot requirements, and configured context-aspect requirements |
| Region Catalog → Match Formation Engine | expanded fallback-order snapshots for regions present in the targeted attempt's pending slice |
| Group Registry → Match Formation Engine | group membership cardinality for group-owned pending ticket structural occupancy derivation |
| Rating Dimension Catalog → Match Formation Engine | context-local rating dimensions scoped by the attempt Regulation Context for proposal-dimension validation |
| Rating Dimension Catalog → Rating System | context-local rating dimensions scoped by caller-supplied Regulation Context, plus hierarchy traversal for policy/projection use |
| Context Aspect Metadata Catalog → Rating System | declared metadata facts about context-aspect values used as projection inputs where configured |
| Context Aspect Metadata Catalog → Interface | read-only metadata lookups and reverse enumerations for presentation workflows such as tier grouping |
| Invocation Driver → Queue Manager | Regulation Context target + current-time value for targeted timeout evaluation |
| Invocation Driver → Match Formation Engine | Regulation Context target for targeted match formation |
| Queue Manager → Match Formation Engine | pending-ticket slice for the target Regulation Context, including each ticket's region |
| Queue Manager → Interface | pending ticket snapshots by ticket id, Regulation Context, region, participant handle, or group handle |
| Match Formation Engine ↔ Rating System | matchmaking read path: candidate tickets in, resolved projected matchmaking rating views out |
| Match Formation Engine ↔ Plug-in Boundary | typed access to validated candidate-proposal, compatibility-predicate, and composite-scorer bindings selected by MFE setup configuration; plug-in contexts include engine-supplied region fallback context rather than direct Region Catalog access |
| Match Formation Engine → Match Record Store | formed-match record (constituent ticket ids, Regulation Context, assignment regions, team/slot composition, context-aspect assignments); returns a durable match id |
| Match Formation Engine → Notification Dispatcher | match record (ticket ids, match id, Regulation Context) |
| Queue Manager → Ticket Journal | ticket-lifecycle entries at creation, transition, and termination (created entries include admitted region; terminal entries are matched / timed out / cancelled) |
| Result Reporting Service → Notification Dispatcher | result-status, cancellation, cancellation-compensation, and match-not-played events after accepted / rating-applied / rating-failed / cancelled / compensation / not-played status is durable |
| Notification Dispatcher → Interface | event type + producer-supplied identifiers: ticket id(s) for ticket/match events, source result id / source match id / status / compensation status for result events |
| Interface → Result Reporting Service | match identifier + reported result, corrected result + superseded source result id, cancellation request + target source result id + reason code, or match-not-played request + match id + reason code |
| Result Reporting Service → Match Record Store | point read by match id; formation-structural recovery (Regulation Context, constituent ticket ids, assignment regions, team/slot composition) |
| Result Reporting Service → Match Result Schema Catalog | context-bound validation / normalization of reported or corrected payloads against recovered formation facts |
| Result Reporting Service → Result Journal | canonical accepted result record; returns source result id, records supersession linkage where applicable, records application-status events (`accepted`, `rating_applied`, `rating_failed`, `rating_not_required`), records cancellation events, and records cancellation-compensation status events |
| Result Reporting Service → Match Disposition Journal | not-played disposition (match id, `not_played`, reason code, optional note / audit ref); point read by match id for the producer-side consistency guard |
| Result Reporting Service → Rating Update Service | rating or cancellation-compensation context, source result id, latest application/cancellation state, and superseded source result id on corrections |
| Rating Update Service ↔ Rating System | result write path *read surface*: rating or compensation context in, resolved keys + pre-update raw values (or correction-baseline raw values from Rating History on corrections, or target-result evidence for cancellation compensation) + selected algorithm / Rating Algorithm Facade or compensation-adapter binding context out; cause-aware recovery lookup by source result id to detect already-committed Rating History records. Result write path *commit phase*: post-update or post-compensation raw values + source result id (+ superseded source result id on corrections) + record cause in, commit acknowledgement out. |
| Rating Update Service ↔ Rating Algorithm Facade | result-time `rate()` invocation over selected algorithm context, pre-update raw values, and rating call context |
| Rating Update Service ↔ Plug-in Boundary | typed access to validated facade factory bindings and cancellation-compensation bindings where supplied |
| Rating System ↔ Plug-in Boundary | typed access to validated projection bindings where configured |
| Rating System ↔ Rating Store | private current-value reads used behind the Rating System read surface, keyed by rating unit + Regulation Context + context-local dimension; result write path writes updated raw rating values keyed by rating unit + Regulation Context + context-local dimension |
| Rating System → Rating History | per-`(rating unit, Regulation Context, context-local dimension)` cause-tagged change record (old value, new value, source match id, source result id, superseded source result id where applicable, rating-policy reference, record cause) |
| Ticket Journal / Match Record Store / Result Journal / Rating History / Match Disposition Journal ↔ Repository Layer | append + query operations under the journal contracts |
| Interface → Ticket Journal / Match Record Store / Result Journal / Rating History / Match Disposition Journal | read-back queries (by ticket id, match id, source result id, rating unit, source match id, dimension, etc.) |

---

## 4. Component Interactions

All component interactions are **synchronous, in-process Python calls** on a single thread of control supplied by the host application. The framework owns no threads, no event loop, and no scheduler.

- **Inbound calls from the interface layer** (register, form-group, enqueue, cancel, report-result, and invocation-driver entry points) execute synchronously and return when the framework finishes the work they describe.
- **The Invocation Driver** advances matchmaking progression through a framework-defined invocation boundary. Each invocation targets one Regulation Context and runs timeout evaluation before match formation for that target. A deployment may use a manual, periodic, event-triggered, or host-integrated driver; host code does not coordinate the Queue Manager, Match Formation Engine, and timeout processing directly.
- **Internal calls** between framework components are direct method invocations; there is no message bus, queue, or shared mutable buffer beyond the persistent stores accessed through the Repository Layer.
- **Notification callbacks** are invoked synchronously inside the call that produced the event (an enqueue, an invocation, a cancellation, or a result-reporting call). The framework does **not** isolate callback exceptions beyond logging — long-running work, retries, and concurrency are the engineer's responsibility at the interface layer.
- **Plug-in calls** are likewise synchronous and executed by the consuming component's plug-in adapter; the Plug-in Boundary validates plug-in shape at construction time so that runtime adapter calls can assume a known signature.
- **Journal writes and read-back** (Ticket Journal, Match Record Store, Result Journal, Rating History) are synchronous calls executed inside the producing module's call frame: the Queue Manager writes ticket-lifecycle entries inside its create/cancel/timeout calls, the Match Formation Engine writes formed-match records inside its formation call, the Result Reporting Service writes accepted result records, result-application status events, cancellation events, and compensation-status events inside its report/correction/cancellation calls, and the Rating Update Service produces rating-application or cancellation-compensation writes that the Rating System commits to Rating History inside the Rating Update Service's call. Read-back queries from the interface layer are likewise synchronous. The framework still owns no thread, event loop, or scheduler.

This discipline supports determinism for deterministic invocation policies: given the same registered entities, the same enqueue/cancel/report sequence, the same invocation sequence, and the same plug-ins, the framework produces identical outcomes.

---

## 5. Separation of Concerns

State ownership is partitioned strictly:

- **Participant Registry** owns stable participant identities and optional external platform bindings.
- **Group Registry** owns reusable group definitions and membership composition; it depends on participant handles and may validate their existence, but it does not own participant identity.
- **Regulation Context Catalog** owns structural match-format definitions and the context-aspect vocabulary referenced by those definitions as configuration/reference data.
- **Rating Dimension Catalog** owns rating dimension definitions as configuration/reference data; it does not own rating values, rating algorithms, rating-key resolution, or matchmaking projection.
- **Context Aspect Metadata Catalog** owns declared metadata facts about context-aspect values as configuration/reference data; it does not own context-aspect vocabulary, rating dimensions, rating values, projection formulas, matchmaking heuristics, aspect-value legality, or in-game procedure.
- **Region Catalog** owns region vocabulary and global fallback-order facts as configuration/reference data. It does not derive a request's region, score regions, own region-bearing repository records, or decide fallback eligibility.
- **Match Result Schema Catalog** owns per-Regulation-Context result contracts, structural result-data validation, and canonical accepted result facts as configuration/reference data plus a runtime validation surface. It does not verify result truth, own correction/cancellation policy, translate results to rating algorithms, or persist accepted result records.
- **Rating System** owns rating-system infrastructure: the canonical rating read surface, dimension→policy bindings (including selected algorithm / facade binding context per policy), rating-key resolution, projection from raw rating values and configured projection inputs into the values exposed to matchmaking, result-update preparation reads, correction-baseline reads, rating-side evidence lookup (including cancellation-compensation evidence), and the commit gateway that persists post-update or post-compensation raw values and appends cause-tagged Rating History records on Rating Update Service request. It does not own coordinated rating-application or cancellation-compensation execution; result-time `rate()` and compensation-adapter timing live at the **Rating Update Service**, not here.
- **Result Reporting Service** owns the public-API boundary for result reporting, correction, and cancellation: it owns Result Rating Policy for whether each Regulation Context's accepted results affect ratings, reads the Match Record Store for formation-structural recovery, asks the Match Result Schema Catalog to validate and normalize reported facts, appends accepted reports, application-status events, cancellation events, and compensation-status events to the Result Journal, merges formation facts with canonical accepted result facts only when a rating call context is needed, checks the latest disposition/status for idempotency and terminality, and invokes the Rating Update Service when rating application or cancellation compensation is required.
- **Rating Update Service** owns the infrastructure boundary and write authority for idempotent rating application and cancellation compensation: its plug-in adapter invokes the Rating Algorithm Facade's `rate()` method, its compensation adapter computes cancellation compensation, it sequences the Rating System read-surface and commit-phase calls around those calls, initiates the rating-state commit through the Rating System, and uses cause-aware Rating History evidence by source result id through the Rating System read surface to detect already-committed rating changes when repairing a missing `rating_applied` status or retrying cancellation compensation.
- **Rating Store** owns stored raw rating values keyed by rating unit and dimension; only the **Rating System** mutates it directly as the rating-state commit gateway.
- **Queue Manager** owns match-request ticket state and the pending views per Regulation Context, direct owner, and region; only the **Invocation Driver** triggers its targeted timeout evictions, only the interface layer triggers its ticket-creation and player-cancel transitions. Ticket creation validates referenced participant or group handles, Regulation Context handles, and region handles through their owning registries/catalogs.
- **Plug-in Boundary** is the only framework surface for admitting engineer-supplied decision code; no component imports unvalidated plug-ins directly, and all plug-in execution uses callables exposed by this extension boundary while execution timing and result interpretation stay with the owning component.
- **Ticket Journal** owns historical ticket-lifecycle records; only the **Queue Manager** appends to it.
- **Match Record Store** owns formed-match records and the durable match id; only the **Match Formation Engine** appends to it.
- **Result Journal** owns reported-result records, source result ids, canonical accepted result facts, supersession links, result-application status events, cancellation events, and cancellation-compensation status events; only the **Result Reporting Service** appends to it.
- **Rating History** owns cause-tagged rating-change records keyed by rating unit, dimension, source match/result id, and superseded source result id where applicable; rating applications and cancellation compensation are produced by the **Rating Update Service** and appended only through the **Rating System** commit gateway.
- **Match Disposition Journal** owns durable not-played match dispositions keyed by match id; only the **Result Reporting Service** appends to it. It records no result, rating, or compensation facts.
- **Repository Layer** is the only boundary through which durable-state backends vary; backend variation is mediated through Repository Assembly, selected Repository Backend Adapters, Repository Layer backend profiles, and Backend Resource Provider descriptors, and remains invisible to every consumer, whether it owns mutable state or an append-mostly journal.

The dependency direction is acyclic and one-way:

```
Repository Layer
        ↑
Participant Registry, Group Registry, Rating Store, Queue Manager,
Ticket Journal, Match Record Store, Result Journal, Rating History,
Match Disposition Journal
        ↑
Rating System  ←  Regulation Context Catalog, Rating Dimension Catalog,
                  Context Aspect Metadata Catalog
        ↑
Match Formation Engine, Rating Update Service
        ↑
Result Reporting Service  ←  Match Result Schema Catalog
        ↑
Invocation Driver, Notification Dispatcher
        ↑
Interface layer (host application)
```

The Plug-in Boundary sits beside this call stack as an extension boundary. It is consulted by the Match Formation Engine, Invocation Driver, Rating Update Service, and Rating System through each component's plug-in adapter to obtain validated callable access; it does not own callable execution or a domain step in the progression stack.

The Queue Manager writes to the Ticket Journal, the Match Formation Engine writes to the Match Record Store, the Result Reporting Service writes accepted/status/cancellation/compensation facts to the Result Journal and not-played dispositions to the Match Disposition Journal, and the Rating Update Service produces rating changes that the Rating System appends to Rating History through its commit gateway. These are the only journal-producing paths; no other module appends directly to those journals.

Within the mutable-state owners, the Participant Registry may be read by Group Registry and Queue Manager for participant-handle existence checks, and the Group Registry may be read by Queue Manager for group-handle existence checks. These are admission checks only: they do not create cascade behaviour, identity ownership transfer, or reverse lookup by external platform binding. The Match Formation Engine also reads Group Registry membership cardinality for group-owned pending tickets during structural occupancy derivation; that read does not repair queue state, transfer ownership, or expand formed match records into participant-level group membership.

The journal modules are first-class domain modules with their own Repository Layer contracts (per `CLA-repository-layer.md` §6, which permits adding a new domain module that owns durable state by adding a new contract). They are *not* audit shims layered over the existing mutable contracts — the boundary's exclusion of read interceptors, write hooks, and audit shims (`CLA-repository-layer.md` §7) is preserved. The framework's history modules and the interface layer's audit responsibilities are complementary: the framework records its own domain events (ticket lifecycle, formed matches, accepted result reports, result-application status, result cancellation, cancellation-compensation status, not-played match dispositions, rating changes, and rating-history links between corrected and superseded results), while interface-layer audit concerns such as staff identity as result reporter or cancellation adjudicator remain outside the framework.

Benefits: persistence-backed behavior can be exercised through Repository Backend Adapter tests without touching domain logic; plug-ins can be swapped without altering the framework; an Invocation Driver can be advanced manually with an explicit Regulation Context sequence in tests for fully deterministic replay.

---

## 6. Modularity and Extensibility

The framework offers two extension axes and one configuration axis.

**Plug-in callables** (passed to the framework at construction; each callable's call site is owned by the component named — call sites are not interchangeable):
- at the **Match Formation Engine**: named candidate-proposal, compatibility-predicate, and composite-scorer bindings selected per Regulation Context by MFE setup configuration,
- at the **Invocation Driver**: an invocation policy (manual, periodic, event-triggered, or host-integrated advancement),
- behind the **Rating Algorithm Facade**, timed by the **Rating Update Service**: a bound facade `rate()` method that produces post-match ratings from pre-match (or correction-baseline) ratings and the rating call context the Result Reporting Service assembles,
- behind the **Rating Update Service cancellation-compensation adapter**: a bound compensation callable that computes post-compensation ratings from current values, target result history evidence, accepted payload, formation facts, and cancellation reason,
- at the **Rating System**: an optional projection callable used to derive projected rating values from raw rating values and projection context (the matchmaking caller's projected view is conventionally named MMR); the Rating System has no rating-key-resolver hook — rating units arrive given and rating dimensions are derived upstream at the Match Formation Engine, leaving the Rating System only hierarchy expansion of given anchor keys,
- optional hooks for eligibility checks and format-rule enforcement at the components that consume them.
The Plug-in Boundary validates shape at construction time and is the sole framework extension boundary for these callables; each call site and callable execution timing is owned by the consuming component's plug-in adapter or facade-owning component. Adding a new game means writing new plug-ins or facade factory bindings for the relevant owning components, not modifying framework code.

**Persistence backends** (passed to the framework at construction):
- backends are supplied as configured resources through Backend Resource Providers;
- Repository Assembly resolves binding keys, checks profile-family metadata, checks selected adapter concrete resource-type requirements, and constructs the sealed repository bundle;
- the first implementation assumes one SQL profile resource, one document profile resource, and one KV profile resource;
- the nine per-consumer repositories realise their own contracts through Repository Backend Adapters over provider resources, not through one universal backend interface;
- repository contract tests and backend-specific tests prove repository behavior for a backend implementation;
- profile-family metadata is not permission for consumers to issue backend-native queries;
- engineers can supply file-, SQLite-, or service-backed implementations by providing compatible providers, adapter declarations, backend support helpers where useful, and tests;
- backend swap is invisible to every consumer, whether it owns mutable durable state or an append-mostly journal.

**Regulation Contexts** are *configured* through the Regulation Context Catalog rather than coded — a new structural match format or context-aspect requirement is added without touching framework code, provided existing plug-ins cover any non-structural compatibility decisions it needs.

**Rating dimensions** are *configured* through the Rating Dimension Catalog. Rating policies and projection policies may branch on Regulation Context, declared context-aspect values, configured dimensions, and declared context-aspect metadata, but they are not part of the Regulation Context itself.

**Context aspect metadata** is *configured* through the Context Aspect Metadata Catalog. Metadata keys and aspect-value classifications such as character tiers are added or changed without touching framework code; projection policies may consume those declared facts, but numeric projection meaning remains in the Rating System.

**Match result contracts** are *configured* through the Match Result Schema Catalog. Result field requirements, structural validity rules, and canonical result fact normalization are added or changed without touching framework code, provided each Regulation Context has exactly one result contract at setup. Rating translation and result verification remain outside the catalog.

---

## 7. Design Principles

- **Game-agnostic core.** The framework holds no game-specific procedure logic. Match structure lives in Regulation Context configurations; scoring and rating arithmetic live in downstream rating policy and plug-ins.
- **Trust the caller.** Per the brief's trust model, the framework does not verify reported results, resolve disputes, or perform anti-cheat. Result integrity is the operator's responsibility at the interface layer.
- **Single-threaded simplicity.** All work is synchronous and advanced through an invocation boundary. Concurrency, scheduling, and I/O policy remain outside core match formation logic and can vary by deployment.
- **Determinism given inputs.** Deterministic invocation policies produce repeatable progression, so the same input sequence and targeted invocation sequence yield the same outcomes — valuable for testing and for any analytical use of the framework.
- **Replaceable persistence.** The Repository Layer keeps storage choice for mutable durable and append-mostly historical framework state out of domain code by mediating configured backend resources through Repository Assembly and selected Repository Backend Adapters; repository and backend tests prove behavior.
- **Plug-in isolation.** Engineer-supplied code is admitted and exposed only through the Plug-in Boundary's typed surface, keeping game-specific assumptions out of framework wiring while execution remains with the owning component adapters.
- **Use-case coordinators over infrastructure.** Interface-facing operations are admitted through use-case coordinators such as the Result Reporting Service; lower-level infrastructure such as the Rating Update Service and Rating System is composed only through those framework-owned boundaries.
- **History as first-class state.** Ticket lifecycle, formed matches, accepted result reports, result-application status, result cancellation, cancellation-compensation status, not-played match dispositions, and rating changes are framework-owned durable records — the Ticket Journal, Match Record Store, Result Journal, Rating History, and Match Disposition Journal — not interface-layer audit. Interface-layer audit (e.g., who submitted or cancelled a result and how staff-facing correction/cancellation workflows are presented) remains a separate, complementary concern. Replay, post-hoc inspection, deterministic verification, idempotent result-application recovery, and cancellation-compensation recovery are supported through framework-owned query surfaces rather than through backend-coupled queries.

---

### Summary

| Section | Focus | Abstraction | Purpose |
|---|---|---|---|
| 1. System-Level View | Module set and the loop they form | Conceptual | Show how the twenty-two modules cooperate end-to-end |
| 2. Core Components | Per-module responsibilities | Analytical | Pin down inputs, outputs, and key properties |
| 3. Data Flow | Matchmaking, result, not-played, and lifecycle flows | Dynamic | Trace what crosses each boundary and make fail-fast setup explicit |
| 4. Component Interactions | Synchronous, host-driven calls | Operational | State the timing and threading model explicitly |
| 5. Separation of Concerns | State ownership and dependency direction | Structural | Keep modules swappable and testable |
| 6. Modularity & Extensibility | Plug-ins, backends, configured Regulation Contexts | Strategic | Define how new games and storage choices are absorbed |
| 7. Design Principles | Game-agnosticism, trust, determinism, isolation | Conceptual | Tie the architecture back to the brief's intent |
