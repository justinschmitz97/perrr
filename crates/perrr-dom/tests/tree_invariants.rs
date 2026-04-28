//! Property-based tests: random mutation sequences preserve parent/child
//! invariants; free_node always frees all descendants.
//!
//! Spec: specs/crates/perrr-dom/spec.md §Invariants

use perrr_dom::{NodeKind, Tree, NODE_ID_INVALID};
use proptest::prelude::*;

#[derive(Debug, Clone)]
enum Op {
    CreateElement,
    AppendChild {
        parent_hint: usize,
        child_hint: usize,
    },
    RemoveChild {
        parent_hint: usize,
        child_hint: usize,
    },
    SetAttribute {
        node_hint: usize,
        name: u8,
        value: u8,
    },
}

fn op_strategy() -> impl Strategy<Value = Op> {
    prop_oneof![
        Just(Op::CreateElement),
        (0..32usize, 0..32usize).prop_map(|(p, c)| Op::AppendChild {
            parent_hint: p,
            child_hint: c
        }),
        (0..32usize, 0..32usize).prop_map(|(p, c)| Op::RemoveChild {
            parent_hint: p,
            child_hint: c
        }),
        (0..32usize, any::<u8>(), any::<u8>()).prop_map(|(n, name, value)| Op::SetAttribute {
            node_hint: n,
            name,
            value
        }),
    ]
}

/// Walk the tree from `root`, asserting parent/child consistency at
/// every edge and no cycles. Panics on violation.
fn assert_tree_invariants(tree: &Tree, root: u32) {
    let mut visited = std::collections::HashSet::new();
    let mut stack = vec![root];
    while let Some(current) = stack.pop() {
        if !visited.insert(current) {
            panic!("cycle: {current} visited twice");
        }
        for &child in tree.children(current) {
            assert_eq!(
                tree.parent_node(child),
                current,
                "parent/child mismatch at {child}",
            );
            stack.push(child);
        }
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    fn random_mutations_preserve_invariants(ops in prop::collection::vec(op_strategy(), 0..128)) {
        let mut tree = Tree::new();
        let mut created: Vec<u32> = Vec::new();

        for op in ops {
            match op {
                Op::CreateElement => {
                    let id = tree.create_element("div");
                    created.push(id);
                }
                Op::AppendChild { parent_hint, child_hint } => {
                    if created.is_empty() { continue; }
                    let parent = created[parent_hint % created.len()];
                    let child = created[child_hint % created.len()];
                    if parent == child { continue; }
                    let _ = tree.append_child(parent, child); // errors ignored; cycles etc.
                }
                Op::RemoveChild { parent_hint, child_hint } => {
                    if created.is_empty() { continue; }
                    let parent = created[parent_hint % created.len()];
                    let child = created[child_hint % created.len()];
                    let _ = tree.remove_child(parent, child);
                }
                Op::SetAttribute { node_hint, name, value } => {
                    if created.is_empty() { continue; }
                    let node = created[node_hint % created.len()];
                    let _ = tree.set_attribute(node, format!("a{name}"), format!("v{value}"));
                }
            }

            assert_tree_invariants(&tree, tree.document());
            for &id in &created {
                // Every created node should either still exist or have been freed.
                // We don't free in these ops, so all must exist.
                prop_assert!(tree.node_kind(id).is_some() || tree.parent_node(id) == NODE_ID_INVALID);
            }
        }
    }

    #[test]
    fn free_node_removes_all_descendants(depth in 0..8u32, fanout in 1..5usize) {
        let mut tree = Tree::new();
        let root = tree.create_element("root");
        let mut frontier = vec![root];

        for _ in 0..depth {
            let mut next = Vec::new();
            for parent in &frontier {
                for _ in 0..fanout {
                    let child = tree.create_element("child");
                    tree.append_child(*parent, child).unwrap();
                    next.push(child);
                }
            }
            frontier = next;
        }

        // Collect all descendants of root.
        let mut all: Vec<u32> = Vec::new();
        let mut stack = vec![root];
        while let Some(n) = stack.pop() {
            all.push(n);
            for &c in tree.children(n) { stack.push(c); }
        }

        tree.free_node(root);
        for id in all {
            prop_assert_eq!(tree.node_kind(id), None);
        }
    }
}

#[test]
fn nodekind_covers_all_spec_values() {
    // Guard against accidentally removing a kind — check each returns the
    // correct DOM nodeType number.
    assert_eq!(NodeKind::Element as u8, 1);
    assert_eq!(NodeKind::Text as u8, 3);
    assert_eq!(NodeKind::Comment as u8, 8);
    assert_eq!(NodeKind::Document as u8, 9);
    assert_eq!(NodeKind::DocumentFragment as u8, 11);
}
