//! Tree storage + public ops.
//!
//! Storage model: `Vec<Option<Node>>` with a free list. `NodeId` is
//! the 1-based index into the vec; `0` is reserved as the invalid id
//! returned when a node has no parent (see `NODE_ID_INVALID`).
//!
//! Reuse after free is allowed and does not bump a generation counter.
//! The single-threaded, per-test lifetime makes ABA safe in practice
//! (tests reset between runs). A generation layer may be added in a
//! later milestone if benchmarks surface false-positive matches.

use crate::error::DomError;
use crate::node::{Attr, Node, NodeId, NodeKind, NODE_ID_INVALID};

const HTML_NS: &str = "http://www.w3.org/1999/xhtml";

#[derive(Debug)]
pub struct Tree {
    nodes: Vec<Option<Node>>,
    free_list: Vec<NodeId>,
    document: NodeId,
    active_element: NodeId,
}

impl Default for Tree {
    fn default() -> Self {
        Self::new()
    }
}

impl Tree {
    /// Create a fresh tree with a Document root and `<html><head></head><body></body></html>`.
    pub fn new() -> Self {
        let mut tree = Self {
            // Index 0 is reserved for NODE_ID_INVALID.
            nodes: vec![None],
            free_list: Vec::new(),
            document: NODE_ID_INVALID,
            active_element: NODE_ID_INVALID,
        };
        let document = tree.insert(Node::document());
        let html = tree.insert(Node::element("html".into(), HTML_NS.into()));
        let head = tree.insert(Node::element("head".into(), HTML_NS.into()));
        let body = tree.insert(Node::element("body".into(), HTML_NS.into()));
        tree.document = document;
        // Wire up document > html > {head, body}.
        tree.link(document, html);
        tree.link(html, head);
        tree.link(html, body);
        tree
    }

    // --------------------------------------------------------------
    // Roots + identity
    // --------------------------------------------------------------

    pub fn document(&self) -> NodeId {
        self.document
    }

    /// Owner document. For the Document itself, returns the Document.
    /// For a node in the tree, returns the Document root.
    pub fn owner_document(&self, _node: NodeId) -> NodeId {
        // v0.1: single-document trees; every live node's owner is `self.document`.
        // Detached nodes (no parent chain to Document) still report the
        // Document as owner, matching browser behavior for nodes created
        // via `document.createElement(...)`.
        self.document
    }

    /// Deepest ancestor. For a detached node, returns the node itself.
    pub fn root_node(&self, node: NodeId) -> NodeId {
        let mut current = node;
        loop {
            let parent = self
                .node(current)
                .map(|n| n.parent)
                .unwrap_or(NODE_ID_INVALID);
            if parent == NODE_ID_INVALID {
                return current;
            }
            current = parent;
        }
    }

    pub fn active_element(&self) -> NodeId {
        self.active_element
    }

    // --------------------------------------------------------------
    // Node creation
    // --------------------------------------------------------------

    pub fn create_element(&mut self, local_name: impl Into<String>) -> NodeId {
        self.insert(Node::element(local_name.into(), HTML_NS.into()))
    }

    pub fn create_element_ns(
        &mut self,
        namespace: impl Into<String>,
        local_name: impl Into<String>,
    ) -> NodeId {
        self.insert(Node::element(local_name.into(), namespace.into()))
    }

    pub fn create_text_node(&mut self, data: impl Into<String>) -> NodeId {
        self.insert(Node::text(data.into()))
    }

    pub fn create_comment(&mut self, data: impl Into<String>) -> NodeId {
        self.insert(Node::comment(data.into()))
    }

    pub fn create_document_fragment(&mut self) -> NodeId {
        self.insert(Node::document_fragment())
    }

    // --------------------------------------------------------------
    // Metadata reads
    // --------------------------------------------------------------

    pub fn node_kind(&self, id: NodeId) -> Option<NodeKind> {
        self.node(id).map(|n| n.kind)
    }

    pub fn node_type(&self, id: NodeId) -> Option<u8> {
        self.node_kind(id).map(|k| k.node_type())
    }

    pub fn local_name(&self, id: NodeId) -> Option<&str> {
        self.node(id).map(|n| n.local_name.as_str())
    }

