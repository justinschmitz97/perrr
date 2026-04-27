---
title: metric definitions
kind: overview
status: approved
related:
  - specs/overview/01-glossary.md
last-reviewed: 2026-04-27
---

## Purpose
- Authoritative metric definitions.
- Diverge from Chrome only where noted.

## Metrics
| metric | source | definition | chrome delta |
|---|---|---|---|
| TTFB | — | N/A v0.1 | omitted |
| FCP | paint | first frame with ≥1 text OR non-default-bg rect in display list | same shape |
| LCP | paint | largest content rect over LCP window; window default = until 5 s virtual idle | no image-decode cost; geometry only |
| CLS | layout | Σ per-frame layout-shift scores, session-windowed per spec | same shape |
| INP | input+scheduler | max(input event → next frame boundary) across interactions | main-thread only (no compositor thread) |
| LoAF | scheduler | entry when rAF→paint span > 50 ms virtual | spec-conformant |
| longtask | scheduler | entry when task > 50 ms virtual | spec-conformant |
| layout thrash | thrash detector | count of layout-dirtying reads after writes per frame | perrr-specific |
| paint regions | paint | invalidation rects per frame | perrr-specific |
| heap | v8 | `v8.getHeapStatistics()` delta around iteration | accurate (Node V8) |
| DOM nodes | dom | document-wide count | accurate |
| event listeners | dom | internal add/remove counter | perrr-specific |
| main-thread breakdown | scheduler+paint | wall-clock per phase: scripting / style / layout / paint / system | perrr-specific |

## APIs exposed
- `performance.now()` — virtual clock, ms, sub-µs resolution.
- `performance.mark(name)`, `performance.measure(name, start?, end?)`.
- `performance.getEntriesByType(type)` — typed entry list.
- `PerformanceObserver` entry types: `paint`, `layout-shift`, `event-timing`, `long-animation-frame`, `longtask`, `largest-contentful-paint`, `first-input`.
- `perrr.getMetrics()` returns `{ lcp, cls, inp, fcp, loaf[], longTasks[], heap, nodes, listeners, paintRegions[], thrash, mtBreakdown }`.
- `perrr.resetTimeline()` clears observer buffer + `perrr.getMetrics()` state; does not reset virtual clock.

## Rules
- Virtual clock monotonic; never decreases.
- Entry timestamps = virtual clock at emit.
- Deterministic mode: entries identical across runs for same input + config.
- All durations in milliseconds unless marked.
- Sub-microsecond resolution required for `performance.now`.

## Validation fixtures (v0.1)
- `fixtures/metrics/cls-shift.tsx` — mounts content that pushes sibling; expected CLS > 0.1.
- `fixtures/metrics/cls-reserved.tsx` — same content with reserved height; expected CLS ≈ 0.
- `fixtures/metrics/loaf-heavy.tsx` — rAF callback sleeps > 50 ms virtual; expected 1 LoAF.
- `fixtures/metrics/inp-click.tsx` — click → rerender; expected INP ≈ one frame budget.

## Changelog
- 2026-04-27: initial.
