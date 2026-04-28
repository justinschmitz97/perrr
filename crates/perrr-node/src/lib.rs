//! perrr-node: napi-rs binding layer between Rust core and Node.js V8.
//!
//! Spec: `specs/crates/perrr-node/spec.md`
//!
//! Surface at M2c (4d.ii):
//! - `hello() -> "ok"` (health check, carried over from M1)
//! - `PerrrDom` class wrapping `perrr_dom::Tree`
//!   - tree reads: documentId, nodeType, localName, tagName, nodeName,
//!     namespaceUri, parentNode, parentElement, ownerDocument,
//!     rootNode, children, firstChild, lastChild, nextSibling,
//!     previousSibling, contains
//!   - attribute ops: getAttribute, setAttribute, hasAttribute,
//!     removeAttribute, attributeNames, idAttr
//!   - tree mutation: createElement, createElementNS, createTextNode,
//!     createComment, createDocumentFragment, appendChild,
//!     insertBefore, removeChild, freeNode, setTextContent
//!   - text: textContent, nodeData, setNodeData
//!   - focus: focus, blur, activeElement
//!   - metrics: listenerCount, totalListenerCount, incrListener,
//!     decrListener

#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use napi::bindgen_prelude::*;
use perrr_dom::{NodeId, Tree};

/// Health check. Returns the string `"ok"`. Retained for M1 smoke test
/// compatibility.
#[napi]
pub fn hello() -> String {
    "ok".to_string()
}

#[napi(object)]
pub struct AttrRecord {
    pub name: String,
    pub value: String,
}

/// A perrr DOM tree. One instance per Vitest test context (created by
/// `vitest-environment-perrr` setup, disposed in teardown).
#[napi]
pub struct PerrrDom {
    tree: Tree,
}

impl Default for PerrrDom {
    fn default() -> Self {
        Self::new()
    }
}

