---
title: perrr-dom-shim
kind: package
status: implemented
related:
  - specs/overview/00-tdd.md
  - specs/overview/03-dom-api-coverage.md
  - specs/overview/05-hypotheses.md
  - specs/milestones/m2-dom-shim.md
  - specs/crates/perrr-dom/spec.md
tests:
  - packages/perrr/test/dual-sanity.test.ts
  - packages/perrr/test/selector-fuzz.test.ts
  - fixtures/acceptance/components/accordion.test.tsx
last-reviewed: 2026-04-28
---

## Purpose
- JS-side integration layer for the perrr Vitest environment.
- **M2 shape (current):** wraps `@happy-dom/global-registrator` for DOM behavior + provides three parallel observation modes: normal (no overhead), harvest (prototype call counters), and **dual** (parallel perrr-dom mirroring + per-op divergence detection).
- **M2c target (future):** replace the happy-dom backend with thin JS facade classes backed by `perrr-node` `NodeId` handles. Until that swap lands, this package's primary value is the dual harness that measures perrr-dom ↔ happy-dom equivalence.

## Contract
### MUST (M2 — happy-dom-backed)
- `installGlobals(options)` registers happy-dom globals on `globalThis` via `@happy-dom/global-registrator` (`window`, `document`, all DOM constructors).
  - Options: `viewport: {width, height}`, `url`, `harvest: boolean` (enables `harvest.js` prototype wrapping).
- `uninstallGlobals()` unregisters + tears down harvest instrumentation.
- `resetDocument()` resets `documentElement.innerHTML` to `<head></head><body></body>`.
- Subpath `perrr-dom-shim/harvest` exposes `installHarvestInstrumentation`, `uninstallHarvestInstrumentation`, `getCallLog`, `clearCallLog`, `summarizeCallLog`.
- Subpath `perrr-dom-shim/dual` exposes `installDualBackend({ strict? })`, `disposeDualBackend`, `verifyDualShapes`, `getDualStats`, `getDivergences`, `clearDivergences`, `serializeHappyDom`, `serializeNative`, `diffSerialized`, `nativeInstance`, `getDualIdOf`.
- Harvest + dual share `globalThis.__perrr_dual_state__` to bridge vitest's env↔test-file module boundary.