    /// `tagName` per DOM spec: upper-case local name for HTML elements.
    pub fn tag_name(&self, id: NodeId) -> Option<String> {
        self.node(id).map(|n| {
            if matches!(n.kind, NodeKind::Element) && n.namespace_uri == HTML_NS {
                n.local_name.to_ascii_uppercase()
            } else {
                n.local_name.clone()
            }
        })
    }

    pub fn namespace_uri(&self, id: NodeId) -> Option<&str> {
        self.node(id).map(|n| n.namespace_uri.as_str())
    }

    /// `nodeName` per DOM spec: `tagName` for elements, `"#text"` for
    /// text nodes, `"#comment"` for comments, `"#document"` for
    /// document, `"#document-fragment"` for fragments.
    pub fn node_name(&self, id: NodeId) -> Option<String> {
        self.node(id).map(|n| match n.kind {
            NodeKind::Element => {
                if n.namespace_uri == HTML_NS {
                    n.local_name.to_ascii_uppercase()
                } else {
                    n.local_name.clone()
                }
            }
            NodeKind::Text => "#text".into(),
            NodeKind::Comment => "#comment".into(),
            NodeKind::Document => "#document".into(),
            NodeKind::DocumentFragment => "#document-fragment".into(),
        })
    }

    // --------------------------------------------------------------
    // Attribute ops
    // --------------------------------------------------------------

    pub fn get_attribute(&self, id: NodeId, name: &str) -> Option<&str> {
        let node = self.node(id)?;
        node.attributes
            .iter()
            .find(|a| a.name == name)
            .map(|a| a.value.as_str())
    }

    pub fn has_attribute(&self, id: NodeId, name: &str) -> bool {
        self.node(id)
            .map(|n| n.attributes.iter().any(|a| a.name == name))
            .unwrap_or(false)
    }

    pub fn set_attribute(
        &mut self,
        id: NodeId,
        name: impl Into<String>,
        value: impl Into<String>,
    ) -> Result<(), DomError> {
        let name = name.into();
        let value = value.into();
        let node = self.node_mut(id).ok_or(DomError::InvalidNode(id))?;
        if let Some(existing) = node.attributes.iter_mut().find(|a| a.name == name) {
            existing.value = value;
        } else {
            node.attributes.push(Attr { name, value });
        }
        Ok(())
    }

    pub fn remove_attribute(&mut self, id: NodeId, name: &str) -> Result<(), DomError> {
        let node = self.node_mut(id).ok_or(DomError::InvalidNode(id))?;
        node.attributes.retain(|a| a.name != name);
        Ok(())
    }

    pub fn attribute_names(&self, id: NodeId) -> Vec<String> {
        self.node(id)
            .map(|n| n.attributes.iter().map(|a| a.name.clone()).collect())
            .unwrap_or_default()
    }

    pub fn id_attr(&self, id: NodeId) -> Option<&str> {
        self.get_attribute(id, "id")
    }

    // --------------------------------------------------------------
    // Tree walking
    // --------------------------------------------------------------

    pub fn parent_node(&self, id: NodeId) -> NodeId {
        self.node(id).map(|n| n.parent).unwrap_or(NODE_ID_INVALID)
    }

    pub fn parent_element(&self, id: NodeId) -> NodeId {
        let parent = self.parent_node(id);
        if parent == NODE_ID_INVALID {
            return NODE_ID_INVALID;
        }
        if matches!(self.node_kind(parent), Some(NodeKind::Element)) {
            parent
        } else {
            NODE_ID_INVALID
        }
    }

    pub fn children(&self, id: NodeId) -> &[NodeId] {
        self.node(id).map(|n| n.children.as_slice()).unwrap_or(&[])
    }

    pub fn first_child(&self, id: NodeId) -> NodeId {
        self.children(id)
            .first()
            .copied()
            .unwrap_or(NODE_ID_INVALID)
    }

    pub fn last_child(&self, id: NodeId) -> NodeId {
        self.children(id).last().copied().unwrap_or(NODE_ID_INVALID)
    }

    pub fn next_sibling(&self, id: NodeId) -> NodeId {
        let parent = self.parent_node(id);
        if parent == NODE_ID_INVALID {
            return NODE_ID_INVALID;
        }
        let siblings = self.children(parent);
        let pos = siblings.iter().position(|&s| s == id);
        match pos {
            Some(i) if i + 1 < siblings.len() => siblings[i + 1],
            _ => NODE_ID_INVALID,
        }
    }