#[napi]
impl PerrrDom {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self { tree: Tree::new() }
    }

    // ----- Roots + identity -----

    #[napi]
    pub fn document_id(&self) -> u32 {
        self.tree.document()
    }

    #[napi]
    pub fn owner_document(&self, node: u32) -> u32 {
        self.tree.owner_document(node)
    }

    #[napi]
    pub fn root_node(&self, node: u32) -> u32 {
        self.tree.root_node(node)
    }

    // ----- Node creation -----

    #[napi]
    pub fn create_element(&mut self, local_name: String) -> u32 {
        self.tree.create_element(local_name)
    }

    #[napi]
    pub fn create_element_ns(&mut self, namespace: String, local_name: String) -> u32 {
        self.tree.create_element_ns(namespace, local_name)
    }

    #[napi]
    pub fn create_text_node(&mut self, data: String) -> u32 {
        self.tree.create_text_node(data)
    }

    #[napi]
    pub fn create_comment(&mut self, data: String) -> u32 {
        self.tree.create_comment(data)
    }

    #[napi]
    pub fn create_document_fragment(&mut self) -> u32 {
        self.tree.create_document_fragment()
    }

    // ----- Metadata reads -----

    /// Returns the DOM `nodeType` (1 Element, 3 Text, 8 Comment, 9
    /// Document, 11 DocumentFragment) or `null` for an unknown id.
    #[napi]
    pub fn node_type(&self, node: u32) -> Option<u8> {
        self.tree.node_type(node)
    }

    #[napi]
    pub fn local_name(&self, node: u32) -> Option<String> {
        self.tree.local_name(node).map(|s| s.to_string())
    }

    #[napi]
    pub fn tag_name(&self, node: u32) -> Option<String> {
        self.tree.tag_name(node)
    }

    #[napi]
    pub fn namespace_uri(&self, node: u32) -> Option<String> {
        self.tree.namespace_uri(node).map(|s| s.to_string())
    }

    #[napi]
    pub fn node_name(&self, node: u32) -> Option<String> {
        self.tree.node_name(node)
    }

    // ----- Attribute ops -----

    #[napi]
    pub fn get_attribute(&self, node: u32, name: String) -> Option<String> {
        self.tree.get_attribute(node, &name).map(|s| s.to_string())
    }

    #[napi]
    pub fn has_attribute(&self, node: u32, name: String) -> bool {
        self.tree.has_attribute(node, &name)
    }

    #[napi]
    pub fn set_attribute(&mut self, node: u32, name: String, value: String) -> Result<()> {
        self.tree
            .set_attribute(node, name, value)
            .map_err(to_napi_err)
    }

    #[napi]
    pub fn remove_attribute(&mut self, node: u32, name: String) -> Result<()> {
        self.tree.remove_attribute(node, &name).map_err(to_napi_err)
    }

    #[napi]
    pub fn attribute_names(&self, node: u32) -> Vec<String> {
        self.tree.attribute_names(node)
    }

    #[napi]
    pub fn id_attr(&self, node: u32) -> Option<String> {
        self.tree.id_attr(node).map(|s| s.to_string())
    }

    // ----- Tree walking -----

    /// Returns the parent NodeId, or `0` for no parent (NODE_ID_INVALID).
    #[napi]
    pub fn parent_node(&self, node: u32) -> u32 {
        self.tree.parent_node(node)
    }

    /// Returns the parent if it's an Element, else `0`.
    #[napi]
    pub fn parent_element(&self, node: u32) -> u32 {
        self.tree.parent_element(node)
    }

    #[napi]
    pub fn children(&self, node: u32) -> Vec<u32> {
        self.tree.children(node).to_vec()
    }

    #[napi]
    pub fn first_child(&self, node: u32) -> u32 {
        self.tree.first_child(node)
    }

    #[napi]
    pub fn last_child(&self, node: u32) -> u32 {
        self.tree.last_child(node)
    }

    #[napi]
    pub fn next_sibling(&self, node: u32) -> u32 {
        self.tree.next_sibling(node)
    }

    #[napi]
    pub fn previous_sibling(&self, node: u32) -> u32 {
        self.tree.previous_sibling(node)
    }

    #[napi]
    pub fn contains(&self, ancestor: u32, descendant: u32) -> bool {
        self.tree.contains(ancestor, descendant)
    }

    // ----- Tree mutation -----

    #[napi]
    pub fn append_child(&mut self, parent: u32, child: u32) -> Result<()> {
        self.tree.append_child(parent, child).map_err(to_napi_err)
    }

    /// `reference == 0` appends to the end.
    #[napi]
    pub fn insert_before(&mut self, parent: u32, new_child: u32, reference: u32) -> Result<()> {
        self.tree
            .insert_before(parent, new_child, reference)
            .map_err(to_napi_err)
    }

    #[napi]
    pub fn remove_child(&mut self, parent: u32, child: u32) -> Result<()> {
        self.tree.remove_child(parent, child).map_err(to_napi_err)
    }

    #[napi]
    pub fn free_node(&mut self, node: u32) {
        self.tree.free_node(node);
    }

    // ----- Text content -----

    #[napi]
    pub fn text_content(&self, node: u32) -> String {
        self.tree.text_content(node)
    }

    #[napi]
    pub fn set_text_content(&mut self, node: u32, value: String) -> Result<()> {
        self.tree.set_text_content(node, value).map_err(to_napi_err)
    }

    #[napi]
    pub fn node_data(&self, node: u32) -> Option<String> {
        self.tree.node_data(node).map(|s| s.to_string())
    }

    #[napi]
    pub fn set_node_data(&mut self, node: u32, value: String) -> Result<()> {
        self.tree.set_node_data(node, value).map_err(to_napi_err)
    }

    // ----- Focus -----

    #[napi]
    pub fn focus(&mut self, node: u32) -> Result<()> {
        self.tree.focus(node).map_err(to_napi_err)
    }

    #[napi]
    pub fn blur(&mut self, node: u32) {
        self.tree.blur(node);
    }

    #[napi]
    pub fn active_element(&self) -> u32 {
        self.tree.active_element()
    }

    // ----- Listener metric -----

    #[napi]
    pub fn incr_listener(&mut self, node: u32) -> Result<()> {
        self.tree.incr_listener(node).map_err(to_napi_err)
    }

    #[napi]
    pub fn decr_listener(&mut self, node: u32) -> Result<()> {
        self.tree.decr_listener(node).map_err(to_napi_err)
    }

    #[napi]
    pub fn listener_count(&self, node: u32) -> u32 {
        self.tree.listener_count(node)
    }

    #[napi]
    pub fn total_listener_count(&self) -> u32 {
        self.tree.total_listener_count()
    }
}

fn to_napi_err(err: perrr_dom::DomError) -> Error {
    Error::new(Status::GenericFailure, err.to_string())
}

// Expose NodeId type alias on the Rust side so `perrr_node::hello`
// integration test remains usable.
pub type NodeIdAlias = NodeId;
