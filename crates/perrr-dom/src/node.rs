/// u32 handle into a `Tree`. Reused after free (no generation counter at
/// v0.1). Value `0` is reserved for "no node" and will never be returned
/// by `Tree::create_*`.
pub type NodeId = u32;

pub const NODE_ID_INVALID: NodeId = 0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum NodeKind {
    /// DOM `nodeType` 1.
    Element = 1,
    /// DOM `nodeType` 3.
    Text = 3,
    /// DOM `nodeType` 8.
    Comment = 8,
    /// DOM `nodeType` 9.
    Document = 9,
    /// DOM `nodeType` 11.
    DocumentFragment = 11,
}

impl NodeKind {
    pub fn node_type(self) -> u8 {
        self as u8
    }
}

#[derive(Debug, Clone)]
pub struct Attr {
    pub name: String,
    pub value: String,
}

/// Small-vec-like. Linear scan; DOM elements rarely exceed ~10 attrs.
pub type AttrList = Vec<Attr>;

/// Registered event listener. Identity across the JS↔native boundary
/// is the (event_type, listener_id, capture) tuple — matches DOM spec's
/// deduplication rules for addEventListener.
#[derive(Debug, Clone)]
pub struct Listener {
    pub id: u32,
    pub event_type: String,
    pub capture: bool,
    pub once: bool,
    pub passive: bool,
}

#[derive(Debug)]
pub(crate) struct Node {
    pub kind: NodeKind,
    pub parent: NodeId,
    pub children: Vec<NodeId>,
    pub local_name: String,
    pub namespace_uri: String,
    pub attributes: AttrList,
    pub text: String,
    /// Registered event listeners. `listener_count(id)` returns
    /// `listeners.len() as u32`. Drives the M8 listener metric.
    pub listeners: Vec<Listener>,
}

impl Node {
    pub fn element(local_name: String, namespace_uri: String) -> Self {
        Self {
            kind: NodeKind::Element,
            parent: NODE_ID_INVALID,
            children: Vec::new(),
            local_name,
            namespace_uri,
            attributes: AttrList::new(),
            text: String::new(),
            listeners: Vec::new(),
        }
    }

    pub fn text(data: String) -> Self {
        Self {
            kind: NodeKind::Text,
            parent: NODE_ID_INVALID,
            children: Vec::new(),
            local_name: String::new(),
            namespace_uri: String::new(),
            attributes: AttrList::new(),
            text: data,
            listeners: Vec::new(),
        }
    }

    pub fn comment(data: String) -> Self {
        Self {
            kind: NodeKind::Comment,
            parent: NODE_ID_INVALID,
            children: Vec::new(),
            local_name: String::new(),
            namespace_uri: String::new(),
            attributes: AttrList::new(),
            text: data,
            listeners: Vec::new(),
        }
    }

    pub fn document() -> Self {
        Self {
            kind: NodeKind::Document,
            parent: NODE_ID_INVALID,
            children: Vec::new(),
            local_name: String::new(),
            namespace_uri: String::new(),
            attributes: AttrList::new(),
            text: String::new(),
            listeners: Vec::new(),
        }
    }

    pub fn document_fragment() -> Self {
        Self {
            kind: NodeKind::DocumentFragment,
            parent: NODE_ID_INVALID,
            children: Vec::new(),
            local_name: String::new(),
            namespace_uri: String::new(),
            attributes: AttrList::new(),
            text: String::new(),
            listeners: Vec::new(),
        }
    }
}
