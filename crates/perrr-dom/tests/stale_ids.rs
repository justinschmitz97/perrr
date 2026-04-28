//! H3: NodeId reuse-after-free behavior.
//!
//! Spec: specs/crates/perrr-dom/spec.md §Storage model states that
//! NodeIds are reused after free and there is no generation counter
//! at v0.1. This file documents + guards the exact semantics so that
//! any future generation-counter migration is detectable.

use perrr_dom::{Tree, NODE_ID_INVALID};

#[test]
fn stale_id_after_free_reads_as_none() {
    let mut t = Tree::new();
    let a = t.create_element("a");
    assert_eq!(t.local_name(a), Some("a"));
    t.free_node(a);
    // After free, queries return None until (and unless) the slot is
    // reused. There is no generation check — the slot itself is empty.
    assert_eq!(t.local_name(a), None);
    assert_eq!(t.node_kind(a), None);
    assert_eq!(t.node_type(a), None);
    assert_eq!(t.parent_node(a), NODE_ID_INVALID);
}

#[test]
fn stale_id_after_reuse_returns_new_node_data_documented_footgun() {
    // Document the footgun: ids ARE reused. Callers holding stale ids
    // will read the NEW node's data, not the old. Tests depend on
    // each test resetting the tree (single Tree per test context).
    let mut t = Tree::new();
    let a = t.create_element("a");
    t.free_node(a);
    let b = t.create_element("b");
    if b == a {
        // Slot was reused (normal case because free_list pops newest).
        assert_eq!(t.local_name(b), Some("b"));
        // The stale `a` reference now silently returns `b`'s data.
        // This is the documented footgun.
        assert_eq!(t.local_name(a), Some("b"));
    } else {
        // Different id — free_list was empty or a different path ran.
        // Either way, stale `a` is still None.
        assert_eq!(t.local_name(a), None);
    }
}

#[test]
fn operations_on_invalid_id_never_panic() {
    let t = Tree::new();
    // Valid-looking but never-allocated ids (out of range).
    let fake = 999_999u32;
    assert_eq!(t.local_name(fake), None);
    assert_eq!(t.node_kind(fake), None);
    assert_eq!(t.node_type(fake), None);
    assert_eq!(t.parent_node(fake), NODE_ID_INVALID);
    assert_eq!(t.first_child(fake), NODE_ID_INVALID);
    assert_eq!(t.last_child(fake), NODE_ID_INVALID);
    assert_eq!(t.next_sibling(fake), NODE_ID_INVALID);
    assert_eq!(t.children(fake), &[] as &[u32]);
    // NODE_ID_INVALID (0) is specifically reserved.
    assert_eq!(t.local_name(NODE_ID_INVALID), None);
}

#[test]
fn mutation_errors_on_stale_id() {
    // Mutating ops return Err, they don't corrupt state.
    let mut t = Tree::new();
    let a = t.create_element("a");
    t.free_node(a);
    // `a` is now stale (slot None).
    assert!(t.set_attribute(a, "x", "1").is_err());
    assert!(t.remove_attribute(a, "x").is_err());
    assert!(t.set_text_content(a, "hi".into()).is_err());
    assert!(t.set_node_data(a, "hi".into()).is_err());
    assert!(t.focus(a).is_err());
    // blur and free are no-ops for invalid ids (defensive).
    t.blur(a);
    t.free_node(a);
}
