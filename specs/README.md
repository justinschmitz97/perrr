---
title: perrr specs discipline
kind: overview
status: approved
last-reviewed: 2026-04-27
---

## Purpose
- Single source of truth for what perrr does + why.
- LLM-first: bullets, tables, declarative; no prose filler.

## Kinds
| kind | describes | lifetime | path |
|---|---|---|---|
| overview | glossary, metric defs, TDD snapshot | durable | `specs/overview/` |
| crate | one Rust crate: purpose, API, invariants | durable, tracks crate | `specs/crates/<name>/spec.md` |
| package | one npm package: purpose, API, invariants | durable, tracks package | `specs/packages/<name>/spec.md` |
| feature | cross-cutting behavior | durable | `specs/features/<name>.md` |
| decision | ADR: context + decision + why | append-only | `specs/decisions/NNNN-<slug>.md` |
| milestone | one PR: red test + acceptance + done-when | transient; archived on merge | `specs/milestones/mN-<slug>.md` |

## Discipline
- Spec before code. No implementation PR without a spec PR (same commit OK).
- Spec check after code. Each PR body: `Spec updated: <file>` OR `No spec change needed: <reason>`. Empty = reject.
- ADRs are append-only. Change direction → new ADR with `supersedes: [NNNN]`.
- Spec ↔ test mirror:
  - spec frontmatter `tests:` lists enforcing test paths;
  - each test file header-comment names its spec path.
- Mismatch between spec and code = bug. Fix either side; never leave divergent.
- Milestones are transient: spec dies (moves to `archive/`) when merged. Features + crates + packages are durable.

## File template
```
---
title: <name>
kind: crate|package|feature|decision|milestone|overview
status: draft|approved|implemented|superseded
supersedes: []
superseded-by: []
related: []
tests: []
last-reviewed: YYYY-MM-DD
---

## Purpose
- <bullet>

## Contract
### MUST
- <bullet>
### MUST NOT
- <bullet>
### Invariants
- <bullet>

## Non-goals
- <bullet>

## Design
- <bullet>

## Tests
- <path>

## Open
- <question>

## Changelog
- YYYY-MM-DD: <msg>
```

## Status values
- `draft` — authored, not approved.
- `approved` — reviewed; implementation may begin.
- `implemented` — behavior exists; tests green.
- `superseded` — replaced; kept for history.

## Naming
- kebab-case filenames.
- ADRs: `NNNN-<slug>.md`, 4-digit zero-padded, monotonic.
- Milestones: `mN-<slug>.md`; archive to `specs/milestones/archive/` on merge.
- Crates/packages spec file: always `spec.md` inside the named subdir.

## Changelog
- 2026-04-27: initial.
