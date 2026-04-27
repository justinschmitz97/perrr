//! Rust-side smoke test for perrr-node.
//!
//! Spec: `specs/crates/perrr-node/spec.md`
//! Milestone: `specs/milestones/m1-workspace-skeleton.md`

#[test]
fn hello_returns_ok() {
    assert_eq!(perrr_node::hello(), "ok");
}
