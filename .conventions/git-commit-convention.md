# Git Commit Convention

This document defines the standard format and writing rules for commit messages in this project. Its purpose is to ensure that commit logs remain readable, consistent, easy to understand, and traceable over time.

## Commit Message Format

```
<type>(<scope>): #<Issue Number> <subject>

<body>

<footer>
```

### Field Descriptions

| Field | Description |
|---|---|
| **type** | A keyword describing the nature of the change. Allowed values: |
| | • `feat` — new feature |
| | • `fix` — bug fix |
| | • `docs` — documentation update |
| | • `style` — non-functional style changes |
| | • `refactor` — code restructuring without behavior changes |
| | • `test` — test-related updates |
| | • `chore` — maintenance tasks (deps, configs, etc.) |
| | • `perf` — performance improvements |
| | • `build` — build system changes |
| | • `ci` — CI configuration updates |
| | • `revert` — revert a previous commit |
| **scope** (optional) | Target component or area, such as auth, db, ui, etc. |
| **Issue Number** (optional but recommended) | Written as `#123`. Ensures traceability to planning or discussion items. |
| **subject** | A short, specific, imperative summary. |
| **body** | Explains what, why, and how in concise paragraphs. May include reasoning, design intent, or alternatives when relevant. |
| **footer** (optional) | Additional issue references, migration notes, or BREAKING CHANGE declarations. |

### Subject Guidelines

**Bad:** "Fixed a bug in the layout"
**Good:** "Fix sidebar layout misalignment"

## Writing Guidance

Commit messages are a shared communication medium. Follow these principles to ensure clarity and long-term maintainability.

### 1. Be consistent
- Follow the defined format for every commit
- Keep language, tone, and structure uniform
- Prefer English for all commit messages

### 2. Be specific
- Avoid vague verbs such as "update", "improve", "fix issue"
- Clearly state what changed and where
- Mention affected components, functions, or files when helpful

### 3. Be simple
- Keep the subject line within ~50–72 characters
- Use concise sentences and avoid unnecessary background story
- Follow the principle "one intent per commit"

### 4. Easy to read
- Use short paragraphs or bullet points in the body
- Insert line breaks to avoid large unstructured blocks of text
- Highlight key points clearly

### 5. Easy to understand
- Avoid unnecessary abbreviations or implicit assumptions
- Explain intent so that readers don't need to open the code to grasp the meaning
- Make sure the purpose of the change is clear to any contributor

### 6. Well-summarized
- The subject must capture the main intent in a single line
- The body should expand on details without becoming verbose
- The footer should link the commit to related issues or breaking changes

### 7. Max Subject Length
- The subject line must not exceed 72 characters.
- If the subject would exceed, rephrase to fit within 72 characters or split the concept into separate commits. The subject should remain a single-line summary.

### 8. Body Wrapping
- Wrap body lines at 80 characters.
- Use blank lines to separate paragraphs.
- For long explanations, prefer bullet points and concise sentences; avoid single, very long lines.

### 9. Breaking Changes Template
- Use a clear, explicit breaking changes description in the body (or footer) to explain what changed, why, and how to migrate.
- Template:
```
BREAKING CHANGE: <short description of the breaking change>
Migration:
- What changed and why
- How to migrate (code changes, config updates, etc.)
- Compatibility notes or caveats
```
- When applicable, reference related issues in the footer (e.g., Related: #123).

### 10. Atomic Commits
- Each commit should have a single logical purpose.
- Do not mix multiple unrelated changes in one commit.
- If you need to implement several independent changes, create separate commits with individual messages that describe each change’s intent.

## ✔ Examples

### Example 1 — Feature
```
feat(auth): #124 Add JWT refresh token rotation

Implement refresh token rotation to improve session security.
Adds a new `refresh_token_version` field to the user model and updates
the token issuance logic accordingly.

BREAKING CHANGE: Existing refresh tokens become invalid.
Related: #120
```

### Example 2 — Bug Fix
```
fix(db): #201 Fix connection leak in Postgres pool manager

Connections were not returned to the pool when an exception occurred
during query execution. Added a `finally` block to ensure release.

This resolves intermittent "too many connections" errors.
```

### Example 3 — Documentation
```
docs(api): #88 Update rate limit section in public API documentation

Clarify the behavior of burst limits and add examples for
client-side retry strategies.
```
