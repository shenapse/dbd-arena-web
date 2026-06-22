---
version: "0.3"
doc_type: "UX concept"
scope:
  in_scope:
    - public-website-responsibility
    - player-facing-information-architecture
    - published-deployment-rules-and-policies
    - external-operational-handoff
    - regulation-content-lifecycle
    - public-content-and-data-governance
  out_of_scope:
    - external-matchmaking-behavior: "The website may describe expected player workflows but does not define or verify external system behavior"
    - discord-interaction-design: "Discord is an external destination, not part of the website contract"
    - framework-internals: "The website has no architectural dependency on the framework"
    - exact-page-layout-and-copy: "Website design-owned"
    - technical-site-implementation: "Downstream implementation concern"
  cross_reference_allowed:
    - UX
    - SLA
---

# Dead by Daylight Deployment Website Experience

> Defines the responsibility, content model, information architecture, and experience requirements for the public website of the Dead by Daylight matchmaking deployment.
>
> The website is the deployment's published public handbook. Matchmaking operations, Discord, and the matchmaking framework are external to the website and outside this contract.

---

## 1. Purpose And Audience

The website serves prospective and active players first. It helps a visitor:

1. Understand what this community matchmaking service is and what it delivers.
2. Decide whether the service is relevant to them.
3. Compare active match regulations and choose how they want to play.
4. Learn the normal player journey and the policies they must follow.
5. Enter Discord prepared to register and use the live service.

The primary promise is **structured community competition**: players find suitable opponents for custom Dead by Daylight matches, play under published regulations, and, where applicable, build service-specific ratings.

The site is for this DBD deployment only. It does not promote or explain the game-agnostic framework to engineers. It assumes visitors already understand ordinary Dead by Daylight mechanics and explains only the service-specific concepts, custom regulations, workflow, ratings, and community policy.

The website must make clear that:

- The service is community-run and is not an official Dead by Daylight service.
- Matches are played in custom games outside official matchmaking.
- Service ratings do not affect official in-game ratings or progression.

---

## 2. Website Boundary

### 2.1 Website Responsibilities

The website owns the human-readable publication of:

- The service concept, value, eligibility, and participation prerequisites.
- The normal player journey from registration through result reporting.
- Regulation discovery and complete regulation-specific match references.
- Player-facing explanations of matchmaking and rating behavior.
- Player policies, including conduct, disconnects, remakes, disputes, reporting, possible penalties, privacy, and staff escalation.
- Task-based operational guidance that explains goals, states, steps, and expected outcomes.
- Regulation and policy status, versions, effective dates, and public change history.
- Essential maintenance, regulation, and policy notices.

The website is public and mostly static. Reading it requires no account or membership.

### 2.2 External Operational Handoff

Discord is an external destination for authenticated operations and staff assistance. The website may describe expected player workflows and link to relevant Discord destinations, but it does not define, control, verify, or impose requirements on Discord behavior, content, channel structure, or availability.

The website does not provide authenticated matchmaking operations, contact forms, support tickets, registration, or rule-acceptance controls. Its responsibility ends when it presents the relevant explanation and external handoff.

### 2.3 External Systems And Private State

The website has no runtime or build-time dependency on the matchmaking framework, matchmaking service, their deployment, or Discord. It does not call their interfaces, read their state, control their behavior, or require coordinated changes from them.

The website may depend on producer-neutral input that describes framework, deployment, service, or Discord concepts. That input belongs to the website publication boundary and creates no dependency on, or provenance contract with, the external system it may describe.

The website must never expose or control:

- Player profiles or authenticated identity details.
- Group membership or management state.
- Queue membership, status, or wait state.
- Match formation, readiness, participant assignments, or private match workspaces.
- Result proposals, approvals, accepted private outcomes, or individual rating notifications.
- Staff cases, evidence, moderation notes, or audit records.

---

## 3. Published Player Journey

The homepage's primary action is **Start Playing**. It leads through a short preparation journey rather than sending an uninformed visitor directly to Discord.

