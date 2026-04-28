---
title: perrr-dom
kind: crate
status: implemented
related:
  - specs/overview/00-tdd.md
  - specs/overview/03-dom-api-coverage.md
  - specs/milestones/m2-dom-shim.md
  - specs/crates/perrr-node/spec.md
  - specs/packages/perrr-dom-shim/spec.md
tests:
  - crates/perrr-dom/tests/basic.rs
  - crates/perrr-dom/tests/tree_invariants.rs
  - crates/perrr-dom/tests/selectors.rs
  - crates/perrr-dom/tests/attr_case.rs
  - crates/perrr-dom/tests/stale_ids.rs
last-reviewed: 2026-04-28
---

## Purpose
- Native DOM tree: nodes, mutations, attributes, events, queries.
- Owner of `NodeId` identity; everything else in perrr addresses nodes by ID.
- Behavior-only at v0.1. No style, no layout, no paint (those live in downstream crates).

## Contract
### MUST
- Expose a `Tree` type owning `Document`, `Element`, `Text`, `Comment`, `DocumentFragment` nodes.
- `NodeId = u32`; 1-based slot index into `Vec<Option<Node>>`; `0` reserved as `NODE_ID_INVALID`.
- Stable for the node's lifetime within a Tree; slot reused after `free_node` (no generation counter at v0.1; behavior documented in `tests/stale_ids.rs`).
- Node creation: `create_element`, `create_element_ns`, `create_text_node`, `create_comment`, `create_document_fragment`.
- Attribute ops: `get_attribute`, `set_attribute`, `remove_attribute`, `has_attribute`, `attribute_names`, `id_attr`.
  - HTML-namespace elements lowercase attribute names on set + lookup (HTML-spec compliance; enforced via `tests/attr_case.rs`).
  - SVG (non-HTML) namespace preserves case.
- Metadata: `node_type`, `node_kind`, `local_name`, `tag_name` (upper-cased for HTML elements), `namespace_uri`, `node_name`.
- Tree walks: `parent_node`, `parent_element`, `children`, `first_child`, `last_child`, `next_sibling`, `previous_sibling`, `contains`, `root_node`, `owner_document`.
- Tree mutation: `append_child`, `insert_before`, `remove_child`, `free_node` (recursive).
- Text: `text_content` (recursive concatenation), `set_text_content` (replaces children), `node_data`, `set_node_data`.
- Selector queries (hand-rolled subset in `selector` module): `matches`, `query_selector`, `query_selector_all`, `closest`. Parse errors surfaced as `SelectorParseError`.
- Focus tracking: `active_element`, `explicitly_focused`, `focus`, `blur`, `is_connected`.
  - `active_element` follows HTML spec: returns the explicitly-focused element if it's still connected to the document, else body, else `NODE_ID_INVALID`. Disconnected elements are implicitly treated as blurred.
  - `explicitly_focused` exposes the raw focus-state field without the spec fallback (testing + metrics).
  - `is_connected(id)` walks parent chain to document.
- Event listener registry: `Listener { id, event_type, capture, once, passive }` struct.
  - `add_event_listener(node, Listener)` — dedup per spec on (event_type, id, capture).
  - `remove_event_listener(node, type, id, capture) -> bool`.
  - `has_listener_of_type(node, type) -> bool` — ignores capture flag.
  - `listeners(node) -> Vec<Listener>` — clone.
  - `listener_count(node)`, `total_listener_count()` — delegate to `Vec::len`.
- Drives M8 listener metric + foundation for native event dispatch (H10c, future).
- Deterministic iteration order: `children(id)` returns children in insertion order.
- Return `Result<T, DomError>` for every fallible op (invalid node, cycle, not-a-child, reference not in parent, wrong kind).

### MUST NOT
- Depend on any `perrr-*` crate other than (future) `perrr-style` when style resolution hooks land (M3); at M2, zero `perrr-*` deps.
- Hold thread-shared state. `Tree` is `!Send` and `!Sync`; one per V8 isolate.
- Resolve CSS computed styles, run layout, or emit paint. Those are downstream.
- Return layout-dependent values (`getBoundingClientRect`, `offsetWidth`…). At M2 those stubs live in `perrr-dom-shim`; real values arrive in M4.

### Invariants
- `parent.children` and `child.parent` always consistent after every op (enforced by `tests/tree_invariants.rs`).
- `free_node` also frees descendants (recursive; enforced by proptest).
- `free_node` on the current `active_element` clears it (documented + tested).
- HTML attribute names stored lowercase; SVG names stored as given.
- NodeKind discriminants lock to DOM-spec values (Element=1, Text=3, Comment=8, Document=9, DocumentFragment=11). Enforced by `tests/tree_invariants.rs → nodekind_covers_all_spec_values`.
- Mutations on freed/invalid NodeIds return `Err(DomError::InvalidNode)`, never panic or corrupt state (`tests/stale_ids.rs`).
- Reads on freed/invalid NodeIds return `None` / `NODE_ID_INVALID`, never panic.

## Non-goals (v0.1)
- Event dispatch semantics (capture / target / bubble). M2 ships the listener counter only; full dispatch deferred to the event-system milestone.
- `MutationObserver` as a real spec implementation.
- Shadow DOM beyond what RTL queries expect.
- `Range`, `Selection` (stubs in facade; not modelled in `perrr-dom`).
- HTML parser for streaming (parse via `html5ever` when needed; not a runtime entry point at v0.1).
- `cloneNode`, `replace_child` (unused by accordion.test.tsx; add when a fixture demands).
- Selector features beyond the supported subset (see `src/selector.rs` module doc): `:nth-*`, `:first-child`, `:hover/focus`, `:has/is/where`, escaped identifiers, Unicode selectors. Parse raises `ParseError::Unsupported`.

