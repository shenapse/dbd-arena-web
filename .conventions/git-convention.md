# Git & GitHub Conventions (Minimal v0.0.1 Edition)

> **Purpose**
> This document defines a minimal set of conventions for Git and GitHub usage within this project.
> It focuses on what is essential for delivering `v0.0.1` while allowing incremental enhancement as the project grows.

---

## 1. Commit & PR Conventions

- [convention on commit](git-commit-convention.md)
- [convention on PR](git-pr-template.md)

## 2. Branching Model

### 2.1 Overview

This project uses a lightweight branching model:

#### `main`
- Stable branch
- Always kept releasable
- Releases are tagged from this branch

#### `{branch-type}/{name}`
- Temporary development branches
- Removed after merge

**Examples:**
- `dev/parser-rewrite`
- `refactor/layout-engine`
- `fix/serialization`

### 2.2 Allowed Branch Types

- `dev/` – new features or prototypes
- `refactor/` – structural changes without altering behavior
- `fix/` – bug fixes
- `docs/` – documentation updates
- `test/` – testing-related changes
- `chore/` – maintenance tasks (no runtime impact)
- `exp/` – experimental features or research prototypes

### 2.3 Merge Rules

- Prefer Squash Merge
- Delete feature branches after merge
- Fast-forward merges to main are allowed if the branch contains a single logical commit

## 3. Repository Structure

The top-level project directory MUST contain the following structure:

```bash
/
├── simulation/ # Source code (internal layout may evolve)
├── tests/      # Test code
├── docs/       # Documentation, specs, meta-docs
├── README.md
└── .gitignore
```

**Notes:**
- Internal organization of `simulation/`, `tests/`, `docs/` may change as the project evolves
- CLA, CS, IS, ADR and other design-related documents reside under `docs/`
- CI, workflow, and integration configuration will be added when needed

## 4. Tagging & Release Rules

### 4.1 Versioning

Semantic Versioning (SemVer) is used:

```
vMAJOR.MINOR.PATCH
```

**Examples:** `v0.0.1`, `v0.1.0`, `v1.2.3`

- **MAJOR:** incompatible changes
- **MINOR:** backward-compatible feature additions
- **PATCH:** backward-compatible bug fixes

### 4.2 Release Process

- Releases are cut from `main`
- Tags follow the format `vX.Y.Z`
- Release notes may be written manually on GitHub

## 5. Typical Workflow Example

A representative example of the development workflow:

### 5.1 (Optional) Create an Issue

Document the task and add labels if applicable.

**Example:**
```
#12 Add JSON serialization support
```

### 5.2 Create a Branch

```bash
git checkout -b dev/json-serialization
```

Branch name format: `{branch-type}/{what}`

### 5.3 Implement the Change

- Commit with the defined commit convention
- Keep commits atomic
- Update tests or documentation as necessary

### 5.4 Open a Pull Request

- Title should follow the final squash commit message
- Keep PR size small
- Perform a self-review before merging
- CI must pass (if enabled)

### 5.5 Merge Using Squash Merge

- Use "Squash and Merge"
- Edit the final commit message into the proper commit format
  (e.g., `<type>(<scope>): #<issue> <subject>`)

### 5.6 Tag a Release (When Applicable)

```bash
git tag v0.0.1
git push origin v0.0.1
```

- Optionally create a GitHub Release
- `main` now represents the new stable version

## 6. Future Extensions

This is a minimal specification; further conventions may be added as needed:

- PR conventions
- Issue templates
- CI / lint / format rules
- Branch protection rules
- Contributor guides
- Changelog policy
- GitHub Actions integrations
- Code ownership settings