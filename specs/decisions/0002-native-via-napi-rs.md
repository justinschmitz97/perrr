---
title: native via napi-rs; in-process; handle-based
kind: decision
status: approved
supersedes: []
superseded-by: []
related:
  - specs/decisions/0001-product-is-a-vitest-environment.md
last-reviewed: 2026-04-27
---

## Context
- perrr core = Rust (DOM, style, layout, paint, scheduler, perf).
- Binds into Node.js V8 already hosting Vitest + React + RTL.
- Hot APIs called thousands of times per test; latency-sensitive.

## Decision
- Native addon via **napi-rs**, single `.node` binary per target, in-process with the test runner.
- **Handle-based** N-API: `u32 NodeId` crosses boundary; never raw pointers.
- Prebuilt binaries via `optionalDependencies` per `{os, arch, libc}`.
- ABI pinned to a napi-rs version per release.

## Why
- napi-rs: stable ABI (N-API); prebuilt per target; no Rust toolchain at `npm install`.
- In-process: zero IPC cost; shared event loop; React + perrr share one V8.
- Handle-based: no pointer leaks; no GC coordination; trivial determinism.

## Consequences
- Rust crash = test process crash. All panics caught at N-API boundary → JS exceptions.
- N-API ABI break requires coordinated binary + JS release. CI gates on compat.
- One binary per `{os, arch, libc}` in the publish matrix.
- JS-side `instanceof HTMLElement` required (RTL uses it); classes live in JS, back nodes by `NodeId`.

## Alternatives rejected
- **neon** — requires Rust toolchain at install; weaker prebuilt story.
- **WASM** — high FFI cost per call; no shared memory with V8 heap; no threads in main test context.
- **Child process + IPC** — per-call latency dominates; breaks React/RTL synchronous assumptions.
- **BigInt pointer pass-through** — fragile across GCs; no safety net.

## Changelog
- 2026-04-27: approved.
