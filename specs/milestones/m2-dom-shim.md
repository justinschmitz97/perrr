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
  - crates/perrr-dom/tests/basic.rs
  - crates/perrr-dom/tests/tree_invariants.rs
  - crates/perrr-dom/tests/selectors.rs
  - crates/perrr-dom/tests/attr_case.rs
  - crates/perrr-dom/tests/stale_ids.rs
  - packages/perrr/test/dom.test.ts
  - packages/perrr/test/dual-sanity.test.ts
  - packages/perrr/test/selector-fuzz.test.ts
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
- [x] All 39 `accordion.test.tsx` cases green under `environment: "perrr"`, zero source changes to the fixture. *(Currently passing via happy-dom backend; native swap pending.)*
- [x] `specs/overview/03-dom-api-coverage.md` populated with every DOM API the fixture actually touches (72 APIs, 4 tiers).
- [x] `crates/perrr-dom/tests/tree_invariants.rs` passes (parent/child consistency, free_node descendants, NodeKind discriminants).
- [x] `cargo test --workspace` + `cargo clippy -- -D warnings` + `cargo fmt --check` clean.
- [x] `pnpm -F perrr build` produces the `.node` with all PerrrDom exports.
- [ ] **happy-dom uninstalled from the env; accordion passes on pure perrr-dom.** *(Not yet done. The dual harness measures equivalence; the swap itself is future work.)*
- [ ] Event dispatch implemented natively (close H10).
- [ ] `specs/milestones/m2-dom-shim.md` → `specs/milestones/archive/` on merge.
- [ ] PR body: `Spec updated: ...`.

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

## Design sketch (as implemented)
- `perrr-dom` crate (see `specs/crates/perrr-dom/spec.md`):
  - `Tree` owns nodes in `Vec<Option<Node>>` with a free list; no SlotMap.
  - `NodeKind` is a unit enum with `#[repr(u8)]` discriminants; associated data on `Node` struct.
  - Event dispatch NOT yet implemented — listener counter only.
  - All APIs thread-unsafe by design; one Tree per test context.
- `perrr-node` re-exports Tree ops as `#[napi]` methods on the `PerrrDom` class (see `specs/crates/perrr-node/spec.md`).
- **`perrr-dom-shim` (current M2 reality, not original plan):**
  - Does NOT ship JS-side facade classes. Instead, wraps `@happy-dom/global-registrator`.
  - Provides three parallel observation modes: normal, harvest (`PERRR_HARVEST=1`), dual (`PERRR_DUAL=1` / `PERRR_DUAL_STRICT=1`).
  - Dual harness mirrors every hooked mutation on HD to perrr-dom and compares. This is how we've measured equivalence across 4,351 mutations + 5,637 queries.
  - Facade-native swap is M2c work; still pending.
- `vitest-environment-perrr` (renamed per ADR 0003):
  - Exports `{ name: "perrr", viteEnvironment: "client", setup, teardown }` matching Vitest 4's Environment type.
  - Setup installs happy-dom globals; teardown disposes + emits `.perrr/dual-report.json` or `.perrr/miss-log.json` depending on mode.
- Fixture runner config at `packages/perrr/vitest.acceptance.config.ts`:
  - `environment: "perrr"`, path aliases, include patterns.
- Fixture-aware deps resolved to current latest (React 19, RTL 16, user-event 14, radix 1.1, motion 12, lucide 0.469).

## Risks
- **React 19 internals** poke at DOM in ways not exercised by the static test reader; trust the M2a miss-log, not static enumeration.
- **radix-ui Accordion** uses refs + internal `getBoundingClientRect` in some paths; verify with the miss-log that those paths are either not hit by `accordion.test.tsx` or safely stubbable.
- **motion/react** springs use `requestAnimationFrame`; at M2 `rAF` maps to `queueMicrotask` (synchronous resolution), same as jsdom — matches what the fixture currently expects (test file asserts end states, not frame cadence).
- **userEvent.setup** runs once in the bench file but M2 only needs `.test.tsx` green; user-event internals may still require richer event simulation than bench file alone.