    pub fn previous_sibling(&self, id: NodeId) -> NodeId {
        let parent = self.parent_node(id);
        if parent == NODE_ID_INVALID {
            return NODE_ID_INVALID;
        }
        let siblings = self.children(parent);
        let pos = siblings.iter().position(|&s| s == id);
        match pos {
            Some(i) if i > 0 => siblings[i - 1],
            _ => NODE_ID_INVALID,
        }
    }

    pub fn contains(&self, ancestor: NodeId, descendant: NodeId) -> bool {
        if ancestor == descendant {
            return true;
        }
        let mut current = descendant;
        while current != NODE_ID_INVALID {
            if current == ancestor {
                return true;
            }
            current = self.parent_node(current);
        }
        false
    }

    // --------------------------------------------------------------
    // Tree mutation
    // --------------------------------------------------------------

    /// `parent.appendChild(child)`. Removes `child` from its current
    /// parent first. Returns `DomError::WouldCycle` if `child` is an
    /// ancestor of `parent`.
    pub fn append_child(&mut self, parent: NodeId, child: NodeId) -> Result<(), DomError> {
        self.validate(parent)?;
        self.validate(child)?;
        if self.contains(child, parent) {
            return Err(DomError::WouldCycle { parent, child });
        }
        self.detach(child);
        self.link(parent, child);
        Ok(())
    }

    pub fn insert_before(
        &mut self,
        parent: NodeId,
        new_child: NodeId,
        reference: NodeId,
    ) -> Result<(), DomError> {
        self.validate(parent)?;
        self.validate(new_child)?;
        if reference == NODE_ID_INVALID {
            return self.append_child(parent, new_child);
        }
        self.validate(reference)?;
        if !self.children(parent).contains(&reference) {
            return Err(DomError::ReferenceNotInParent(reference));
        }
        if self.contains(new_child, parent) {
            return Err(DomError::WouldCycle {
                parent,
                child: new_child,
            });
        }
        self.detach(new_child);
        // Re-fetch ref_pos after detach; detach may shift positions if
        // new_child was previously a sibling of reference.
        let ref_pos = self
            .children(parent)
            .iter()
            .position(|&s| s == reference)
            .ok_or(DomError::ReferenceNotInParent(reference))?;
        self.node_mut(parent)
            .expect("parent validated")
            .children
            .insert(ref_pos, new_child);
        self.node_mut(new_child).expect("child validated").parent = parent;
        Ok(())
    }

    pub fn remove_child(&mut self, parent: NodeId, child: NodeId) -> Result<(), DomError> {
        self.validate(parent)?;
        self.validate(child)?;
        let pos = self
            .children(parent)
            .iter()
            .position(|&s| s == child)
            .ok_or(DomError::NotAChild { parent, child })?;
        self.node_mut(parent)
            .expect("parent validated")
            .children
            .remove(pos);
        self.node_mut(child).expect("child validated").parent = NODE_ID_INVALID;
        Ok(())
    }

    /// Recursively frees `id` and all descendants.
    pub fn free_node(&mut self, id: NodeId) {
        if id == NODE_ID_INVALID || self.node(id).is_none() {
            return;
        }
        self.detach(id);
        let mut stack = vec![id];
        while let Some(current) = stack.pop() {
            if let Some(node) = self.nodes.get_mut(current as usize).and_then(|n| n.take()) {
                if self.active_element == current {
                    self.active_element = NODE_ID_INVALID;
                }
                for child in node.children {
                    stack.push(child);
                }
                self.free_list.push(current);
            }
        }
    }

    // --------------------------------------------------------------
    // Text content
    // --------------------------------------------------------------

    /// Get `textContent`: concatenation of all descendant Text nodes.
    pub fn text_content(&self, id: NodeId) -> String {
        let mut out = String::new();
        self.text_content_recursive(id, &mut out);
        out
    }

    fn text_content_recursive(&self, id: NodeId, out: &mut String) {
        let Some(node) = self.node(id) else { return };
        match node.kind {
            NodeKind::Text | NodeKind::Comment => out.push_str(&node.text),
            _ => {
                for child in &node.children {
                    self.text_content_recursive(*child, out);
                }
            }
        }
    }

