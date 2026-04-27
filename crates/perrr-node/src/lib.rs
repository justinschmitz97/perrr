//! perrr-node: napi-rs binding layer between Rust core and Node.js V8.
//!
//! Spec: `specs/crates/perrr-node/spec.md`

#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

/// Health check. Returns the string `"ok"`.
///
/// Contract defined in `specs/crates/perrr-node/spec.md`.
#[napi]
pub fn hello() -> String {
    "ok".to_string()
}