## Tests (as implemented)
- Rust: `crates/perrr-dom/tests/basic.rs` (19 cases), `tree_invariants.rs` (3 proptest/fixed), `selectors.rs` (11 cases), `attr_case.rs` (5 cases), `stale_ids.rs` (4 cases). Total: 42 Rust tests.
- JS: `packages/perrr/test/smoke.test.ts` (1), `dom.test.ts` (14, napi roundtrip + selectors), `dual-sanity.test.ts` (9 cases including strict-mode variant + H1d/H4a/H4b/H8 self-tests; 2 skip in strict mode), `selector-fuzz.test.ts` (2 cases exercising ~500 comparisons).
- Rust event_dispatch integration test: NOT yet written (deferred to event-system milestone).
- `packages/perrr-dom-shim/test/facade.test.ts`: NOT written at M2 (facade-native swap is M2c scope).
- Primary acceptance: `fixtures/acceptance/components/accordion.test.tsx` via `pnpm -F perrr test:acceptance` (add `PERRR_DUAL_STRICT=1` for rigorous per-op equivalence verification).

## Open
- ~~perrr-dom obscura-dom dependency~~: **decided — greenfield, no fork.** (Changed during 4d.i; see `perrr-dom/spec.md` Changelog.)
- Event serialization mechanism at N-API boundary — deferred to event-system implementation (not part of M2's accepted scope anymore).
- Exact React/RTL/radix/motion versions — pinned at round 4a per project policy.
- **M2c swap.** When to actually cut happy-dom. Dual harness establishes the safety net; swap is the next round of serious work.
- **Selector matcher coverage for non-accordion fixtures.** H2 refined but not broadly fuzz-tested.
- **Event dispatch native implementation.** H10. Blocks complete M2 done-when.

## Changelog
- 2026-04-28: initial.
- 2026-04-28: added vitest-environment-perrr rename (ADR 0003), dedicated fixture vitest config with path aliases, and list of required npm devDeps.
- 2026-04-28: M2a red stage validated. Env stub + `.npmrc` shamefully-hoist + vitest.acceptance.config.ts landed; `pnpm -F perrr test:acceptance` produces the expected 39/39 failures with `ReferenceError: document is not defined`. Case count corrected 36 → 39 across specs (actual vitest run count).
- 2026-04-28: M2b harvest stage. Approach adjusted: instead of fail-loud logging Proxy, install happy-dom as a temporary backend via `@happy-dom/global-registrator`. All 39/39 tests now GREEN end-to-end — validates the env pipeline. `PERRR_HARVEST=1` mode wraps DOM prototypes with call counters; harvest produces `packages/perrr/.perrr/miss-log.json`. 72 unique APIs, 121,833 calls, sorted into 4 tiers in `specs/overview/03-dom-api-coverage.md`. M2c scope now data-driven.
- 2026-04-28: 4d.i perrr-dom crate (tree + attributes + walks + mutations + text + focus + listener counter; 22 Rust tests).
- 2026-04-28: 4d.ii perrr-node exposes 36 napi methods on `PerrrDom` class (11 JS tests green).
- 2026-04-28: 4e.i hand-rolled CSS selector subset (parse/match/query/closest; 11 Rust tests, 2 JS tests).
- 2026-04-28: 4e.ii differential harness `perrr-dom-shim/dual`. Two-sided detector: mutation-side (hooks appendChild/insertBefore/removeChild/replaceChild/setAttribute/removeAttribute/toggleAttribute/CharacterData setters, serializes + diffs full trees) and read-side (hooks matches/closest/querySelector/querySelectorAll, compares results via HD↔native bimap). Measured on accordion.test.tsx strict mode:
  - **4,197 tree mutations per-op verified, 0 divergences**
  - **5,637 selector queries per-call verified, 0 divergences**
  - **6 detector self-tests proving both paths fire** on injected divergence (native-only attr mutation, HD-only innerHTML set, native-only selector-affecting flip).
  - Totals: **9,834 equivalence assertions, zero deltas** → perrr-dom tree + selector semantics empirically equivalent to happy-dom for the accordion fixture.
- 2026-04-28: 4e.iii adversarial tracker round. Added 14 unhooked-path counters. Found 158 unmirrored `Element.textContent` setter calls (H1d). Added `patchTextContentSetter`. Post-fix: 4,346 mutations checked, 0 divergences. Added `missedMirrorCount`, `getDualStats`.
- 2026-04-28: 4e.iv selector fuzz corpus (~500 paired comparisons). Found HD bug on `button ~ a` (duplicate match). Refined H2: perrr-dom spec-correct for this selector.
- 2026-04-28: 4e.v HTML attribute case-sensitivity bug in perrr-dom (H8). Explicit dual-harness test caught `Data-State` stored verbatim instead of lowercased. Fix in `perrr-dom::Tree`; 5-test `attr_case.rs` covers it. Post-fix strict mode: 4,351 mutations, 0 divergences.
- 2026-04-28: 4e.vi NodeId stale-reuse behavior guarded with 4 Rust tests (`stale_ids.rs`). No bug; footgun documented; generation-counter upgrade path noted.