### MUST NOT
- Load happy-dom in M2c-and-later production paths (goal: drop the dep).
- Cache state that drifts between happy-dom and perrr-dom when both are active.
- Expose `NodeId` to user code (it's an implementation detail of the dual harness).

### Invariants
- When dual mode is active, every hooked mutation on the HD side has a mirrored call or a counted `missedMirrorCount` increment.
- `verifyDualShapes` throws on any serialization mismatch between HD and perrr-dom; in strict mode the throw happens at the mutation that introduced the divergence.
- Tracker wrappers never mutate state — they only count invocations.
- Restoring after teardown: every prototype method or getter/setter we patched is either restored to its original descriptor OR deleted (if originally inherited), so re-install across worker boundaries is safe.

## Non-goals (M2)
- JS-side DOM classes (deferred to M2c; happy-dom provides them for now).
- CSSOM beyond what happy-dom provides.
- Mirror-side implementation of events (listener counter + dispatch semantics remain happy-dom's; perrr-dom only tracks the counter).
- Chrome-level fidelity on error messages.

## Design (as implemented)
- `src/index.js` — `installGlobals` / `uninstallGlobals` / `resetDocument` via `GlobalRegistrator`. Loads happy-dom + conditionally wires harvest instrumentation.
- `src/harvest.js` — prototype-method wrapper factory. For every method / getter / setter on a configured list of prototypes (`Node`, `Element`, `HTMLElement`, `HTMLButtonElement`/…, `Text`, `Comment`, `DocumentFragment`, `Document`, `EventTarget`, `Event`, `CustomEvent`, `MouseEvent`, `KeyboardEvent`, `PointerEvent`, `FocusEvent`, `InputEvent`), installs a wrapper that increments a call counter. Restored on teardown.
- `src/dual.js` — differential harness. Owns the bimap (`WeakMap<HDNode, NodeId>` + `Map<NodeId, HDNode>`) and a `PerrrDom` instance loaded via `createRequire` (napi-rs artifact is CJS). Patches HD prototypes to mirror mutations into perrr-dom and compare query results.
- JS-side facade classes (`Window`, `Document`, `HTMLElement`, …) **not implemented at M2** — happy-dom provides them. M2c will replace them.

### Shared global state (`globalThis.__perrr_dual_state__`)
- `state: { native: PerrrDom, idOf: WeakMap, nodeOf: Map } | null`
- `divergences: Array<{kind, op, …, ts}>` (structured log)
- `patches: Map<patchId, {proto, key, original}>` (for restore)
- `strict: boolean`
- `opCounter: number` (strict-mode shape-verify count)
- `queryCounter: number` (read-side compare count)
- `missedMirrorCount: number` (bimap lookup misses on hooked mutations)
- `trackerCounts: {[label]: number}` (unhooked-path counters)

### Dual hook surface
**Create:** `Document.createElement`, `createElementNS`, `createTextNode`, `createComment`, `createDocumentFragment`.
**Mutate (tree):** `Node.appendChild`, `insertBefore`, `removeChild`, `replaceChild`.
**Mutate (attrs):** `Element.setAttribute`, `removeAttribute`, `toggleAttribute`.
**Mutate (text):** `CharacterData.data`/`nodeValue` setters, `Element.textContent` setter (added 4e.iii after tracker found 158 unmirrored calls).
**Read-compare:** `Element.matches`, `closest`; `Element.querySelector`/`All`, `Document.querySelector`/`All`, `DocumentFragment.querySelector`/`All`.
**Trackers (count only, no mirror):** `Element.innerHTML`/`outerHTML`/`insertAdjacentHTML`/`insertAdjacentElement`/`insertAdjacentText` setters; `Element.remove`/`before`/`after`/`replaceWith`/`append`/`prepend`/`replaceChildren`; `Node.normalize`; `DOMTokenList.add`/`remove`/`toggle`/`replace`; `HTMLInputElement.value`/`checked` setters. All count=0 on the accordion fixture.

## Integration with `vitest-environment-perrr`
- `vitest-environment-perrr`'s `setup(ctx)` calls `installGlobals({ mode: ctx.config.options.perrr })`.
- `teardown(ctx)` calls `uninstallGlobals()`.
- Between tests: `beforeEach → resetDocument`.
- (Package name per ADR 0003; consumers write `environment: "perrr"`.)

## Tests
- `packages/perrr/test/dual-sanity.test.ts` — 9 self-tests proving the detector actually fires on real divergence:
  - baseline (no divergence)
  - shape divergence via native-only mutation
  - shape divergence via HD-only mutation (innerHTML)
  - op counter advances
  - query counter advances + zero divergence on realistic selectors
  - query detector fires on native-only attribute flip affecting a selector
  - textContent mirror keeps trees in sync (H1d regression guard)
  - H4b: missedMirrorCount increments on bimap miss
  - H4a: HD-throws path leaves both backends consistent
  - (strict-only) strict catches bimap-miss at the mutation that introduces it
- `packages/perrr/test/selector-fuzz.test.ts` — broad selector corpus (~40 selectors × ~10 nodes × 4 query methods) through the dual read-hooks; 0 divergence after carve-out of a documented happy-dom bug (`button ~ a`).
- Acceptance: `fixtures/acceptance/components/accordion.test.tsx` under `environment: "perrr"` + `PERRR_DUAL_STRICT=1` — 4,351 mutations + 5,637 queries compared per-op, 0 divergence.

## Env vars
- `PERRR_DUAL=1` — teardown-only verify. Cheap.
- `PERRR_DUAL_STRICT=1` — per-op verify. Catches divergence at its source.
- `PERRR_HARVEST=1` — prototype call counters. Writes `.perrr/miss-log.json`.
- All three emit `.perrr/dual-report.json` or `.perrr/miss-log.json` for post-mortem.

## Measured outcome (2026-04-28, post-round-4e.vi, strict mode on accordion.test.tsx)
- 4,351 tree-shape mutations verified per-op: **0 divergence**.
- 5,637 selector queries verified per-call: **0 divergence**.
- 0 mirror throws, 0 bimap misses on real code paths, 0 counts on 14 tracker APIs.
- 50/52 acceptance tests green (2 strict-mode-incompatible injection tests skipped).
- 9 detector self-tests all firing correctly on injected divergence.

## Open
- M2c facade-native swap: still pending. Dual harness gives us the safety net; when it's run with the native facade active, any divergence is surfaced.
- Event dispatch parity (H10): events aren't natively implemented; dual harness doesn't verify them yet.
- `activeElement` parity (H9): `focus()`/`blur()` are mirrored but `document.activeElement` is not differentially compared.
- H4c (serializer asymmetry): not demonstrated to be safe; current belief is that preorder + sorted-attr serialization captures every spec-visible difference, but unverified.
- HD-throws-perrr-succeeds case (H4a subset): we validated HD-throws-mirror-doesn't-run, but we haven't found a real HD-only-throws op to exercise the thrown path.

## Changelog
- 2026-04-28: initial draft (M2 planning).
- 2026-04-28: 4b shipped happy-dom backend via `installGlobals/uninstallGlobals/resetDocument`; subpath `perrr-dom-shim/harvest` for call-counter instrumentation.
- 2026-04-28: 4e.ii added `perrr-dom-shim/dual` differential harness. Validated: 4,196 tree mutations across accordion fixture, 0 divergence, detector proven to fire via self-tests.
- 2026-04-28: 4e.ii+ added read-side query hooks (matches / closest / querySelector / querySelectorAll). 5,637 queries verified. Detector self-test for query divergence added.
- 2026-04-28: 4e.iii tracker round. 14 unhooked-mutation counters + `missedMirrorCount`. Found H1d (textContent unmirrored, 158 calls) → added `patchTextContentSetter`. Added `getDualStats` (non-throwing observation). `restoreAll` handles inherited-method descriptors. `skipIf(strictMode)` on injection tests.
- 2026-04-28: 4e.iv selector fuzz corpus (~500 paired comparisons). Found happy-dom bug on `button ~ a` (duplicate results); perrr-dom spec-correct. Documented as a separate test case.
- 2026-04-28: 4e.v — via dual harness H8 test, caught perrr-dom attribute-case-sensitivity bug. Fix landed in perrr-dom; no change to dom-shim itself.
- 2026-04-28: removed obsolete design items referencing JS facade classes (`src/nodes.js`, `src/events.js`, `src/document.js`, `src/window.js`, `src/install.js`, `src/logging-proxy.js`); those are M2c scope. Current file layout: `src/index.js`, `src/harvest.js`, `src/dual.js`.
