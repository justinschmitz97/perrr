//! perrr-dom: native DOM tree with u32 handle identity.
//!
//! Spec: `specs/crates/perrr-dom/spec.md`
//! API coverage: `specs/overview/03-dom-api-coverage.md`
//!
//! This crate owns node identity. The tree is behavior-only at v0.1;
//! style, layout, and paint live in downstream crates (M3+).
//!
//! All operations are single-threaded by design: one Tree per V8
//! isolate, serialized at the N-API boundary.

#![deny(clippy::all)]

mod error;
mod node;
pub mod selector;
mod tree;

pub use error::DomError;
pub use node::{Attr, AttrList, Listener, NodeId, NodeKind, NODE_ID_INVALID};
pub use selector::{parse as parse_selector, ParseError as SelectorParseError, SelectorList};
pub use tree::Tree;
