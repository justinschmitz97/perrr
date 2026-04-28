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
- **Status: refined (partially confirmed, narrowed).**
- **Evidence (post-iteration):** 4,346 strict-mode per-op shape diffs, zero divergences, plus explicit tracker counters for 14 previously-unhooked mutation paths showing **all zero for the accordion fixture**.
- **Counter-hypotheses outcomes:**
  - **H1a:** refuted for accordion. Tracker shows innerHTML / outerHTML / insertAdjacentHTML / insertAdjacentElement / insertAdjacentText / Element.remove / before / after / replaceWith / append / prepend / replaceChildren / Node.normalize / classList.add/remove/toggle/replace / HTMLInputElement.value/checked setters all have **count=0** on the accordion fixture. Claim narrowed: *for this fixture*, those paths are not exercised. Would re-open on different fixtures.
  - **H1b:** not tested. `node.remove()` tracker = 0, so transitivity is moot for this fixture.
  - **H1c:** not tested. `classList.*` tracker = 0.
  - **H1d:** **confirmed as a real gap, then closed.** Tracker first showed 158 `Element.set textContent` calls unmirrored. Strict shape check missed the drift because textContent sets happened inside subtrees that were detached before the next hooked op ran on their ancestors (subtree-local drift invisible to root-level serialization). Fix: added `patchTextContentSetter` mirroring to `native.setTextContent`. Re-run: mutationsChecked jumped from 4,207 → 4,346 with **0 new divergences**, confirming perrr-dom's setTextContent matches happy-dom's semantics for those calls. Regression test: `dual-sanity.test.ts → "textContent mirror keeps trees in sync"`.
- **Generalization warning:** zero counters in the trackers mean zero calls *on accordion.test.tsx*. Other fixtures (modals, forms, virtualized lists) WILL exercise some of these paths. When we widen fixture scope, rerun trackers first; mirror before cutting happy-dom.

### H2 — "perrr-dom selector matcher produces identical results to happy-dom for realistic queries"
- **Status: refined — found HD bug; perrr-dom is MORE spec-correct in one case.**
- **Evidence (post-iteration):** 5,637 real-fixture queries with zero divergence + broad fuzz corpus (~40 selectors × ~10 nodes × 4 query methods ≈ 500+ paired comparisons).
- **Counter-hypotheses outcomes:**
  - **H2a:** partially refuted. The fuzz corpus added: `:not` with multiple negations, combinator variants, attribute operators with quoted/unquoted values, comma-lists with no-match components, tag-case-insensitivity, sibling combinators. All perrr-dom matches HD for these — except the one HD bug noted below. Unsupported selectors (`:first-child`, `:nth-*`, `:has`, `:is`, `:where`) remain genuinely unsupported by perrr-dom and throw ParseError; fuzz does not include them. Claim limited to *supported subset*.
  - **H2b:** not directly tested. `[a|=val]` boundary and case-insensitive flag `i` would need dedicated corpus; not critical for accordion.
  - **H2c:** still open (error type).
- **Finding (HD bug):** `querySelectorAll("button ~ a")` — happy-dom returns the matching `a` twice (appears to emit one result per matching preceding button sibling); CSS spec requires dedup. perrr-dom correctly returns one. Captured in `selector-fuzz.test.ts → "H2 exception: perrr-dom dedupes…"`. Implication: when we cut happy-dom, any code depending on HD's duplicated result will break. Scan fixtures before swap. Listed in action queue.
- **Test plan (remaining):** selector.rs Rust tests with `[a="b c" i]`, `[a|=val]` across a-b-c/a-bc boundary, escaped identifier characters.

