---
version: "0.1"
doc_type: "UX refinement"
scope:
  in_scope:
    - public-site-map
    - page-family-responsibilities
    - global-navigation
    - conceptual-public-route-families
  out_of_scope:
    - website-purpose-and-content-obligations: "Source of truth is docs/UX-dbd-website.md"
    - exact-page-layout-and-copy: "Website design-owned"
    - technical-site-implementation: "Downstream implementation concern"
    - deployment-topology: "Outside the user-visible website structure"
  cross_reference_allowed:
    - UX
---

# Dead by Daylight Deployment Website Structure

> Defines the public website's user-visible page hierarchy, navigation, and conceptual route families.
>
> `docs/UX-dbd-website.md` remains authoritative for the website's purpose, content obligations, lifecycle rules, publication model, accessibility requirements, and external-system boundary.

---

## 1. Experience Shape

The site supports two complementary visitor paths:

- A newcomer path that prepares a player to choose a regulation and join Discord.
- A reference path that helps active players find exact regulations, workflow guidance, policies, and troubleshooting.

The structure below describes destinations and relationships visible to visitors. It does not prescribe layouts, components, templates, file organization, framework choices, or deployment structure.

---

## 2. Site Map

### 2.1 Home

Home introduces the service, distinguishes it from official Dead by Daylight matchmaking, starts the newcomer journey, links to active regulations, and surfaces important current notices.

### 2.2 Start Playing

Start Playing is a short, ordered preparation journey:

- **Start Playing**: summarizes the preparation steps and normal match lifecycle.
- **Check Requirements**: explains eligibility, prerequisites, and conduct expectations before joining.
- **Choose a Regulation**: compares active regulations using consistent player-relevant attributes and links to complete regulation references.
- **Join Discord**: explains the external handoff and identifies the first registration action.

### 2.3 Regulations

Regulations contains:

- One regulation index grouped or filtered by **Active**, **Upcoming**, and **Archived** status.
- One stable detail page for each published regulation.

Status is visible on the index, regulation pages, and search results. Upcoming and archived regulations never appear actionable. Regulation pages link to shared policies instead of repeating them.

### 2.4 Handbook

Handbook contains durable guidance and normative player policies:

- **How Matchmaking Works**: overview of the player journey and links to its task guides.
- **Player Profile**: registration and profile-management guidance.
- **Groups**: group creation, consent, and reuse guidance.
- **Matchmaking and Readiness**: requesting, inspecting, cancelling, timing out, and responding Ready or Leave.
- **Results**: proposing, approving, correcting, and receiving an accepted outcome and rating status.
- **Ratings**: one conceptual guide to rated regulations, rating dimensions, rating-affecting outcomes, matchmaking influence, and separation from official DBD ratings.
- **Player Policies**: index of all normative policy pages.
- **Participation and Conduct**: eligibility, participation, fair play, violations, remedies, and possible consequences.
- **Match Problems and Remakes**: leaving, not-played reports, remakes, restarts, disconnects, and abandonment handling.
- **Results and Disputes**: reporting, corrections, evidence preservation, disputes, and staff escalation.
- **Privacy and Public Data**: the sole canonical page for player-facing privacy and public-data policy.

### 2.5 Help

Help contains action-oriented answers and recovery guidance:

- **Help**: overview that routes visitors by problem type.
- **FAQ**: searchable answers to recurring questions.
- **Account and Group Troubleshooting**: registration, profile, eligibility, and group problems.
- **Queue and Readiness Troubleshooting**: request, cancellation, timeout, match-found, and readiness problems.
- **Result and Dispute Troubleshooting**: result-input, approval, correction, interruption, and escalation problems.

Troubleshooting pages explain the player's next action and link to Discord support when staff judgment is required.

### 2.6 Notices

Notices contains one index and one stable detail page per essential maintenance, regulation-availability, or rule-and-policy notice. It is not a general blog, community news area, or live health dashboard.

### 2.7 About This Service

About This Service is a footer-linked page explaining the service identity, unofficial status, custom-game scope, and relationship to official DBD services and Discord. It links to **Privacy and Public Data** rather than repeating privacy rules.

### 2.8 Search Results

Search Results covers regulations, policies, guides, and FAQ. Every result identifies its content type; regulation results also identify lifecycle status.

---

## 3. Navigation

Primary navigation contains:

- Home
- Start Playing
- Regulations
- Handbook
- Help

Search, language selection, and **Join Discord** are globally available. Notices and About This Service are utility or footer destinations. Contextual links may also hand visitors to Discord from preparation, support, and escalation boundaries.

A persistent global **sidebar** provides hierarchical navigation across the whole site map. It lists every primary section and expands the Regulations branch all the way down — each published regulation, its general rule, and each per-killer balancing page — so a deep reference such as a specific killer's balancing under a given regulation is reachable in one step rather than through the regulation index, the regulation page, and the balancing umbrella in turn. The Regulations branch is derived from published regulation and balancing content, so it stays in step with what exists without separate upkeep. The sidebar marks the current page and opens the branch that contains it. On small screens it collapses into a toggleable drawer; on wide screens it is a persistent column. It complements the primary header navigation rather than replacing it, and non-active regulations remain visibly non-actionable in it as everywhere else.

Long regulations and policies provide in-page navigation. Cross-links connect onboarding summaries and troubleshooting answers to the authoritative regulation, guide, or policy rather than duplicating it.

---

## 4. Conceptual Route Families

Every public destination has a stable, locale-aware URL. The externally observable route model supports:

- A locale-qualified route for each static page in the site map.
- A regulation index and a stable regulation-detail route keyed by public regulation identity.
- A policy index and stable policy-detail routes.
- A notice index and stable notice-detail routes.
- A search route whose results preserve content type and regulation status.

Exact slugs and framework-specific routing syntax are downstream design decisions. Lifecycle changes do not replace a regulation's stable URL.

When a page is unavailable in the selected language, the site shows an explicit unavailable-in-this-language state and offers a clearly labeled link to the authoritative English page. It does not silently open English content or mix languages within the page.

---

## 5. Publication Boundary

Only destinations with defined, publishable content appear in navigation or the site map. Leaderboards, streaming pages, and other future read-only modules are added only after their publication responsibilities and input contracts are defined; no empty or coming-soon destination is published.

This structure creates no authenticated account, matchmaking, queue, result, moderation, or support destination on the website. Those operations remain external handoffs as defined by `docs/UX-dbd-website.md`.
