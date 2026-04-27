---
title: perrr v0.1 TDD (approved snapshot)
kind: overview
status: approved
related:
  - specs/overview/01-glossary.md
  - specs/overview/02-metrics.md
  - specs/decisions/0001-product-is-a-vitest-environment.md
  - specs/decisions/0002-native-via-napi-rs.md
  - specs/milestones/m1-workspace-skeleton.md
last-reviewed: 2026-04-27
---

## Purpose
- Frozen snapshot of the v0.1 plan approved 2026-04-27.
- Operational truth evolves in `specs/{features,crates,packages,milestones}/`.

## Objective
- Vitest environment running existing `.test.tsx` / `.bench.tsx` unmodified.
- Native-backed DOM + real CSS cascade + real layout + virtual 120 Hz frame scheduler.
- Unblock metrics jsdom-limited in `fixtures/acceptance/accordion.bench.tsx`.

## v0.1 acceptance
- A1: `accordion.test.tsx` (36 cases) green under `environment: "perrr"`, zero source changes.
- A2: `accordion.bench.tsx` completes all 22 suites; reconciliation-bound suites within ±15% of jsdom; animation-bound suites CV<10% across 5 runs.
- A3: CLS assertion `expect(cls).toBeLessThan(0.1)` fails on layout-shift fixture, passes on reserved-height fixture.
- A4: `perrr-node` cold-starts <50 ms on win/mac/linux × x64/arm64.
- A5: `PERRR_DETERMINISTIC=1` → byte-identical bench output across 3 runs.

## Non-goals (v0.1)
- Not a browser. No navigation, network, cross-origin, iframes, history.
- No raster, GPU, glyphs. Paint = display list + dirty rects.
- No Safari/Firefox parity. Chrome-metric definitions, not numeric match.
- No Shadow DOM beyond what RTL touches.
- No `@container`, `@scope`, view-transitions, anchor positioning.
- No Obscura CDP. Obscura reused for html5ever-backed DOM only.

## Architecture
- Rust workspace `crates/` + pnpm workspace `packages/`.
- `perrr-node` = single N-API addon; in-process; handle-based (u32 `NodeId`).
- Prebuilt binaries via `napi-rs` + `optionalDependencies` per `{os, arch, libc}`.

### Crates
| crate | role |
|---|---|
| perrr-dom | mutable DOM tree; handle IDs; event target |
| perrr-style | CSS parse (lightningcss) + cascade + computed style |
| perrr-layout | taffy wrapper; block/flex/grid; rect writeback |
| perrr-paint | display list; dirty-rect tracker; no raster |
| perrr-scheduler | virtual clock; rAF queue; frame tick; LoAF detector |
| perrr-perf | PerformanceTimeline entries + PerformanceObserver dispatch |
| perrr-thrash | layout-read-after-write detector |
| perrr-node | napi-rs bindings; single `.node` |

### Packages
| package | role |
|---|---|
| perrr | public npm facade + prebuilt binary install |
| vitest-environment-perrr | Vitest environment export (renamed from `perrr-vitest` per ADR 0003) |
| perrr-dom-shim | JS classes (window, document, HTMLElement …) over `NodeId` |

## Tech
- DOM: `html5ever` + fork of `obscura-dom`.
- CSS parse: `lightningcss`.
- Layout: `taffy`.
- Bindings: `napi-rs`.
- Cascade, paint, scheduler, perf: custom.

## Metrics
- Defined in `specs/overview/02-metrics.md`.
- Native v0.1: FCP, LCP, CLS, INP, LoAF, longtask, paint regions, thrash, listeners, nodes, heap, main-thread breakdown.
- Omitted v0.1: TTFB (no network).

## Milestones
| id | scope | weeks | spec |
|---|---|---|---|
| M1 | workspace + napi-rs skeleton | 1.0 | `specs/milestones/m1-workspace-skeleton.md` |
| M2 | DOM shim, no style/layout | 2.0 | TBD |
| M3 | style cascade | 1.5 | TBD |
| M4 | layout via taffy | 2.0 | TBD |
| M5 | virtual frame scheduler | 1.0 | TBD |
| M6 | paint invalidation + display list | 1.0 | TBD |
| M7 | PerformanceObserver | 1.5 | TBD |
| M8 | thrash + counters | 0.5 | TBD |
| M9 | Vitest environment + facade | 0.5 | TBD |
| M10 | hardening, docs, publish | 1.0 | TBD |
| — | total (solo) | ~12 | — |

## Top risks
- R1 DOM coverage tail (RTL + React 19 + radix + motion). Mitigate: log-every-miss proxy in M2; treat miss list as M2 done-when.
- R2 Layout parity vs Chrome (taffy simpler than Blink). Mitigate: scope to accordion.bench; fail-loud on unsupported layouts.
- R3 motion/react timing (springs rely on `performance.now` monotonicity). Mitigate: M5 direct spring test.
- R4 Tailwind volume (~50 classes/element). Mitigate: criterion cascade benchmark in M3; rule-indexing if >5 ms/mount.
- R5 Windows builds (napi-rs + MSVC). Mitigate: CI matrix includes windows-latest in M1.
- R6 Heap noise (process-wide stat). Mitigate: delta with `--expose-gc`; document non-assertable.
- R7 N-API ABI stability. Mitigate: pin napi-rs; CI verifies binary↔JS compat.

## Non-functional
- Startup: addon load <50 ms; first render <20 ms.
- Throughput: 20-item accordion mount ≤10 ms wall-clock (target 5 ms; jsdom ~30 ms).
- Per-iteration framework overhead <200 µs.
- Determinism: byte-identical with `PERRR_DETERMINISTIC=1`.
- Memory: 1000 mount/unmount cycles → RSS growth <10 MB after manual GC.
- Cold install: prebuilt only; no Rust toolchain at install.
- Node: 20 LTS + 22. No Node 18.

## Changelog
- 2026-04-27: approved snapshot.
- 2026-04-28: renamed package `perrr-vitest` → `vitest-environment-perrr` to match Vitest 4's environment resolution convention (see ADR 0003).
