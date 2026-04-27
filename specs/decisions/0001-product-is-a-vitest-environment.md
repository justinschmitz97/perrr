---
title: product is a Vitest environment
kind: decision
status: approved
supersedes: []
superseded-by: []
last-reviewed: 2026-04-27
---

## Context
- Users run `.bench.tsx` today via `vitest bench` under `jsdom`.
- Author-annotated jsdom gaps in benchmark source (`"cannot measure real animation frame budget"`, `"Playwright/CDP required for 120fps validation"`).
- Two product shapes evaluated:
  - **P1** — "Chrome-but-faster". Full render pipeline, numeric parity with Chrome. Scope: Servo-class, years.
  - **P2** — "deterministic virtual compositor". Native DOM + real layout + virtual frame clock. Relative numbers, not absolute Chrome parity. Scope: weeks-to-months.

## Decision
- Ship **P2**.
- Exposed as a Vitest custom environment (`environment: "perrr"`).
- Not a browser. Not a Chromium driver. In-process with the test runner.

## Why
- Fills real gap between jsdom/happy-dom (no layout, no frames) and headless Chrome (slow, noisy, cross-process).
- Determinism is structurally native to P2; impossible in P1.
- Tractable: no ecosystem replacement; zero config change beyond `environment: "perrr"`.
- Scope matches solo-engineer capacity.

## Consequences
- Existing `.test.tsx` / `.bench.tsx` run unmodified → zero-friction adoption.
- LCP/CLS/INP numbers will not match Chrome numerically. Documented as "same definition, different pipeline."
- Cannot benchmark anything test harness cannot express (no navigation, no multi-origin, no cross-tab).
- Moat ≠ browser engine. Moat = determinism + native speed + metric definitions that work.

## Alternatives rejected
- **P1 (full engine)** — out of scope; multi-year.
- **Fork Blitz** — renderer, not test engine; lacks Vitest integration; ownership cost.
- **Playwright-Vitest bridge** — high per-test overhead; non-deterministic; inherits real-Chrome noise.
- **happy-dom fork** — still JS-backed; layout + frame model would require rewrite.

## Changelog
- 2026-04-27: approved.