    /// Set `textContent`: replace all children with a single Text child
    /// holding `value`. If `value` is empty, just clears children.
    pub fn set_text_content(&mut self, id: NodeId, value: String) -> Result<(), DomError> {
        self.validate(id)?;
        // Free existing children.
        let children = std::mem::take(&mut self.node_mut(id).expect("validated").children);
        for c in children {
            self.free_node(c);
        }
        if !value.is_empty() {
            let text_id = self.create_text_node(value);
            self.link(id, text_id);
        }
        Ok(())
    }

    /// Raw data on Text/Comment nodes.
    pub fn node_data(&self, id: NodeId) -> Option<&str> {
        self.node(id).map(|n| n.text.as_str())
    }

    pub fn set_node_data(&mut self, id: NodeId, value: String) -> Result<(), DomError> {
        let node = self.node_mut(id).ok_or(DomError::InvalidNode(id))?;
        if !matches!(node.kind, NodeKind::Text | NodeKind::Comment) {
            return Err(DomError::WrongKind(node.kind));
        }
        node.text = value;
        Ok(())
    }

    // --------------------------------------------------------------
    // Focus tracking
    // --------------------------------------------------------------

    pub fn focus(&mut self, id: NodeId) -> Result<(), DomError> {
        self.validate(id)?;
        if !matches!(self.node_kind(id), Some(NodeKind::Element)) {
            return Err(DomError::WrongKind(self.node_kind(id).unwrap()));
        }
        self.active_element = id;
        Ok(())
    }

    pub fn blur(&mut self, id: NodeId) {
        if self.active_element == id {
            self.active_element = NODE_ID_INVALID;
        }
    }

    // --------------------------------------------------------------
    // Listener counter (drives M8 metric)
    // --------------------------------------------------------------

    pub fn incr_listener(&mut self, id: NodeId) -> Result<(), DomError> {
        let node = self.node_mut(id).ok_or(DomError::InvalidNode(id))?;
        node.listener_count = node.listener_count.saturating_add(1);
        Ok(())
    }

    pub fn decr_listener(&mut self, id: NodeId) -> Result<(), DomError> {
        let node = self.node_mut(id).ok_or(DomError::InvalidNode(id))?;
        node.listener_count = node.listener_count.saturating_sub(1);
        Ok(())
    }

    pub fn listener_count(&self, id: NodeId) -> u32 {
        self.node(id).map(|n| n.listener_count).unwrap_or(0)
    }

    pub fn total_listener_count(&self) -> u32 {
        self.nodes
            .iter()
            .filter_map(|n| n.as_ref())
            .map(|n| n.listener_count)
            .sum()
    }

    // --------------------------------------------------------------
    // Internal helpers
    // --------------------------------------------------------------

    fn node(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(id as usize).and_then(|n| n.as_ref())
    }

    fn node_mut(&mut self, id: NodeId) -> Option<&mut Node> {
        self.nodes.get_mut(id as usize).and_then(|n| n.as_mut())
    }

    fn validate(&self, id: NodeId) -> Result<(), DomError> {
        if id == NODE_ID_INVALID || self.node(id).is_none() {
            Err(DomError::InvalidNode(id))
        } else {
            Ok(())
        }
    }

    fn insert(&mut self, node: Node) -> NodeId {
        if let Some(id) = self.free_list.pop() {
            self.nodes[id as usize] = Some(node);
            id
        } else {
            let id = self.nodes.len() as NodeId;
            self.nodes.push(Some(node));
            id
        }
    }

    /// Unlink `id` from its current parent without freeing anything.
    fn detach(&mut self, id: NodeId) {
        let parent = self.parent_node(id);
        if parent == NODE_ID_INVALID {
            return;
        }
        if let Some(parent_node) = self.node_mut(parent) {
            parent_node.children.retain(|&c| c != id);
        }
        if let Some(node) = self.node_mut(id) {
            node.parent = NODE_ID_INVALID;
        }
    }

    /// Append child to parent without cycle check (internal).
    fn link(&mut self, parent: NodeId, child: NodeId) {
        if let Some(p) = self.node_mut(parent) {
            p.children.push(child);
        }
        if let Some(c) = self.node_mut(child) {
            c.parent = parent;
        }
    }
}
