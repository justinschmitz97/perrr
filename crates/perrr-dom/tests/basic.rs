//! Spec: specs/crates/perrr-dom/spec.md

use perrr_dom::{NodeKind, Tree, NODE_ID_INVALID};

#[test]
fn default_tree_has_document_html_head_body() {
    let tree = Tree::new();
    let doc = tree.document();
    assert_eq!(tree.node_kind(doc), Some(NodeKind::Document));

    let children = tree.children(doc);
    assert_eq!(children.len(), 1);
    let html = children[0];
    assert_eq!(tree.local_name(html), Some("html"));

    let html_children = tree.children(html);
    assert_eq!(html_children.len(), 2);
    assert_eq!(tree.local_name(html_children[0]), Some("head"));
    assert_eq!(tree.local_name(html_children[1]), Some("body"));
}

#[test]
fn tag_name_uppercases_html() {
    let mut tree = Tree::new();
    let div = tree.create_element("div");
    assert_eq!(tree.tag_name(div).as_deref(), Some("DIV"));
    assert_eq!(tree.local_name(div), Some("div"));
}

#[test]
fn node_type_matches_spec() {
    let mut tree = Tree::new();
    assert_eq!(tree.node_type(tree.document()), Some(9));
    let el = tree.create_element("span");
    assert_eq!(tree.node_type(el), Some(1));
    let text = tree.create_text_node("hi");
    assert_eq!(tree.node_type(text), Some(3));
    let comment = tree.create_comment("c");
    assert_eq!(tree.node_type(comment), Some(8));
    let frag = tree.create_document_fragment();
    assert_eq!(tree.node_type(frag), Some(11));
}

#[test]
fn attribute_round_trip() {
    let mut tree = Tree::new();
    let el = tree.create_element("button");
    assert!(!tree.has_attribute(el, "type"));
    tree.set_attribute(el, "type", "button").unwrap();
    assert_eq!(tree.get_attribute(el, "type"), Some("button"));
    assert!(tree.has_attribute(el, "type"));
    tree.set_attribute(el, "type", "submit").unwrap();
    assert_eq!(tree.get_attribute(el, "type"), Some("submit"));
    tree.remove_attribute(el, "type").unwrap();
    assert!(!tree.has_attribute(el, "type"));
    assert_eq!(tree.get_attribute(el, "type"), None);
}

#[test]
fn append_child_sets_parent_and_children() {
    let mut tree = Tree::new();
    let parent = tree.create_element("div");
    let child = tree.create_element("span");
    tree.append_child(parent, child).unwrap();
    assert_eq!(tree.parent_node(child), parent);
    assert_eq!(tree.children(parent), &[child]);
}

#[test]
fn append_child_moves_from_previous_parent() {
    let mut tree = Tree::new();
    let p1 = tree.create_element("div");
    let p2 = tree.create_element("div");
    let child = tree.create_element("span");
    tree.append_child(p1, child).unwrap();
    assert_eq!(tree.children(p1), &[child]);
    tree.append_child(p2, child).unwrap();
    assert_eq!(tree.children(p1).len(), 0);
    assert_eq!(tree.children(p2), &[child]);
    assert_eq!(tree.parent_node(child), p2);
}

#[test]
fn append_child_cycle_detection() {
    let mut tree = Tree::new();
    let a = tree.create_element("div");
    let b = tree.create_element("div");
    tree.append_child(a, b).unwrap();
    // Appending a as child of b would create a cycle.
    assert!(tree.append_child(b, a).is_err());
}

#[test]
fn insert_before_orders_correctly() {
    let mut tree = Tree::new();
    let parent = tree.create_element("div");
    let a = tree.create_element("a");
    let b = tree.create_element("b");
    let c = tree.create_element("i");
    tree.append_child(parent, a).unwrap();
    tree.append_child(parent, c).unwrap();
    tree.insert_before(parent, b, c).unwrap();
    assert_eq!(tree.children(parent), &[a, b, c]);
}

#[test]
fn remove_child_unlinks() {
    let mut tree = Tree::new();
    let parent = tree.create_element("div");
    let child = tree.create_element("span");
    tree.append_child(parent, child).unwrap();
    tree.remove_child(parent, child).unwrap();
    assert_eq!(tree.children(parent).len(), 0);
    assert_eq!(tree.parent_node(child), NODE_ID_INVALID);
}

#[test]
fn siblings_navigate_correctly() {
    let mut tree = Tree::new();
    let parent = tree.create_element("ul");
    let a = tree.create_element("li");
    let b = tree.create_element("li");
    let c = tree.create_element("li");
    tree.append_child(parent, a).unwrap();
    tree.append_child(parent, b).unwrap();
    tree.append_child(parent, c).unwrap();
    assert_eq!(tree.first_child(parent), a);
    assert_eq!(tree.last_child(parent), c);
    assert_eq!(tree.next_sibling(a), b);
    assert_eq!(tree.next_sibling(b), c);
    assert_eq!(tree.next_sibling(c), NODE_ID_INVALID);
    assert_eq!(tree.previous_sibling(c), b);
    assert_eq!(tree.previous_sibling(a), NODE_ID_INVALID);
}

