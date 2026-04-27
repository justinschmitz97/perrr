---
title: acceptance fixtures
kind: overview
status: approved
related:
  - specs/overview/00-tdd.md
  - specs/milestones/m2-dom-shim.md
last-reviewed: 2026-04-28
---

## Purpose
- Pinned copies of real-world `.test.tsx` / `.bench.tsx` files perrr must run.
- Live inside the repo; never referenced by path into external repos at runtime.
- v0.1 golden targets for milestone acceptance.

## Origin
- Source repo: `C:\Projekte\justinschmitz.de`
- Source branch at pin time: `refactor/larger-refactor`
- Repo HEAD at pin time: `57cf12a4f551e54184eb1e24d6a30d9819571e9a` (2026-04-28)

## Files pinned (2026-04-28)
| fixture path | source path | last commit touching file | status at pin |
|---|---|---|---|
| `fixtures/acceptance/components/accordion.tsx` | `components/ui/accordion.tsx` | `c7b0538` | clean at HEAD commit |
| `fixtures/acceptance/components/accordion.test.tsx` | `components/ui/accordion.test.tsx` | `c7b0538` | clean at HEAD commit |
| `fixtures/acceptance/components/accordion.bench.tsx` | `components/ui/accordion.bench.tsx` | `c7b0538` | **dirty**: working-copy modifications uncommitted in source repo |
| `fixtures/acceptance/lib/motion-tokens.ts` | `lib/motion-tokens.ts` | `d3f0dd5` | clean at HEAD commit |
| `fixtures/acceptance/lib/bench-opts.ts` | `lib/bench-opts.ts` | `d3f0dd5` | **dirty**: working-copy modifications uncommitted in source repo |
| `fixtures/acceptance/bench/opts.ts` | `bench/opts.ts` | _(untracked in source)_ | **untracked**: file not yet committed in source repo |

## External deps not pinned (resolved via npm at test time)
| import | package |
|---|---|
| `react`, `react-dom` | `react@19` |
| `@testing-library/react` | transitive from test runner |
| `@testing-library/user-event` | transitive from test runner |
| `vitest` | `vitest@^4` (root devDep) |
| `radix-ui` (Accordion primitives) | `radix-ui@latest` |
| `motion/react` | `motion@latest` |
| `lucide-react` (`ChevronDownIcon`) | `lucide-react@latest` |

## Contract
### MUST
- Fixtures are read-only source targets; do not edit inside `fixtures/acceptance/`.
- Milestone acceptance tests run the pinned files via vitest.
- Refresh workflow documented below; manual copy, never symlink / submodule / HTTP fetch at build time.

### MUST NOT
- Reference `C:\Projekte\justinschmitz.de` from any runtime code.
- Pull the fixture over HTTP or git at test time.
- Patch the fixture to make tests pass — patch perrr instead.

### Invariants
- Every copy records source path + source commit (or "untracked") in this spec.
- When fixture is refreshed, update the table + add a Changelog entry with the new source SHA and date.

## Refresh workflow
1. In source repo: `git rev-parse HEAD`, `git status --short <path>`.
2. Copy file(s) from source into `fixtures/acceptance/**`.
3. Update this spec's "Files pinned" table: source commit, status.
4. Append Changelog entry (date + reason).
5. Run milestone acceptance suite; reconcile failures.

## Known-issue deviations
- `.bench.tsx` references `@/lib/bench-opts` and the component references `@/lib/motion-tokens`. In the fixture copies those imports must resolve to the local `fixtures/acceptance/lib/...` paths. Path aliasing is configured in the M2 vitest config (TBD).

## Tests
- None at M1.
- M2 onwards: `fixtures/acceptance/components/accordion.test.tsx` runs under `environment: "perrr"`.

## Open
- Whether to also pin the 21 other `.bench.tsx` files in `justinschmitz.de` as an extended acceptance suite — defer to v0.2.
- Whether to run fixtures against `jsdom` in CI as a regression baseline — defer to M9.

## Changelog
- 2026-04-28: initial pin. 6 files copied; source HEAD `57cf12a`.
