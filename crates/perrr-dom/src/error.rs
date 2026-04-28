use thiserror::Error;

use crate::node::NodeId;

#[derive(Debug, Error)]
pub enum DomError {
    #[error("invalid node id: {0}")]
    InvalidNode(NodeId),

    #[error("node {child} is not a child of {parent}")]
    NotAChild { parent: NodeId, child: NodeId },

    #[error("cannot add {child} to {parent}: would create a cycle")]
    WouldCycle { parent: NodeId, child: NodeId },

    #[error("reference node {0} not found in target parent")]
    ReferenceNotInParent(NodeId),

    #[error("operation not permitted on node of kind {0:?}")]
    WrongKind(crate::node::NodeKind),
}
