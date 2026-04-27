---
title: vitest environment package named `vitest-environment-perrr`
kind: decision
status: approved
supersedes: []
superseded-by: []
related:
  - specs/overview/00-tdd.md
  - specs/milestones/m2-dom-shim.md
  - specs/packages/perrr-dom-shim/spec.md
last-reviewed: 2026-04-28
---

## Context
- TDD §Architecture names the Vitest env package `perrr-vitest`.
- Vitest 4 resolves `environment: "<name>"` to a package literally named `vitest-environment-<name>`.
- Keeping `perrr-vitest` forces users to write `environment: "./node_modules/perrr-vitest/index.js"` — leaks implementation detail into every consumer's config.

## Decision
- Rename the published package `perrr-vitest` → `vitest-environment-perrr`.
- Monorepo folder: `packages/vitest-environment-perrr/`.
- Rename lands in M2 (first milestone that touches the env).
- `packages/perrr-vitest/` folder deleted in the same commit; no backwards compatibility alias.

## Why
- Enables the zero-friction `environment: "perrr"` UX the TDD promises (§Product surface).
- Vitest convention; no custom resolver needed.
- v0.1 is pre-publish; no external consumers to migrate.

## Consequences
- TDD §Architecture table updated (see TDD Changelog entry 2026-04-28).
- All specs referencing `perrr-vitest` updated in the same PR.
- `environment: "perrr"` remains the user-facing contract; the package naming is invisible to users.
- The other npm packages (`perrr`, `perrr-dom-shim`) keep their names — neither needs Vitest-convention resolution.

## Alternatives rejected
- **Keep `perrr-vitest`, require local file path** — ugly config; leaks impl detail.
- **Alias via workspace dependency** — workspace symlinks don't help at publish time.
- **Dual-publish under both names** — supply-chain complexity without benefit.

## Changelog
- 2026-04-28: approved.
