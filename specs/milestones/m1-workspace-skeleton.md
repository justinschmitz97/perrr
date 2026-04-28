---
title: m1 workspace skeleton
kind: milestone
status: approved
related:
  - specs/overview/00-tdd.md
  - specs/decisions/0002-native-via-napi-rs.md
tests:
  - crates/perrr-node/tests/hello.rs
  - packages/perrr/test/smoke.test.ts
  - .github/workflows/build.yml
last-reviewed: 2026-04-27
---

## Purpose
- Establish buildable + publishable base camp.
- Prove N-API binary loads on all v0.1 target platforms.

## Red test
- `pnpm test` fails: `require("perrr-node").hello()` undefined OR addon not loaded.
- CI matrix fails on any of `{win-x64, mac-x64, mac-arm64, linux-x64, linux-arm64, linux-musl-x64}` if binary absent or load-error.

## Contract
### MUST
- Cargo workspace with empty crates: `perrr-dom`, `perrr-style`, `perrr-layout`, `perrr-paint`, `perrr-scheduler`, `perrr-perf`, `perrr-thrash`, `perrr-node`.
- pnpm workspace with empty packages: `perrr`, `vitest-environment-perrr` (initially `perrr-vitest`; renamed in M2a per ADR 0003), `perrr-dom-shim`.
- `perrr-node` exports `hello() -> "ok"` (napi-rs `#[napi]`).
- `packages/perrr` reexports from `perrr-node`; `require("perrr").hello() === "ok"`.
- GitHub Actions builds prebuilts for 6 target triples; uploads to workflow artifacts.
- Root `README.md`, `LICENSE` (MIT), `.gitignore`, `rust-toolchain.toml` pinning stable.
- Node `engines.node: ">=20.0.0"`.
- pnpm lockfile committed.

### MUST NOT
- No DOM/style/layout/paint/scheduler implementation in M1.
- No external Rust deps beyond `napi`, `napi-derive`, `napi-build`.
- No Rust toolchain at `npm install` time (prebuilt-only).
- No publish to npm registry.

### Invariants
- `pnpm build` produces loadable `.node` on the current platform.
- `pnpm test` green on the current platform.
- `cargo clippy -- -D warnings` clean.
- `cargo fmt --check` clean.

## Non-goals
- No React, RTL, motion, radix, Vitest env integration.
- No benchmark fixture wiring.
- No `specs/crates/<name>/spec.md` for crates other than `perrr-node`.

## Design
- Repo root: `C:\Projekte\perrr`.
- Layout: see `specs/overview/00-tdd.md` Architecture.
- CI: single workflow `.github/workflows/build.yml`; matrix job per target triple; cache `target/` + pnpm store.
- Package manager: pnpm 9+.
- Rust: pinned to `1.95.0` in `rust-toolchain.toml` (2026-04-28 bump from 1.85; latest stable at kickoff).
- napi-rs: `@napi-rs/cli ^3.6.2` + `napi`/`napi-derive` `^3`; `@napi-rs/cli` drives build + per-platform package generation.

## Target triples (M1 CI matrix)
| triple | runner |
|---|---|
| x86_64-pc-windows-msvc | windows-latest |
| x86_64-apple-darwin | macos-13 |
| aarch64-apple-darwin | macos-14 |
| x86_64-unknown-linux-gnu | ubuntu-latest |
| aarch64-unknown-linux-gnu | ubuntu-latest (cross) |
| x86_64-unknown-linux-musl | ubuntu-latest (cross) |

## Done-when
- [x] `pnpm install && pnpm build && pnpm test` green locally on Windows.
- [ ] CI green on all 6 target triples. _(Pending — no remote configured yet.)_
- [ ] Prebuilt `.node` artifacts downloadable from the workflow run. _(Blocked by above.)_
- [x] `specs/crates/perrr-node/spec.md` created.
- [x] PR-equivalent commit messages contain the `Spec updated:` line.
- [ ] On merge: archive spec. _(Blocked by no-remote; M1 scope verified locally but not yet "merged" in the git sense.)_

## Tests
- `crates/perrr-node/tests/hello.rs` — `#[test] assert_eq!(hello(), "ok");`
- `packages/perrr/test/smoke.test.ts` — `expect(require("perrr").hello()).toBe("ok");`
- `.github/workflows/build.yml` — per-triple job: build + load-smoke + upload artifact.

## Open
- linux-musl-x64 inclusion — default yes (Alpine CI users); revisit if cross-compile cost is excessive.

## Changelog
- 2026-04-27: approved.
- 2026-04-28: pinned Rust `1.85.0` in `rust-toolchain.toml`; pinned `@napi-rs/cli` `^3.0.0`. Remaining open items collapsed to musl inclusion only.
- 2026-04-28: bumped to latest stable everywhere (Rust `1.95.0`; `napi` / `napi-derive` Rust crates `^3`). Reason: `napi-build@2.3.1` requires rustc ≥1.88; also aligns with project policy of tracking current stable.
- 2026-04-28: added explicit `vite ^8.0.8` devDep to `packages/perrr`. Reason: Vitest 4 peer-depends on Vite 6/7/8; pnpm resolved a transitive Vite 5 which broke `./module-runner` export at runtime.
- 2026-04-28: done-when status updated — local criteria satisfied; CI/remote criteria remain blocked pending git remote. Spec stays `approved` until archival on merge.
