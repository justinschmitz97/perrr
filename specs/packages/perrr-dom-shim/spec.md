---
title: perrr-dom-shim
kind: package
status: draft
related:
  - specs/overview/00-tdd.md
  - specs/overview/03-dom-api-coverage.md
  - specs/milestones/m2-dom-shim.md
  - specs/crates/perrr-dom/spec.md
tests:
  - packages/perrr-dom-shim/test/facade.test.ts
  - packages/perrr-dom-shim/test/logging-proxy.test.ts
last-reviewed: 2026-04-28
---

## Purpose
- JS-side facade that React + RTL see: `window`, `document`, `HTMLElement`, `Element`, `Node`, `Text`, `Comment`, `Event`, `MouseEvent`, `KeyboardEvent`, …
- Each class is a thin wrapper holding `{ nodeId: number }` and delegating to `perrr-node`.
- Passes `instanceof` checks that RTL and React 19 perform against these constructors.

## Contract
### MUST
- Export named constructors that satisfy `instanceof` against real-DOM-code expectations:
  - `Window`, `Document`, `Node`, `Element`, `HTMLElement`, `HTMLButtonElement`, `HTMLInputElement`, `HTMLDivElement`, `HTMLSpanElement`, `HTMLHeadingElement`, `Text`, `Comment`, `DocumentFragment`, `Event`, `CustomEvent`, `MouseEvent`, `KeyboardEvent`, `PointerEvent`, `FocusEvent`, `InputEvent`, `EventTarget`.
- Provide `installGlobals(options)` that assigns `globalThis.window`, `globalThis.document`, all constructors, and primitive stubs (`queueMicrotask` is native; don't shadow).
- Provide `resetDocument()` that bulk-frees all NodeIds and re-initializes to `<html><head></head><body></body></html>`.
- Provide `uninstallGlobals()` that removes everything `installGlobals` added.
- Every method/property access on a facade instance is either:
  - a) backed by a `perrr-node` call,
  - b) a known-safe stub (`getBoundingClientRect → {0,0,0,0}` pre-M4), or
  - c) a fail-loud throw with `perrr: unimplemented <API>` and the call site.
- During M2a development only: a `debugLogMode` option routes (c) to a JSON log instead of throwing, to power the coverage harvest.

### MUST NOT
- Implement DOM behavior that can live in Rust in JS (keep the facade thin).
- Cache mutable state on facade instances that would drift from the Rust tree.
- Expose `NodeId` to user code; it's an implementation detail.
- Allow `new HTMLElement()` / `new Document()` from user code — constructors throw the same `Illegal constructor` error browsers do.

### Invariants
- A facade instance for `NodeId(n)` is identity-stable within one test: `document.body === document.body` always true.
- `instanceof` works both up (`btn instanceof HTMLElement`) and down (`document instanceof Document`).
- Event objects dispatched via `dispatchEvent` reach listeners on both the JS facade and the Rust tree (single source of truth for propagation: Rust).

## Non-goals (v0.1)
- CSSOM (`CSSStyleSheet`, `CSSStyleRule`, …) beyond what the fixture touches.
- Shadow DOM beyond empty-shadow-root stubs.
- `MutationObserver` full spec (M2 stub; real impl only if fixtures demand).
- Typed-array / `Buffer` interop.
- Any attempt at Chrome-level fidelity on error messages.

## Design
- `src/nodes.js` — base `Node` class, `Element` extends `Node`, `HTMLElement` extends `Element`, concrete `HTML{Button,Input,Div,Span,Heading}Element` extend `HTMLElement`.
- `src/events.js` — `Event`, `CustomEvent`, `MouseEvent`, `KeyboardEvent`, `PointerEvent`, `FocusEvent`, `InputEvent`; thin wrappers over a Rust-side event struct.
- `src/document.js` — `Document` singleton per test; exposes `createElement`, `createTextNode`, `querySelector`, etc.; each call translates to a `perrr-node` op.
- `src/window.js` — `Window` with `document`, `location`, `history` (stubs at M2), `requestAnimationFrame` mapped to `queueMicrotask` until M5, `getComputedStyle` stub until M3.
- `src/install.js` — `installGlobals`, `uninstallGlobals`, `resetDocument`, `setLoggingMode`.
- `src/logging-proxy.js` — dev-only Proxy layer used during M2a harvest; disabled in released builds.
- Identity cache: `Map<NodeId, FacadeInstance>` per document; populated on first resolution; cleared by `resetDocument` + `uninstallGlobals`.

## Integration with `vitest-environment-perrr`
- `vitest-environment-perrr`'s `setup(ctx)` calls `installGlobals({ mode: ctx.config.options.perrr })`.
- `teardown(ctx)` calls `uninstallGlobals()`.
- Between tests: `beforeEach → resetDocument`.
- (Package name per ADR 0003; consumers write `environment: "perrr"`.)

## Tests
- `test/facade.test.ts` — `instanceof` checks; identity stability; fail-loud on unimplemented; `classList.add/remove/contains`; `dispatchEvent` → listener invoked. _(Pending: facade-native swap lives in a later round.)_
- `test/logging-proxy.test.ts` — unknown API in logging mode emits structured log entry; in strict mode throws with location.
- `packages/perrr/test/dual-sanity.test.ts` — proves the differential harness (`perrr-dom-shim/dual`) actually detects divergence: 4 cases — baseline matches; native-only mutation fires the detector; HD-only mutation (innerHTML) fires the detector; op counter advances.

## Differential harness (`perrr-dom-shim/dual`)
- Purpose: validate perrr-dom tree semantics match happy-dom's byte-for-byte before cutting happy-dom.
- `installDualBackend({ strict? })` — monkey-patches happy-dom's Document/Element/Node/CharacterData prototypes; every mutation mirrors to a parallel perrr-dom `Tree`. Strict mode verifies full serialization after each op.
- `verifyDualShapes()` — serializes both trees (sorted attrs, stable ordering) and throws on divergence with character-level excerpts.
- `installDualBackend` hooks: `createElement{,NS}`, `createTextNode`, `createComment`, `createDocumentFragment`, `appendChild`, `insertBefore`, `removeChild`, `replaceChild`, `setAttribute`, `removeAttribute`, `toggleAttribute`, `CharacterData.data`/`nodeValue` setters.
- Env vars: `PERRR_DUAL=1` (teardown-only verify), `PERRR_DUAL_STRICT=1` (per-op verify). Both emit `.perrr/dual-report.json`.
- State on `globalThis.__perrr_dual_state__` so it crosses vitest's env↔test-file module boundary.
- Validated on 2026-04-28: accordion.test.tsx runs **4,197 tree-shape mutations + 5,637 selector-query results** verified, zero divergence. Read-side hooks (matches / closest / querySelector{,All}) compare per-call results via the HD↔native bimap; detector self-test proves the read-divergence path fires.

## Open
- Exact prototype-chain shape required by React 19's internals (e.g. whether `Element.prototype.attachInternals` needs to exist). Resolve during M2a miss-log.
- Whether `Window` and `Document` should be ES classes or frozen objects. Lean: classes (cheaper for `instanceof`; consistent with browsers).

## Changelog
- 2026-04-28: initial draft (M2 planning).
- 2026-04-28: 4b shipped happy-dom backend via `installGlobals/uninstallGlobals/resetDocument`; dual-export `perrr-dom-shim/harvest` for call-counter instrumentation.
- 2026-04-28: 4e.ii added `perrr-dom-shim/dual` differential harness. Validated: 4,196 tree mutations across accordion fixture, 0 divergence, detector proven to fire via self-tests.
