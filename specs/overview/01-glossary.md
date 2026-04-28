---
title: glossary
kind: overview
status: approved
last-reviewed: 2026-04-27
---

## Terms
- **virtual clock** — monotonic counter advanced by scheduler, not wall time. Exposed via `performance.now()`.
- **frame budget** — `1000 / frameRateHz` ms. 8.33 at 120 Hz; 16.67 at 60 Hz.
- **frame boundary** — virtual-clock instant at which rAFs + style + layout + paint run.
- **frame tick** — one scheduler iteration: drain microtasks → fire rAFs → style → layout → paint → advance clock.
- **dirty node** — DOM node with pending style or layout recompute.
- **invalidation region / dirty rect** — union of old-rect ∪ new-rect for nodes whose paint changed in a frame.
- **long animation frame (LoAF)** — frame whose rAF→paint span > 50 ms virtual.
- **long task** — task (microtask drain + rAFs) > 50 ms virtual.
- **thrash** — layout-dirtying read after layout-dirtying write within the same frame.
- **NodeId** — u32 handle for a DOM node; stable for node lifetime; reused after free.
- **handle-based op** — N-API call that takes/returns `NodeId`, never pointer.
- **op buffer** — bump-allocated mutation log flushed per microtask to style/layout/thrash subscribers.
- **facade** — `packages/perrr-dom-shim` JS classes (window, document, HTMLElement…) that delegate to `perrr-node`.
- **fixture** — pinned `.test.tsx` / `.bench.tsx` copy in `fixtures/acceptance/`.
- **deterministic mode** — `PERRR_DETERMINISTIC=1`; virtual clock advances by frame budget regardless of wall-clock cost.
- **realistic mode** — default; virtual clock advances by `max(wall, budget)`.
- **reconciliation-bound** — benchmark whose runtime is dominated by React reconciliation (mount, rerender, unmount).
- **animation-bound** — benchmark whose runtime depends on rAF cadence + spring physics.
- **fail-loud** — unsupported input throws a typed error with location; never silently mis-renders.
- **HD** — abbreviation for happy-dom, used in the dual harness as the reference implementation.
- **bimap** — paired `WeakMap<HDNode, NodeId>` + `Map<NodeId, HDNode>` owned by the dual harness; enables translation between happy-dom node references and perrr-dom NodeIds.
- **dual harness** — `perrr-dom-shim/dual`. Mirrors HD mutations into perrr-dom and compares serialized tree shapes + selector-query results. Primary measurement tool of M2.
- **dual mode** — env var `PERRR_DUAL=1`; verify-on-teardown only.
- **strict dual mode** — env var `PERRR_DUAL_STRICT=1`; verify-after-every-hooked-op.
- **harvest mode** — env var `PERRR_HARVEST=1`; wraps prototype methods with call counters to measure the DOM-API surface a fixture exercises.
- **mirror-throw** — divergence class: perrr-dom raised an error where HD succeeded.
- **read-divergence** — divergence class: HD and perrr-dom produced different results for the same query.
- **read-translation-miss** — divergence class: HD returned a node not present in the bimap.
- **tracker** — a prototype wrapper that counts invocations of an UNHOOKED mutation path; used to discover what a fixture actually exercises before committing to mirror.
- **missed-mirror** — bimap-lookup miss in a hooked mutation path. Counted separately.
- **tier (coverage)** — DOM APIs grouped by observed call count per run in `specs/overview/03-dom-api-coverage.md`: Tier 1 >1k, Tier 2 100-1k, Tier 3 10-100, Tier 4 <10.

## Changelog
- 2026-04-27: initial.
- 2026-04-28: added harness-era terms (HD, bimap, dual harness, dual/strict/harvest modes, divergence classes, tracker, missed-mirror, tier).