#[test]
fn contains_walks_ancestors() {
    let mut tree = Tree::new();
    let root = tree.create_element("div");
    let mid = tree.create_element("div");
    let leaf = tree.create_element("span");
    tree.append_child(root, mid).unwrap();
    tree.append_child(mid, leaf).unwrap();
    assert!(tree.contains(root, leaf));
    assert!(tree.contains(mid, leaf));
    assert!(tree.contains(leaf, leaf));
    assert!(!tree.contains(leaf, root));
}

#[test]
fn root_node_of_detached_is_self() {
    let mut tree = Tree::new();
    let detached = tree.create_element("div");
    assert_eq!(tree.root_node(detached), detached);
}

#[test]
fn root_node_of_attached_is_document() {
    let tree = Tree::new();
    let html = tree.children(tree.document())[0];
    assert_eq!(tree.root_node(html), tree.document());
}

#[test]
fn text_content_concatenates() {
    let mut tree = Tree::new();
    let parent = tree.create_element("div");
    let t1 = tree.create_text_node("Hello, ");
    let span = tree.create_element("span");
    let t2 = tree.create_text_node("world");
    let t3 = tree.create_text_node("!");
    tree.append_child(parent, t1).unwrap();
    tree.append_child(parent, span).unwrap();
    tree.append_child(span, t2).unwrap();
    tree.append_child(parent, t3).unwrap();
    assert_eq!(tree.text_content(parent), "Hello, world!");
}

#[test]
fn set_text_content_replaces_children() {
    let mut tree = Tree::new();
    let parent = tree.create_element("div");
    let old = tree.create_element("span");
    tree.append_child(parent, old).unwrap();
    tree.set_text_content(parent, "new text".into()).unwrap();
    assert_eq!(tree.children(parent).len(), 1);
    let child = tree.children(parent)[0];
    assert_eq!(tree.node_kind(child), Some(NodeKind::Text));
    assert_eq!(tree.node_data(child), Some("new text"));
}

#[test]
fn free_node_recurses_and_clears_active_element() {
    let mut tree = Tree::new();
    let body = tree.children(tree.children(tree.document())[0])[1];
    let parent = tree.create_element("div");
    let child = tree.create_element("button");
    // Attach to body so the focused node is connected to the document.
    tree.append_child(body, parent).unwrap();
    tree.append_child(parent, child).unwrap();
    tree.focus(child).unwrap();
    assert_eq!(tree.active_element(), child);
    assert_eq!(tree.explicitly_focused(), child);
    tree.free_node(parent);
    assert_eq!(tree.node_kind(child), None);
    // Explicit focus cleared; activeElement falls back to body per HTML spec.
    assert_eq!(tree.explicitly_focused(), NODE_ID_INVALID);
    assert_eq!(tree.active_element(), body);
}

#[test]
fn focus_requires_element() {
    let mut tree = Tree::new();
    let text = tree.create_text_node("hi");
    assert!(tree.focus(text).is_err());
}

#[test]
fn blur_only_clears_if_active() {
    let mut tree = Tree::new();
    let body = tree.children(tree.children(tree.document())[0])[1];
    let a = tree.create_element("button");
    let b = tree.create_element("button");
    tree.append_child(body, a).unwrap();
    tree.append_child(body, b).unwrap();
    tree.focus(a).unwrap();
    tree.blur(b);
    assert_eq!(tree.active_element(), a);
    assert_eq!(tree.explicitly_focused(), a);
    tree.blur(a);
    // Explicit focus cleared; active_element falls back to body.
    assert_eq!(tree.explicitly_focused(), NODE_ID_INVALID);
    assert_eq!(tree.active_element(), body);
}

#[test]
fn active_element_defaults_to_body_per_spec() {
    let tree = Tree::new();
    let body = tree.children(tree.children(tree.document())[0])[1];
    assert_eq!(tree.explicitly_focused(), NODE_ID_INVALID);
    assert_eq!(tree.active_element(), body);
}

#[test]
fn disconnected_focused_element_falls_back_to_body() {
    // HTML spec: if the focused element is disconnected from the
    // document, browsers implicitly treat it as blurred.
    let mut tree = Tree::new();
    let body = tree.children(tree.children(tree.document())[0])[1];
    let btn = tree.create_element("button");
    tree.append_child(body, btn).unwrap();
    tree.focus(btn).unwrap();
    assert_eq!(tree.active_element(), btn);
    // Remove from body (still alive, but no longer in the document).
    tree.remove_child(body, btn).unwrap();
    assert_eq!(tree.explicitly_focused(), btn); // state retained
    assert_eq!(tree.active_element(), body); // but spec says body
    assert!(!tree.is_connected(btn));
}

#[test]
fn listener_counter_balances() {
    let mut tree = Tree::new();
    let el = tree.create_element("button");
    tree.incr_listener(el).unwrap();
    tree.incr_listener(el).unwrap();
    assert_eq!(tree.listener_count(el), 2);
    assert_eq!(tree.total_listener_count(), 2);
    tree.decr_listener(el).unwrap();
    assert_eq!(tree.listener_count(el), 1);
    tree.free_node(el);
    assert_eq!(tree.total_listener_count(), 0);
}