The website journey is:

1. Explain the service and its unofficial, custom-game scope.
2. State participation prerequisites and expected player conduct.
3. Compare active regulations using consistent player-relevant attributes.
4. Let the visitor open the complete reference for a chosen regulation.
5. Explain registration, group, queue, readiness, play, and result-reporting states.
6. Explain common failure and trouble paths, including when staff help is required.
7. Hand the prepared visitor to a stable direct Discord invitation and identify the first registration action.

The website teaches task walkthroughs, not a command catalog. A walkthrough explains what the player is trying to achieve, where it happens, the important state transitions, and the expected result. These explanations are website content; they do not define or verify the exact buttons, forms, commands, responses, or behavior of the external operational interface.

The public journey does not feature the tutorial Discord server. The handbook must stand on its own.

---

## 4. Information Architecture

The public site map, page-family responsibilities, global navigation, and conceptual public route families are defined in `docs/UX-dbd-website-structure.md`. That refinement is the source of truth for externally observable website structure; this document retains the website's content and experience requirements.

The site has two complementary visitor paths: a newcomer journey organized around understanding and starting to play, and a reference path for regulations, workflow guidance, policies, and troubleshooting.

### 4.1 Regulation Publication

The regulation library distinguishes:

- **Active**: currently playable through Discord.
- **Upcoming**: publicly announced but not queueable.
- **Archived**: no longer playable, retained at stable URLs for historical reference.

Status must be prominent wherever regulations are presented. Upcoming or archived content must never look actionable. An upcoming publication may explain the format and announced scope, but unsettled content must be labeled provisional and must not appear as an effective rule.

At launch, DBD 1v4 quartet ranked is active and DBD 1v1 symmetric ranked is upcoming.

Each active regulation publication is a complete match reference containing:

- Status, public version, effective date, and change history.
- Purpose and concise format summary.
- Eligibility and queue mode.
- Participant, team, role, and group structure.
- Required declarations and pre-match preparation.
- Killer, map, perk, add-on, item, and offering pools or restrictions where applicable.
- Match setup, procedure, time limits, and side or map selection where applicable.
- Win, loss, draw, remake, and disconnect conditions.
- Result facts players must report and how approval works.
- Whether ratings apply and which player-facing dimensions are affected.
- Regulation-specific trouble handling and links to shared policies.

Shared conduct, dispute, privacy, and service-flow policies remain in their dedicated pages and are linked rather than copied into every regulation.

### 4.2 Ratings Publication

The website explains the player-facing rating model:

- Which regulations are rated or unrated.
- Which rating dimensions players can accumulate.
- Which accepted outcomes affect ratings.
- How ratings influence matchmaking at a conceptual level.
- Why service ratings are separate from official DBD ratings.

It does not publish formulas, algorithm parameters, initialization values, plug-in behavior, or internal composite scores.

### 4.3 Policy Publication

Normative player-facing policies cover:

- Eligibility and participation requirements.
- Conduct and fair-play expectations.
- Regulation violations.
- Disconnect, remake, and match-not-played handling.
- Result reporting and correction expectations.
- Disputes, evidence preservation, and staff escalation.
- Possible remedies and consequences.
- Privacy and public-data treatment.

Policies publish predictable categories, expected remedies, and possible consequences. Staff retain discretion over evidence, context, and final sanctions. The website links to the external Discord destination used for case handling.

### 4.4 Guidance, Notices, And Identity

Task guidance explains the player's goal, relevant states, steps, expected outcome, and common failure paths without becoming a command catalogue. Help provides searchable FAQ and troubleshooting, explains the correct player action, and links to Discord support when staff involvement is needed.

Notices contain only essential maintenance notices, regulation availability, and rule or policy changes. The site has no general blog, community news publication, or live health dashboard.

Service identity content explains the unofficial status and separation from official DBD services. Privacy and public-data requirements remain normative policy and are linked rather than duplicated in identity content.

