//! Spec: specs/crates/perrr-dom/spec.md §selector subset

use perrr_dom::{parse_selector, Tree};

fn make(tree: &mut Tree, tag: &str, attrs: &[(&str, &str)], parent: u32) -> u32 {
    let el = tree.create_element(tag);
    for (k, v) in attrs {
        tree.set_attribute(el, *k, *v).unwrap();
    }
    tree.append_child(parent, el).unwrap();
    el
}

#[test]
fn matches_type_class_id() {
    let mut t = Tree::new();
    let body = t.children(t.children(t.document())[0])[1];
    let el = make(&mut t, "div", &[("class", "a b c"), ("id", "the-id")], body);

    assert!(t.matches(el, &parse_selector("div").unwrap()));
    assert!(t.matches(el, &parse_selector("*").unwrap()));
    assert!(t.matches(el, &parse_selector(".a").unwrap()));
    assert!(t.matches(el, &parse_selector(".b").unwrap()));
    assert!(t.matches(el, &parse_selector("#the-id").unwrap()));
    assert!(t.matches(el, &parse_selector(".a.b.c").unwrap()));
    assert!(t.matches(el, &parse_selector("div.a#the-id").unwrap()));
    assert!(!t.matches(el, &parse_selector("span").unwrap()));
    assert!(!t.matches(el, &parse_selector(".d").unwrap()));
}

#[test]
fn matches_attribute_operators() {
    let mut t = Tree::new();
    let body = t.children(t.children(t.document())[0])[1];
    let el = make(
        &mut t,
        "a",
        &[
            ("href", "https://example.com/docs"),
            ("rel", "noopener noreferrer"),
            ("data-state", "open"),
        ],
        body,
    );

    assert!(t.matches(el, &parse_selector("[href]").unwrap()));
    assert!(t.matches(
        el,
        &parse_selector("[href=\"https://example.com/docs\"]").unwrap()
    ));
    assert!(t.matches(el, &parse_selector("[href^=\"https\"]").unwrap()));
    assert!(t.matches(el, &parse_selector("[href$=\"/docs\"]").unwrap()));
    assert!(t.matches(el, &parse_selector("[href*=\"example\"]").unwrap()));
    assert!(t.matches(el, &parse_selector("[rel~=noopener]").unwrap()));
    assert!(t.matches(el, &parse_selector("[data-state=open]").unwrap()));
    assert!(!t.matches(el, &parse_selector("[data-state=closed]").unwrap()));
    assert!(!t.matches(el, &parse_selector("[rel~=opener]").unwrap()));
}

#[test]
fn matches_not() {
    let mut t = Tree::new();
    let body = t.children(t.children(t.document())[0])[1];
    let a = make(&mut t, "button", &[("type", "button")], body);
    let b = make(&mut t, "button", &[("type", "submit")], body);

    let sel = parse_selector("button:not([type=submit])").unwrap();
    assert!(t.matches(a, &sel));
    assert!(!t.matches(b, &sel));
}

#[test]
fn descendant_and_child_combinators() {
    let mut t = Tree::new();
    let body = t.children(t.children(t.document())[0])[1];
    let outer = make(&mut t, "section", &[("class", "wrapper")], body);
    let mid = make(&mut t, "div", &[], outer);
    let inner = make(&mut t, "span", &[("class", "target")], mid);

    assert!(t.matches(inner, &parse_selector(".wrapper span").unwrap()));
    assert!(t.matches(inner, &parse_selector("section > div > span").unwrap()));
    assert!(!t.matches(inner, &parse_selector("section > span").unwrap())); // direct child only
    assert!(t.matches(inner, &parse_selector("section span.target").unwrap()));
}

#[test]
fn sibling_combinators() {
    let mut t = Tree::new();
    let body = t.children(t.children(t.document())[0])[1];
    let a = make(&mut t, "a", &[], body);
    let b = make(&mut t, "b", &[], body);
    let c = make(&mut t, "c", &[], body);

    assert!(t.matches(b, &parse_selector("a + b").unwrap()));
    assert!(t.matches(c, &parse_selector("a ~ c").unwrap()));
    assert!(!t.matches(c, &parse_selector("a + c").unwrap()));
    let _ = a; // silence unused
}

#[test]
fn selector_list_matches_any() {
    let mut t = Tree::new();
    let body = t.children(t.children(t.document())[0])[1];
    let el = make(&mut t, "div", &[], body);
    let sel = parse_selector("span, div, p").unwrap();
    assert!(t.matches(el, &sel));
}

#[test]
fn query_selector_returns_first() {
    let mut t = Tree::new();
    let body = t.children(t.children(t.document())[0])[1];
    let a = make(&mut t, "div", &[("class", "x")], body);
    let _b = make(&mut t, "div", &[("class", "x")], body);
    let sel = parse_selector(".x").unwrap();
    assert_eq!(t.query_selector(t.document(), &sel), Some(a));
}

#[test]
fn query_selector_all_preorder() {
    let mut t = Tree::new();
    let body = t.children(t.children(t.document())[0])[1];
    let a = make(&mut t, "div", &[("class", "x")], body);
    let b = make(&mut t, "div", &[("class", "x")], body);
    let sel = parse_selector(".x").unwrap();
    assert_eq!(t.query_selector_all(t.document(), &sel), vec![a, b]);
}

#[test]
fn closest_walks_ancestors() {
    let mut t = Tree::new();
    let body = t.children(t.children(t.document())[0])[1];
    let outer = make(&mut t, "section", &[("class", "wrap")], body);
    let inner = make(&mut t, "span", &[], outer);
    let sel = parse_selector(".wrap").unwrap();
    assert_eq!(t.closest(inner, &sel), Some(outer));
    assert_eq!(
        t.closest(inner, &parse_selector(".not-there").unwrap()),
        None
    );
}

#[test]
fn pseudo_element_rejected() {
    assert!(parse_selector("p::first-line").is_err());
}

#[test]
fn unsupported_pseudo_rejected() {
    assert!(parse_selector(":hover").is_err());
    assert!(parse_selector(":nth-child(2)").is_err());
}
