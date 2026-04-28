//! H8: HTML attribute names are case-insensitive.
//!
//! Spec: HTML spec requires that `Element.setAttribute(name)` on an
//! element in the HTML namespace lowercase the name before storing.
//! Reads (`getAttribute`, `hasAttribute`, `removeAttribute`) must also
//! be case-insensitive for HTML elements.
//!
//! SVG (non-HTML namespace) preserves case.

use perrr_dom::Tree;

const HTML_NS: &str = "http://www.w3.org/1999/xhtml";
const SVG_NS: &str = "http://www.w3.org/2000/svg";

#[test]
fn html_attribute_name_is_lowercased_on_set() {
    let mut t = Tree::new();
    let el = t.create_element("div");
    t.set_attribute(el, "Data-State", "open").unwrap();
    // Stored name is lowercase.
    assert_eq!(t.get_attribute(el, "data-state"), Some("open"));
    // Lookup with original case also hits (case-insensitive read).
    assert_eq!(t.get_attribute(el, "Data-State"), Some("open"));
    // All-caps lookup too.
    assert_eq!(t.get_attribute(el, "DATA-STATE"), Some("open"));
    // Name list should contain the lowercased form.
    let names = t.attribute_names(el);
    assert_eq!(names, vec!["data-state".to_string()]);
}

#[test]
fn html_has_attribute_case_insensitive() {
    let mut t = Tree::new();
    let el = t.create_element("button");
    t.set_attribute(el, "ARIA-Expanded", "true").unwrap();
    assert!(t.has_attribute(el, "aria-expanded"));
    assert!(t.has_attribute(el, "ARIA-EXPANDED"));
    assert!(!t.has_attribute(el, "aria-collapsed"));
}

#[test]
fn html_remove_attribute_case_insensitive() {
    let mut t = Tree::new();
    let el = t.create_element("span");
    t.set_attribute(el, "Data-X", "1").unwrap();
    assert!(t.has_attribute(el, "data-x"));
    t.remove_attribute(el, "DATA-X").unwrap();
    assert!(!t.has_attribute(el, "data-x"));
}

#[test]
fn svg_attribute_name_preserves_case() {
    let mut t = Tree::new();
    let el = t.create_element_ns(SVG_NS, "svg");
    t.set_attribute(el, "viewBox", "0 0 100 100").unwrap();
    assert_eq!(t.get_attribute(el, "viewBox"), Some("0 0 100 100"));
    // Lowercase lookup must NOT hit on SVG.
    assert_eq!(t.get_attribute(el, "viewbox"), None);
    assert!(!t.has_attribute(el, "viewbox"));
    assert!(t.has_attribute(el, "viewBox"));
}

#[test]
fn html_value_is_not_lowercased() {
    // Only NAMES are normalized; VALUES are preserved as given.
    let mut t = Tree::new();
    let el = t.create_element("div");
    t.set_attribute(el, "title", "Mixed Case VALUE").unwrap();
    assert_eq!(t.get_attribute(el, "title"), Some("Mixed Case VALUE"));
    let _html_ns = HTML_NS; // silence unused
}