## Design
- **Storage:** `Tree { nodes: Vec<Option<Node>>, free_list: Vec<NodeId>, document: NodeId, active_element: NodeId }`. Index 0 reserved for `NODE_ID_INVALID`. Reuse-after-free: `free_list.pop()` recycles slots. No generation counter (footgun documented in `tests/stale_ids.rs`; upgrade path: `NodeId = (gen<<32)|slot` if a failing fixture demands it).
- **Node kinds:** unit enum `NodeKind` (Element, Text, Comment, Document, DocumentFragment) + `#[repr(u8)]` discriminants matching DOM `nodeType`. Associated data lives on `Node` (parent, children, local_name, namespace_uri, attributes, text, listener_count).
- **Children:** `Vec<NodeId>` on each node. Ordered. No cache, no doubly-linked list.
- **Attributes:** small `Vec<Attr { name, value }>` — DOM typically has < 10 attrs; hash map not worth the overhead. HTML names lowercased on set + lookup.
- **Selector matching:** hand-rolled in `src/selector.rs` (parser + matcher). Not using the `selectors` crate — subset targeted at accordion fixture + validated against happy-dom via differential fuzz.
- **Events:** only the listener counter is implemented at v0.1. Full capture/target/bubble dispatch deferred to a later milestone; the M8 metric relies only on the counter.
- **Provenance:** greenfield implementation — does NOT fork obscura-dom. Earlier spec drafts mentioned a fork; decision changed during 4d.i when the Tree API could be written cleaner from scratch than adapted.

## N-API surface (exposed via `perrr-node`)
- See `specs/crates/perrr-node/spec.md` §Exported surface for the authoritative list of JS-visible methods on `PerrrDom`.
- All values crossing the boundary are `u32` (NodeId), `String`, `bool`, `Option<T>`, `Vec<u32>`, or `#[napi(object)]` DTOs.
- Future event dispatch will require a JS-callable handle: listener registration returns `listener_id: u32`, JS owns `Map<listener_id, fn>`, Rust invokes via napi `ThreadsafeFunction` or sync env callback. Design open; benchmark at implementation time.

## Tests
- `tests/basic.rs` — 19 unit tests for tree shape, attributes, siblings, text, focus, listener counter, tree-mutation errors.
- `tests/tree_invariants.rs` — 3 proptest / fixed cases: random mutation sequences preserve parent/child consistency; `free_node` frees all descendants; NodeKind discriminants lock to spec.
- `tests/selectors.rs` — 11 unit tests: `*`, type, class, id, attribute operators (`=`, `~=`, `^=`, `$=`, `*=`), `:not`, combinators (descendant / child / adjacent / sibling), selector list, `query_selector`, `query_selector_all`, `closest`, unsupported-feature rejection.
- `tests/attr_case.rs` — 5 unit tests: HTML attr names lowercased on set; `has`/`remove`/`get_attribute` case-insensitive on HTML; SVG preserves case; values not lowercased.
- `tests/stale_ids.rs` — 4 unit tests: stale reads → None; slot reuse footgun (documented, not fixed); out-of-range reads never panic; mutations on stale return Err.
- Indirect: `fixtures/acceptance/components/accordion.test.tsx` exercises end-to-end via happy-dom backend + dual harness (4,351 tree mutations + 5,637 selector queries per-op verified equivalent across the two backends).

## Open
- Event dispatch (capture / target / bubble, `preventDefault`, `stopPropagation`) — not implemented at M2. Design TBD; possibly a JS-driven walk using Rust tree-ancestor helpers, avoiding per-event napi callbacks.
- Generation counter on NodeId slots — not added. Wait for a failing fixture to justify the overhead (~5% memory).
- Listener-callback boundary mechanism — `ThreadsafeFunction` vs `Env`-sync call. Benchmark at event-system implementation; default to sync.
- Selector corpus extensions — `[a|=v]` boundary semantics, case-insensitive flag `i`, escaped identifiers; not yet fuzz-tested.

## Changelog
- 2026-04-28: initial draft (M2 planning). Status: draft (design written before implementation; some items later revised — see 4d.i).
- 2026-04-28: 4d.i shipped tree + Tier 1+2 ops (22 tests green). Greenfield implementation; earlier draft's "fork obscura-dom" direction abandoned as unnecessary.
- 2026-04-28: 4e.i shipped hand-rolled CSS selector subset (parse + matches + querySelector{,All} + closest); 11 more tests. Not using `selectors` crate — targeted at accordion fixture scope, trades spec completeness for implementation simplicity.
- 2026-04-28: 4e.v — **bug fix: HTML attribute name case-sensitivity.** HTML elements now lowercase names on set + lookup (spec-compliant); SVG preserves case. Bug caught by dual harness H8 test. Rust tests added in `tests/attr_case.rs`.
- 2026-04-28: 4e.vi — stale NodeId behavior documented via `tests/stale_ids.rs`. No bug; footgun made explicit. Generation counter upgrade path noted.
- 2026-04-28: 4e.vii — `active_element` made spec-compliant: defaults to body when nothing is focused; implicitly blurs disconnected elements. Caught by dual harness activeElement read-compare (235 divergences before fix, 0 after). Added `body: NodeId` field, `is_connected(id)`, `explicitly_focused()`. 3 test updates + 1 new test.
- 2026-04-28: 4e.viii (H10b) — listener registry upgraded from a counter to a real `Vec<Listener>` per node. `Listener { id, event_type, capture, once, passive }`. `add_event_listener` with spec dedup; `remove_event_listener` returns bool; `has_listener_of_type` for future dispatch path. `incr_listener`/`decr_listener` removed (the dual harness now drives a real listener id). 3 new Rust tests covering dedup, has_of_type, remove-matching semantics.
