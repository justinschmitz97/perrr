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

## Changelog
- 2026-04-27: initial.