---

## 5. Content Authority And Publication

### 5.1 Publication Authority

The website is authoritative only for the content it publishes. Its publication does not establish the origin, authority, or behavior of any external framework, matchmaking service, deployment, or Discord server, and the website does not claim that published descriptions match external system behavior.

Editors or external processes may supply structured facts as producer-neutral website input. The website does not identify or depend on the producer and has no contract with the system from which the facts may have originated.

The website validates this input only for its declared structure, required fields, and safe presentation. It does not verify provenance, approval, freshness, revision lineage, or agreement with a live service. Missing required input or structurally invalid input fails publication.

For facts represented in structured website input, pages render or reference that input rather than maintaining duplicate values in website prose. Human explanations may contextualize those facts.

### 5.2 Independent Publication

A regulation change is published as a website-owned content release containing the applicable structured input, handbook explanation, public version, effective date, and change history.

Website publication does not require a coordinated framework, backend, deployment, or Discord release.

### 5.3 Versioning

Every normative regulation or policy page includes:

- Lifecycle status.
- Public version.
- Effective date.
- Concise change history.

Informational pages that contain no enforceable policy do not require a policy version.

The website does not record consent. When an external operation requires acknowledgement, the website may explain that expectation and link to the relevant external destination without defining how acknowledgement is recorded.

---

## 6. Language Model

The English edition is the sole authoritative source for all website content, including normative and informational pages. Translations exist only to ease reading and never become authoritative, regardless of their completeness, review state, or version alignment. When English and a translation differ in wording, meaning, or version, English controls.

The site is localization-ready from its first release:

- Locale-aware, stable URLs.
- Navigation and content models that can represent each supported locale.
- Layouts tolerant of text expansion.
- No essential text embedded in images.
- Diagrams with localizable labels and text alternatives.
- Explicit language, translation status, translated-version, and translation-date metadata.

Every translated page must identify itself as a non-authoritative reading aid and link to its authoritative English source. A translation may be identified as complete when it covers the corresponding English content and aligns with its current public version, but completeness describes only translation coverage and freshness; it grants no authority.

An outdated or incomplete translation may remain published only when its status is prominent, its translated version and translation date are shown, and the page links to the current English source. The site must not silently mix languages, treat machine translation as binding policy, or present any translation as a source of truth.

---

## 7. Experience And Visual Requirements

### 7.1 Brand And Tone

Creating the service name and identity is part of the website design assignment. The identity must be original and visibly distinct from official Dead by Daylight branding.

The intended tone is competitive and clear:

- Restrained dark styling.
- Strong information hierarchy and confident typography.
- Limited atmospheric accents that support, rather than obstruct, reference use.
- Clear status, warning, and effective-date treatments.

Use original service illustrations, flow diagrams, icons, and selectively maintained Discord UI examples. Do not make comprehension dependent on in-game screenshots or DBD artwork used in a way that could suggest the site is an official service.

In-game icons that identify specific game entities — perks, addons, items, offerings, killers, and maps — may be used as-is. These icons serve as precise references to well-known game content and do not carry official-service connotation on their own.

### 7.2 Responsive And Accessible Use

Design mobile-first because players commonly open links from Discord on phones. Desktop layouts must still support dense regulation comparison and reference use.

The site targets WCAG 2.2 AA. Designs and delivered pages must support:

- Keyboard operation and visible focus.
- Semantic heading, landmark, list, and table structure.
- Sufficient text and non-text contrast.
- Reduced-motion preferences.
- Accessible names and alternatives for controls, icons, and diagrams.
- Responsive regulation tables or equivalent small-screen presentations.
- Accessible search, language controls, notices, and status labels.

### 7.3 Findability

The site provides:

