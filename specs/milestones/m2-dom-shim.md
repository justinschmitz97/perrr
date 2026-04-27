---
title: m2 dom shim
kind: milestone
status: approved
related:
  - specs/overview/00-tdd.md
  - specs/overview/03-dom-api-coverage.md
  - specs/overview/04-fixtures.md
  - specs/crates/perrr-dom/spec.md
  - specs/crates/perrr-node/spec.md
  - specs/packages/perrr-dom-shim/spec.md
tests:
  - fixtures/acceptance/components/accordion.test.tsx
  - crates/perrr-dom/tests/tree_invariants.rs
  - packages/perrr-dom-shim/test/facade.test.ts
last-reviewed: 2026-04-28
---

## Purpose
- Stand up a native-backed DOM sufficient to run `accordion.test.tsx` (39 cases) green under a perrr-powered Vitest environment.
- No style, no layout, no paint. Behavior-only DOM.
- Load-bearing milestone: establishes the handle-based boundary, the JS facade pattern, and the Vitest env bootstrap that every later milestone rides on.

## Red test
- `pnpm -F perrr test:acceptance` (new script) runs `fixtures/acceptance/components/accordion.test.tsx` via vitest with `environment: "perrr"`.
- Expected failure before implementation: `ReferenceError: document is not defined` OR `TypeError: document.createElement is not a function`.

## Done-when
- All 39 `accordion.test.tsx` cases green under `environment: "perrr"`, zero source changes to the fixture.
- `specs/overview/03-dom-api-coverage.md` populated with every DOM API the fixture actually touches; each marked `supported` or `stubbed`.
- `crates/perrr-dom/tests/tree_invariants.rs` passes: parent/child consistency, NodeId stability, op-buffer flush semantics (`proptest`).
- `cargo test --workspace` + `cargo clippy -- -D warnings` + `cargo fmt --check` clean.
- `pnpm -F perrr build` produces updated `.node` with new exports.
- `specs/milestones/m2-dom-shim.md` → `specs/milestones/archive/` on merge.
- PR body: `Spec updated: specs/milestones/m2-dom-shim.md, specs/crates/perrr-dom/spec.md, specs/packages/perrr-dom-shim/spec.md, specs/overview/03-dom-api-coverage.md`.

## Approach (four sub-phases)

### M2a — Logging proxy (1–2 d)
- `perrr-dom-shim` exposes `window`, `document`, `HTMLElement`, `Element`, `Node`, `Text`, `Comment`, `Event`, `EventTarget` as thin JS classes backed by a single global `Proxy` that:
  - delegates known methods/props to a stub DOM (in-memory JS tree, not yet perrr-dom),
  - logs every unknown method/property access to a per-test buffer,
  - throws `perrr: unimplemented <API>` for unknown accesses after a configurable warmup.
- Minimal `perrr-vitest` environment (name: `perrr`) that installs these globals in `setup`, tears them down in `teardown`, resets between tests.
- Red run: `vitest run accordion.test.tsx` produces a miss-log (captured to `perrr-dev-miss-log.json`).

### M2b — Harvest coverage matrix (0.5 d)
- Normalize the miss-log into `specs/overview/03-dom-api-coverage.md`.
- Each row: `API surface` | `caller (React/RTL/radix/motion/test)` | `required-for-green` | `plan`.
- Output is source-of-truth for M2c scope.

### M2c — Native implementation (5–8 d)
- For each miss-list entry marked `required-for-green`:
  - Add op to `perrr-dom` (Rust), export via `perrr-node` (`#[napi]`).
  - Back the facade method in `perrr-dom-shim`.
  - Unit test in `crates/perrr-dom/tests/*.rs` + optional facade test.
- Focus areas expected (from static analysis of fixture):
  - Tree ops: `createElement`, `createTextNode`, `appendChild`, `insertBefore`, `removeChild`, `replaceChild`, `cloneNode`.
  - Attribute ops: `getAttribute`, `setAttribute`, `removeAttribute`, `hasAttribute`, `attributes` collection.
  - Query ops: `getElementById`, `querySelector`, `querySelectorAll`, `getElementsByTagName`.
  - Text: `textContent`, `nodeValue`, `data`.
  - Events: `addEventListener`, `removeEventListener`, `dispatchEvent`, capture/target/bubble, `preventDefault`, `stopPropagation`; synthetic `MouseEvent`, `KeyboardEvent`, `FocusEvent`, `InputEvent`.
  - Focus: `focus()`, `blur()`, `activeElement`, `:focus` matching.
  - aria/dataset: `ariaExpanded`, `dataset` proxy.
  - Classes: `className`, `classList` (add, remove, toggle, contains).
  - Forms: `HTMLButtonElement.disabled`, `HTMLInputElement.value/checked`.
  - Lifecycle hooks React 19 touches: `ownerDocument`, `parentNode`, `isConnected`, microtask + `queueMicrotask`.

### M2d — Green-at-any-cost pass (2–3 d)
- Iterate on miss-log; add ops until `accordion.test.tsx` passes.
- Stubs allowed for APIs RTL/motion touch but don't assert on (e.g. `getBoundingClientRect` returning `{0,0,0,0}` is OK at M2 because layout is M4). Mark in coverage matrix as `stubbed`.
- No `ReferenceError` / `TypeError` leaks to user code; unimplemented returns a typed `perrr: unimplemented` error with location at calls not covered by known-safe stubs.

