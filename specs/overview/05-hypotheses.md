---
title: open hypotheses + contradiction tests
kind: overview
status: approved
last-reviewed: 2026-04-28
related:
  - specs/milestones/m2-dom-shim.md
  - specs/packages/perrr-dom-shim/spec.md
  - specs/crates/perrr-dom/spec.md
---

## Purpose
- Adversarial self-review log. Each entry pairs a claim with the concrete test that would contradict it.
- Living doc. Every loop iteration adds / updates entries.
- States: `open` (no test yet) · `confirmed` (test exists, claim holds) · `refuted` (test fails, claim rejected) · `refined` (claim narrowed after counter-evidence).

## Ground rules
- Zero divergence on a narrow corpus ≠ correctness. Claims must name their scope.
- Absence of evidence ≠ evidence of absence. Unhooked paths may silently drift; instrument before asserting.
- Detector self-tests (injected divergence) count; indirect signals (overall test pass) don't.

## Hypotheses

### H1 — "perrr-dom tree mutation is equivalent to happy-dom for accordion.test.tsx"
- **Evidence:** 4,197 strict-mode per-op shape diffs, zero divergences.
- **Scope of evidence:** only the eight mutation paths we hook (appendChild, insertBefore, removeChild, replaceChild, setAttribute, removeAttribute, toggleAttribute, CharacterData.data/nodeValue setters).
- **Counter-hypotheses:**
  - **H1a:** React / RTL / radix / motion uses unhooked mutation paths (innerHTML, Element.textContent setter, classList.add/remove/toggle, dataset, insertAdjacentHTML, before/after/remove/replaceWith, normalize). If so, happy-dom's tree mutates but perrr-dom's does not. The 4,197 "matching" checks happen AFTER hooked mutations, so any unhooked mutation in between would surface at the next hooked one — UNLESS unhooked mutations only run at the end (just before cleanup()).
  - **H1b:** `node.remove()` is unhooked. It calls parent.removeChild internally, which IS hooked on Node.prototype — so probably transitively covered. **Verify.**
  - **H1c:** classList.add(x) internally calls setAttribute("class", …). If so, our setAttribute hook covers it. **Verify.**
  - **H1d:** Element.textContent setter (distinct from CharacterData.nodeValue) replaces children. Unhooked. If called, we miss it.
- **Test plan:**
  - Add a "tracker" hook that ONLY counts calls (no mirror) for: Element.innerHTML setter, Element.textContent setter, classList.add/remove/toggle/replace, dataset Proxy get/set, insertAdjacentHTML, node.remove, before, after, replaceWith, normalize, HTMLInputElement.value setter.
  - Run accordion.test.tsx. Dump counters.
  - Any counter > 0 on an unhooked *mutating* API is a confidence gap. Either mirror it or prove it's transitive.

### H2 — "perrr-dom selector matcher produces identical results to happy-dom for realistic queries"
- **Evidence:** 5,637 matches/querySelector/closest calls, zero divergence.
- **Scope of evidence:** the exact selector strings RTL + radix + motion passed in the accordion fixture. Not a broad corpus.
- **Counter-hypotheses:**
  - **H2a:** Selectors the harvest never hit (`:first-child`, `:last-child`, `:nth-*`, `:hover`, `:focus-visible`, `:has()`, `:is()`, `:where()`, Unicode selectors, escaped identifiers) are unsupported by perrr-dom but called by user code in other fixtures. If we expand to more fixtures later, new divergences will appear.
  - **H2b:** Attribute-operator edge cases (empty value, case-insensitive flag `i`, DashMatch semantics across "-" boundaries) might disagree. The harvest only covered `=`, `~=`, `^=`, `$=`, `*=` and none of the quoting edge cases.
  - **H2c:** `Element.matches(invalidSelector)` — happy-dom throws a SyntaxError; perrr-dom throws a `ParseError`. Different error types / messages could break code that catches specific errors. **Low-risk, worth noting.**
- **Test plan:**
  - Expand selector unit tests with `:is()`-shaped edge cases: `[a="b c" i]`, `[a|=val]` across a-b-c / a-bc, `.` with escaped dots, long tag names with dashes.
  - For each, compare perrr-dom to happy-dom in a standalone script.