- Clear global navigation following `docs/UX-dbd-website-structure.md`.
- A persistent hierarchical sidebar that exposes the full site map and expands the Regulations branch down to each regulation's general rule and per-killer balancing pages, so deeply nested references are reachable directly rather than only through successive index pages.
- In-page tables of contents for long regulations and policies.
- Site-wide search across regulations, policies, guides, and FAQ.
- Search results that identify content type and regulation lifecycle status.
- Descriptive stable URLs and page metadata.
- Full public search-engine indexing.

Archived content remains discoverable but must be unmistakably archived in page titles, metadata, and visible presentation.

### 7.4 Privacy And Measurement

The launch site uses no advertising trackers, behavioral profiling, or unnecessary cookies. Any analytics must be aggregate and privacy-friendly. Infrastructure logs are limited to what is needed to operate and protect the site.

---

## 8. Dynamic And Future Content

The launch information architecture may accommodate future dynamic modules, but empty or "coming soon" leaderboard and streaming pages are not published.

Future dynamic content is allowed only when it is:

- Read-only from the website.
- Supplied through an explicit, producer-neutral website input contract.
- Independent of direct matchmaking-service, framework, deployment, or Discord access.
- Limited to data suitable for public presentation under the website's privacy requirements.
- Clear about update timing and data limitations.

Potential examples are a leaderboard or opt-in links to players currently streaming. These examples do not define their input contract or publication policy.

Private queue, readiness, match, account, result-proposal, moderation, and support state remain permanently outside the website boundary.

---

## 9. Discord Handoff

The website may link to Discord at meaningful action or support boundaries. A prepared visitor reaches the external server through a stable direct invitation and receives enough website guidance to identify the expected first action.

These links are outbound handoffs only. The website does not require Discord to reproduce, summarize, link back to, or synchronize with website content, and it does not depend on Discord content or structure to provide a complete public handbook.

---

## 10. Acceptance Criteria

The website experience is complete when:

- A first-time visitor can explain the service, compare active regulations, understand the normal player journey, and reach Discord prepared to register.
- A player can find the published regulation or policy and determine its status, version, and effective date.
- Active, upcoming, and archived content cannot be mistaken for one another.
- Facts represented in structured website input are rendered from that input rather than duplicated in website prose.
- Broken internal links, missing or structurally invalid required input, invalid lifecycle metadata, or incomplete normative metadata fail publication validation.
- Every translated page is visibly identified as non-authoritative and links to its authoritative English source.
- Translation completeness indicates only coverage and freshness and never implies equal authority with English.
- An outdated or incomplete translation remains available only with prominent status, translated-version and translation-date metadata, and a link to the current English source.
- No public page exposes or mutates private matchmaking, account, support, or moderation state.
- The website makes no direct call to the matchmaking service, framework, deployment, or Discord and imposes no behavior or release requirement on them.
- Website input validation does not claim to verify provenance, approval, freshness, revision lineage, or agreement with a live service.
- Search identifies content type and lifecycle status and does not present archived rules as current.
- Navigation, search, regulation data, diagrams, notices, and language controls pass mobile, keyboard, contrast, and screen-reader review against WCAG 2.2 AA.
- Discord links function as external handoffs without requiring reciprocal content or synchronization.

---

## 11. Related Reading

The authoritative companion refinement for the website's externally observable structure is:

| Topic | Source |
|---|---|
| Public site map, navigation, and route families | `docs/UX-dbd-website-structure.md` |

The following documents provide non-normative background for website authors. They are not sources of truth for this website contract, and the website does not depend on them or require them to conform to this document.

| Topic | Source |
|---|---|
| Player and staff operation concepts | `docs/UX-matchmaking-service.md` |
| Discord server locations and player journeys | `docs/discord-ui/UX-discord-server.md` |
| Discord command and button examples | `docs/discord-ui/UX-discord-bot-commands.md` |
| Framework architecture background | `docs/SLA-matchmaking-service.md` |
| DBD regulation data example | `apps/dbd/catalog/regulation.yaml` |
| DBD result-data example | `apps/dbd/catalog/result_schema.yaml` |
| DBD rating-data example | `apps/dbd/catalog/rating.yaml` |