## Contract
### MUST
- `perrr-dom` exposes a tree rooted at a `DocumentId`; nodes addressable by `u32 NodeId`.
- NodeId stable for the node's lifetime; reused only after explicit free.
- Mutations are atomic at the N-API boundary (no half-applied ops visible).
- Event dispatch follows capture → target → bubble per DOM spec, with `preventDefault` / `stopPropagation` / `stopImmediatePropagation` respected.
- Facade classes (`HTMLElement` etc.) pass `instanceof` checks RTL performs.
- Environment reset between tests is O(1): bulk-free all NodeIds under a context root.

### MUST NOT
- Ship any layout-dependent API that returns non-zero numeric values at M2 (pre-layout stubs only).
- Polyfill DOM behaviors in JS when they can live in Rust (keep facade thin).
- Allow `new HTMLElement()` from user code (match browser behavior).
- Retain any state across test runs beyond explicit `global` setup.

### Invariants
- Parent.children order always reflects Rust-side insertion order.
- `document.documentElement`, `document.head`, `document.body` are stable NodeIds for the test's lifetime.
- Every `addEventListener` is balanced by an internal counter decrement on `removeEventListener` or node free (drives M8 listener metric).

## Non-goals
- CSS parsing, cascade, computed style → M3.
- Any real layout value → M4.
- Frame scheduler, rAF semantics beyond immediate microtask → M5.
- Paint, invalidation → M6.
- `PerformanceObserver` → M7.
- Thrash detector → M8.
- User-configurable options (viewport, frameRateHz, deterministic) → M9.

## Design sketch
- `perrr-dom` crate:
  - `Tree` owns nodes in a `SlotMap<NodeId, Node>`.
  - `Node { parent: Option<NodeId>, children: Vec<NodeId>, kind: NodeKind, attrs, listeners }`.
  - Event dispatch: iterative, allocation-free for the hot path.
  - All APIs thread-unsafe by design (one Tree per V8 isolate); N-API boundary is the serialization point.
- `perrr-node` re-exports each tree op as `#[napi]`.
- `perrr-dom-shim` JS:
  - `class Node`, `class Element extends Node`, `class HTMLElement extends Element`, etc.
  - Each instance holds `{ nodeId: number }` and delegates method calls to `perrr-node`.
  - Static `Document` class; singleton per test context.
- `vitest-environment-perrr` (renamed from `perrr-vitest` per ADR 0003):
  - Exports `{ name: "perrr", transformMode: "web", setup(ctx), teardown(ctx) }` matching Vitest 4 environment contract.
  - `setup` installs globals (document, window, HTMLElement, …); `teardown` resets the tree.
  - Folder rename `packages/perrr-vitest/` → `packages/vitest-environment-perrr/` lands in M2's first commit.
- Dedicated fixture runner config at `packages/perrr/vitest.acceptance.config.ts`:
  - `environment: "perrr"`.
  - `resolve.alias`: `@/lib/*` → `../../fixtures/acceptance/lib/*`, `@/bench/*` → `../../fixtures/acceptance/bench/*`.
  - `include: ["../../fixtures/acceptance/components/**/*.test.tsx"]`.
  - Root `vitest.config.ts` stays on `node` environment for the M1 smoke test.
- New npm devDeps in `packages/perrr` for running the acceptance fixture:
  - `react@^19`, `react-dom@^19` — React 19 per fixture.
  - `@testing-library/react@^16` — RTL for React 19.
  - `@testing-library/user-event@^14` — synthetic events.
  - `radix-ui@latest` — Accordion primitives.
  - `motion@^12` — motion/react.
  - `lucide-react@latest` — ChevronDownIcon.
  - Exact versions resolved at M2a start per project policy (latest stable).

## Risks
- **React 19 internals** poke at DOM in ways not exercised by the static test reader; trust the M2a miss-log, not static enumeration.
- **radix-ui Accordion** uses refs + internal `getBoundingClientRect` in some paths; verify with the miss-log that those paths are either not hit by `accordion.test.tsx` or safely stubbable.
- **motion/react** springs use `requestAnimationFrame`; at M2 `rAF` maps to `queueMicrotask` (synchronous resolution), same as jsdom — matches what the fixture currently expects (test file asserts end states, not frame cadence).
- **userEvent.setup** runs once in the bench file but M2 only needs `.test.tsx` green; user-event internals may still require richer event simulation than bench file alone.

## Tests
- Rust unit tests in `crates/perrr-dom/tests/*.rs` for tree invariants (proptest).
- Rust integration test `crates/perrr-dom/tests/event_dispatch.rs`: capture/target/bubble order on a fixed tree.
- `packages/perrr-dom-shim/test/facade.test.ts`: `instanceof HTMLElement`, `classList.add/remove`, `dispatchEvent` round-trip.
- Primary acceptance: `fixtures/acceptance/components/accordion.test.tsx` via `pnpm -F perrr test:acceptance`.

## Open
- Whether `perrr-dom` should depend on `obscura-dom` as a git dep or fork-copy the tree + tree_sink. Lean: fork-copy at M2 start, drop git coupling; record provenance in `perrr-dom/spec.md`.
- Whether event serialization uses JSON at the boundary or a custom bincode variant. Lean: JSON at M2 (simplicity); optimize in a later perf pass if profiled hot.
- Exact React 19 / RTL / radix / motion versions — pinned at M2a start to current latest.

## Changelog
- 2026-04-28: initial.
- 2026-04-28: added vitest-environment-perrr rename (ADR 0003), dedicated fixture vitest config with path aliases, and list of required npm devDeps.
- 2026-04-28: M2a red stage validated. Env stub + `.npmrc` shamefully-hoist + vitest.acceptance.config.ts landed; `pnpm -F perrr test:acceptance` produces the expected 39/39 failures with `ReferenceError: document is not defined`. Case count corrected 36 → 39 across specs (actual vitest run count).