### H3 — "NodeId reuse-after-free is safe because each test resets"
- **Evidence:** All tests pass. `free_node` correctly frees descendants (proptest). Per-test `afterEach(cleanup)` removes body children.
- **Counter-hypotheses:**
  - **H3a:** A test retains a NodeId in a closure (e.g. via React's internal fiber reference) past a cleanup boundary, then queries it. If the ID was reused, we'd return data for a different node. Silent correctness bug.
  - **H3b:** Our `free_node` recurses via explicit stack — if a node ID appears twice in a subtree due to a tree corruption, we'd double-free, possibly panicking. Protested against via invariants test but not via fuzz-replay.
- **Test plan:**
  - Write a Rust test that creates node A, frees it, creates node B that may reuse A's id, queries both — assert that the reused id's data matches B, not A.
  - Consider adding a generation counter (u32 top-bits) to catch stale IDs; measure overhead; decide.

### H4 — "The dual harness's detector actually catches all classes of divergence"
- **Evidence:** 6 self-tests firing (injected mutation divergence, injected selector divergence, both directions).
- **Counter-hypotheses:**
  - **H4a:** We only `pushDivergence("mirror-throw")` when perrr-dom throws while happy-dom succeeded. The reverse case (HD throws, perrr doesn't) is silent. If perrr-dom accepts invalid HTML / invalid selectors that HD rejects, we'd never notice.
  - **H4b:** If the bimap fails to register an HD node (i.e. `idOf.get(hdNode)` returns undefined), we silently skip the mirror. Divergence is masked. There's no "missed-mirror" counter.
  - **H4c:** `serializeNative` and `serializeHappyDom` might normalize identically even when trees differ semantically — e.g. if attribute order is sorted in both serializers, but internal iteration order in the actual DOM differs, we won't catch it. Child order IS verified via the serializer's preorder walk.
  - **H4d:** Strict mode verifies AFTER every hooked mutation. It does not verify AFTER unhooked mutations. So unhooked-mutation divergence is only caught at the next hooked operation (if any) or at end-of-test.
- **Test plan:**
  - Self-test where HD throws (invalid innerHTML) but we silently succeed on our side. Verify this is flagged.
  - Self-test where a NodeId is created on happy-dom but not registered in the bimap; verify we emit a "missed-mirror" log. Add a missed-mirror counter to stats.
  - Self-test where child-order differs but serialized string accidentally matches (constructed maliciously) — reject if found possible; else close out.

### H5 — "`pnpm -F perrr test:acceptance` exercises everything accordion.test.tsx will exercise in production"
- **Evidence:** All 39 cases pass under happy-dom today; RTL assertions find the right elements.
- **Counter-hypotheses:**
  - **H5a:** Our env uses `environment: "perrr"` via vitest-environment-perrr, which currently routes to happy-dom under the hood. Once we swap to native, behavior may diverge for APIs that were silently handled by happy-dom (e.g. event bubbling, focus stealing, `getBoundingClientRect` returning 0 affecting radix's positioning logic).
  - **H5b:** The pinned fixture copy in `fixtures/acceptance/` may drift from the live `justinschmitz.de` version. Tests we pass here may not reflect what the user actually runs.
  - **H5c:** Vitest 4 worker pool isolation: each test file runs in a worker. Our globalThis bimap/state is per-worker. If some test setup relies on cross-test state (which accordion.test.tsx does NOT, per `afterEach(cleanup)`), those patterns would fail under perrr differently.
- **Test plan:**
  - Add a "drift check" CI step: hash the fixture files + `bench/opts.ts` and fail if hashes differ from a committed snapshot (catches silent fixture rot).
  - After each M2c API is swapped to native, re-run dual mode and check divergence count. Any new divergence = new gap.

### H6 — "The mirror hooks preserve happy-dom's return values and semantics"
- **Evidence:** 43/43 tests pass in dual mode. RTL assertions hold.
- **Counter-hypotheses:**
  - **H6a:** Patched `setAttribute` always calls the original first, then mirrors. If mirror throws mid-op, we caught it and converted to a divergence log. But we did NOT restore happy-dom's state. Post-mortem inspection could show HD advanced, native didn't, harness emitted a divergence entry, test continued — result: apparent test-pass with silent state drift on native side. Strict mode catches this at the next op. Loose mode emits it at end.
  - **H6b:** Patched methods reuse `arguments` object which is non-standard in strict mode / may behave oddly in arrow contexts — though all our patches use `function` keyword. Mild risk.
- **Test plan:**
  - Inject a forced mirror-throw (e.g. call `native.setAttribute(invalid_id, …)`) and verify that subsequent strict-mode checks catch the drift.

### H7 — "happy-dom is a faithful reference for Chrome's DOM semantics"
- **Evidence:** Widely used in CI (jsdom/happy-dom). Community trust.
- **Counter-hypotheses:**
  - **H7a:** happy-dom has known spec gaps. If we match happy-dom exactly, we also inherit its bugs. When a user runs perrr vs real Chrome, numbers may diverge in ways our harness cannot detect (because our reference is happy-dom, not Chrome).
  - **H7b:** For v0.1 this is acceptable — the goal is "faster-than-jsdom drop-in," not Chrome parity (per ADR 0001).
- **Test plan:**
  - Non-blocking. Document the limitation in `specs/overview/02-metrics.md` so readers don't over-interpret perrr numbers as "Chrome numbers."

## Action queue (sorted by risk reduction / cost)
1. **H1 trackers** — cheap, high value. Add call counters for unhooked mutating APIs; run; decide what to mirror. Immediate next step.
2. **H4 — missed-mirror counter.** Cheap. One line in the bimap-lookup path.
3. **H6 — forced-throw drift test.** Cheap.
4. **H2 selector edge cases.** Medium. Expand selectors.rs tests.
5. **H3 stale-id test.** Medium. Rust fuzz test.
6. **H4a — HD-throws-we-succeed.** Medium. Need a divergence-where-HD-errors sanity test.

## Changelog
- 2026-04-28: initial.
