---
title: perrr-dom
kind: crate
status: draft
related:
  - specs/overview/00-tdd.md
  - specs/overview/03-dom-api-coverage.md
  - specs/milestones/m2-dom-shim.md
  - specs/crates/perrr-node/spec.md
  - specs/packages/perrr-dom-shim/spec.md
tests:
  - crates/perrr-dom/tests/tree_invariants.rs
  - crates/perrr-dom/tests/event_dispatch.rs
  - crates/perrr-dom/tests/queries.rs
last-reviewed: 2026-04-28
---

## Purpose
- Native DOM tree: nodes, mutations, attributes, events, queries.
- Owner of `NodeId` identity; everything else in perrr addresses nodes by ID.
- Behavior-only at v0.1. No style, no layout, no paint (those live in downstream crates).

## Contract
### MUST
- Expose a `Tree` type owning `Document`, `Element`, `Text`, `Comment`, `DocumentFragment` nodes.
- `NodeId = u32`; stable for the node's lifetime within a Tree; reused only after `free_node`.
- Mutation ops: `create_element`, `create_text_node`, `create_comment`, `create_document_fragment`, `append_child`, `insert_before`, `remove_child`, `replace_child`, `clone_node`, `free_node`.
- Attribute ops: `get_attribute`, `set_attribute`, `remove_attribute`, `has_attribute`, `attribute_names(NodeId) -> Vec<String>`.
- Text: `text_content`, `set_text_content`, `node_value`, `set_node_value`, `data`, `set_data`.
- Queries: `query_selector(root, selector)`, `query_selector_all(root, selector)`, `get_element_by_id(tree, id)`, `get_elements_by_tag_name(root, tag)`.
- Event ops: `add_event_listener(node, type, listener_id, options)`, `remove_event_listener(node, type, listener_id)`, `dispatch_event(target, event) -> bool`.
- Focus tracking: `active_element(Tree) -> Option<NodeId>`, `focus(NodeId)`, `blur(NodeId)`.
- Bulk reset: `reset_tree(Tree)` re-initializes a Tree to a fresh `<html><head></head><body></body></html>` in O(1) on the hot path (reallocates slotmap).
- Deterministic iteration order: `children(NodeId)` returns children in insertion order.
- Return `Result<T, DomError>` for every op that can fail (detached nodes, invalid selector, circular parent).

### MUST NOT
- Depend on any `perrr-*` crate other than (future) `perrr-style` when style resolution hooks land (M3); at M2, zero `perrr-*` deps.
- Hold thread-shared state. `Tree` is `!Send` and `!Sync`; one per V8 isolate.
- Resolve CSS computed styles, run layout, or emit paint. Those are downstream.
- Return layout-dependent values (`getBoundingClientRect`, `offsetWidth`…). At M2 those stubs live in `perrr-dom-shim`; real values arrive in M4.

### Invariants
- `parent.children` and `child.parent` always consistent after every op.
- `free_node` also frees descendants (recursive).
- `active_element == Some(n)` only if `n` is reachable from `document` via `parent` chain.
- Every `add_event_listener` increments an internal listener counter on `Tree`; `remove_event_listener` and `free_node` decrement (drives M8 metric).
- `dispatch_event` visits capture → target → bubble in order; `stopPropagation` and `stopImmediatePropagation` honored.

## Non-goals (v0.1)
- Shadow DOM beyond what RTL queries expect (empty shadow roots).
- `MutationObserver` as a real spec implementation (stub at M2; real in a later milestone if fixtures require).
- `Range`, `Selection` (stubs in facade; not modelled in `perrr-dom`).
- HTML parser for streaming (parse via `html5ever` when needed; not a runtime entry point).

## Design
- **Storage:** `Tree { nodes: SlotMap<NodeId, Node>, document: NodeId, active: Option<NodeId>, listeners: u32 }` using `slotmap::SlotMap` for stable keys.
- **Node kinds:** `enum NodeKind { Document, Element { tag, namespace, attrs, classes, id }, Text(String), Comment(String), DocumentFragment }`.
- **Children:** `Vec<NodeId>` on each node. Ordered. No cache, no doubly-linked list.
- **Attributes:** small `Vec<(String, String)>` — DOM typically has < 10 attrs; hash map not worth the overhead.
- **Selector matching:** reuse the `selectors` crate + `cssparser` (already in obscura-dom). Visitor pattern over the tree.
- **Events:** listeners stored per-node as `Vec<Listener>`; dispatch walks the ancestor chain once to capture targets, then fires in canonical order.
- **Provenance:** initial implementation forks `obscura-dom` (html5ever tree + selector matching). Tracked in `specs/decisions/0003-fork-obscura-dom.md` (TBD).

## N-API surface (exposed via `perrr-node`)
- Flat, handle-based. Each fn: `fn <op>(env: &Env, <NodeId | DocumentId | primitives>) -> Result<JsValue, Error>`.
- No opaque Rust types cross the boundary; all parameters and returns are `u32`, `String`, `bool`, or `#[napi(object)]` DTOs.
- Listener callbacks: listener registration returns a `listener_id: u32`; JS side owns a `Map<listener_id, fn>` and is called from Rust via a pre-registered env callback.

## Tests
- `tests/basic.rs` — 19 unit tests for tree, attributes, siblings, text, focus, listener counter.
- `tests/tree_invariants.rs` — 3 proptest cases: random mutation sequences preserve parent/child consistency; `free_node` frees all descendants.
- `tests/selectors.rs` — 11 unit tests: `*`, type, class, id, attribute operators, `:not`, combinators (descendant / child / adjacent / sibling), selector list, `querySelector`, `querySelectorAll`, `closest`, unsupported-feature rejection.
- `tests/event_dispatch.rs` — TBD (M2 event system, next round).
- Indirect: `fixtures/acceptance/components/accordion.test.tsx` exercises end-to-end via happy-dom backend pending native facade swap.

## Open
- Namespace handling: full XML namespaces or HTML-only for v0.1. Lean: HTML-only; namespaces map to fixed strings. Revisit if SVG fixtures appear.
- Listener-callback boundary cost: `ThreadsafeFunction` vs `Env`-sync call. Benchmark at M2c; default to sync.

## Changelog
- 2026-04-28: initial draft (M2 planning).
- 2026-04-28: 4d.i shipped tree + Tier 1+2 ops (22 tests green).
- 2026-04-28: 4e.i shipped hand-rolled CSS selector subset (parse + matches + querySelector{,All} + closest); 11 more tests. Not using `selectors` crate — targeted at accordion fixture scope, trades spec completeness for implementation simplicity.