### H3 — "NodeId reuse-after-free is safe because each test resets"
- **Evidence:** All tests pass. `free_node` correctly frees descendants (proptest). Per-test `afterEach(cleanup)` removes body children.
- **Counter-hypotheses:**
  - **H3a:** A test retains a NodeId in a closure (e.g. via React's internal fiber reference) past a cleanup boundary, then queries it. If the ID was reused, we'd return data for a different node. Silent correctness bug.
  - **H3b:** Our `free_node` recurses via explicit stack — if a node ID appears twice in a subtree due to a tree corruption, we'd double-free, possibly panicking. Protested against via invariants test but not via fuzz-replay.
- **Test plan:**
  - Write a Rust test that creates node A, frees it, creates node B that may reuse A's id, queries both — assert that the reused id's data matches B, not A.
  - Consider adding a generation counter (u32 top-bits) to catch stale IDs; measure overhead; decide.

### H4 — "The dual harness's detector actually catches all classes of divergence"
- **Status: partially confirmed.**
- **Evidence:** 9 self-tests firing (baseline, mutation divergence (2 directions), query divergence, op counter advancement, query counter advancement, textContent mirror, bimap miss, HD-throws-mirror-stays-consistent).
- **Counter-hypotheses outcomes:**
  - **H4a:** confirmed. Sanity test (`H4a — HD-throws, mirror-didn't-run stays consistent`) exercises `setAttribute("", "x")`. Since our hook order is `original.apply(this, args)` → `mirror.apply(this, args)`, if the original throws, mirror never runs, and both sides stay consistent. Limitation: HD in practice accepts empty name (doesn't throw), so the test documents the pattern rather than exercising a thrown path. Open TODO: find an HD op that genuinely throws (invalid QName, maybe `setAttributeNS` with mismatched NS?) to exercise the thrown path for real.
  - **H4b:** confirmed. Added `missedMirrorCount` counter (incremented in `appendChild` / `insertBefore` / `removeChild` / `replaceChild` / `setAttribute` / `removeAttribute` / `set textContent` paths when bimap lookup fails). Sanity test (`H4b — missedMirrorCount increments on bimap miss`) deliberately deletes a node from the bimap, calls `parent.appendChild(child)`, verifies the counter advanced. Loose mode observes the drift via the counter; strict mode additionally throws at the next verify (proven by `strict mode throws at the op that introduces divergence` test).
  - **H4c:** **still open.** Serialization uses preorder walk with sorted attrs. This preserves child order. Attribute order differences cannot be observed since we sort — but also cannot silently hide semantic differences, because iteration order over attributes is not a DOM-spec-visible property. Believe safe; no regression test yet.
  - **H4d:** confirmed. Strict only verifies after HOOKED ops. The textContent case (H1d) made this concrete: 158 unhooked calls, strict ran 4,197 verifications, none detected the drift. Mitigation: ensure all mutating paths are hooked before claiming equivalence.

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
1. ~~**H1 trackers**~~ — done 2026-04-28. Found H1d (textContent unmirrored), fixed.
2. ~~**H4 — missed-mirror counter.**~~ done 2026-04-28.
3. ~~**H6 / H4a — forced-throw drift test.**~~ done 2026-04-28 (H4a sanity test).
4. **H2 selector edge cases.** Expand selectors.rs tests with `:first-child`, `[a|=x]` boundary, case-insensitive flag, escaped identifiers. Open.
5. **H3 stale-id test.** Rust test that exercises free + reuse + stale-id query. Open.
6. **H8 (new) attribute case-sensitivity.** HD may normalize HTML attribute names (e.g. `Data-State` → `data-state`); perrr-dom stores as given. Tracker data showed zero mismatch for accordion (suggests both preserve case or both lowercase), but untested. Open.
7. **H9 (new) activeElement tracking parity.** `document.activeElement` not hooked in dual harness; not differentially compared. Open.
8. **H10 (new) event dispatch parity.** When native event dispatch lands, compare HD vs native dispatch order + preventDefault semantics. Open.

## Numbers-at-a-glance (after round 4e.iii trackers + textContent mirror)
- Strict mode on accordion.test.tsx:
  - 4,346 tree-shape assertions, 0 divergences
  - 5,637 selector-query assertions, 0 divergences
  - 0 bimap misses (via live paths)
  - 14 unhooked mutation-tracker APIs, all count=0 for this fixture
- Self-test suite: 9 cases proving the detector fires in both modes + on both sides (injected HD divergence, injected native divergence, bimap miss, textContent parity).

## Changelog
- 2026-04-28: initial (7 hypotheses).
- 2026-04-28: round 4e.iii — H1 trackers discovered H1d (textContent unmirrored), fixed + regression-tested. H4a/H4b confirmed via sanity tests. Added new open hypotheses H8/H9/H10 based on adversarial review.
- 2026-04-28: round 4e.iv — H2 selector fuzz (~500 paired comparisons). Found HD bug on `button ~ a` (HD returns duplicate; perrr-dom correct). H2 refined: claim narrowed to "supported subset, measured on accordion fixture + fuzz corpus"; HD bug flagged as a real delta to watch for when cutting happy-dom.
