//! CSS selector subset sufficient for accordion fixture (RTL + radix +
//! motion). Hand-rolled rather than pulling in the full `selectors`
//! crate; keep the surface tight and fail-loud on the unsupported.
//!
//! Supported:
//! - Simple: `*`, `tag`, `.class`, `#id`, `[attr]`, `[attr="v"]`,
//!   `[attr=v]`, `[attr~=v]`, `[attr|=v]`, `[attr^=v]`, `[attr$=v]`,
//!   `[attr*=v]`, `:not(<compound>)`.
//! - Combinators: ` ` (descendant), `>` (child), `+` (adjacent sibling),
//!   `~` (general sibling).
//! - Selector list: `a, b, c`.
//!
//! Not supported (return `ParseError`): pseudo-elements (`::before`),
//! functional pseudo-classes other than `:not`, `:has`, `:is`, `:where`,
//! `:hover`/`:focus`/etc (no state tracking yet).

use crate::node::{NodeId, NodeKind};
use crate::tree::Tree;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AttrOp {
    /// `[attr]` — presence
    Present,
    /// `[attr=value]`
    Eq,
    /// `[attr~=value]` — whitespace-separated list contains
    Includes,
    /// `[attr|=value]` — equals value or starts with `value-`
    DashMatch,
    /// `[attr^=value]`
    Prefix,
    /// `[attr$=value]`
    Suffix,
    /// `[attr*=value]`
    Substring,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttrSelector {
    pub name: String,
    pub op: AttrOp,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Simple {
    Universal,
    Type(String),
    Class(String),
    Id(String),
    Attr(AttrSelector),
    Not(Compound),
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Compound {
    pub parts: Vec<Simple>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Combinator {
    Descendant,
    Child,
    Adjacent,
    Sibling,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Complex {
    /// Compounds in source order: left-to-right.
    pub compounds: Vec<Compound>,
    /// `combinators[i]` joins `compounds[i]` and `compounds[i+1]`.
    pub combinators: Vec<Combinator>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SelectorList(pub Vec<Complex>);

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("empty selector")]
    Empty,
    #[error("unexpected char {0:?} at pos {1}")]
    Unexpected(char, usize),
    #[error("unsupported feature: {0}")]
    Unsupported(&'static str),
    #[error("unterminated {0}")]
    Unterminated(&'static str),
}

// --------------------------------------------------------------
// Parser
// --------------------------------------------------------------

struct Parser<'a> {
    src: &'a [u8],
    pos: usize,
}

impl<'a> Parser<'a> {
    fn new(src: &'a str) -> Self {
        Self {
            src: src.as_bytes(),
            pos: 0,
        }
    }

    fn eof(&self) -> bool {
        self.pos >= self.src.len()
    }

    fn peek(&self) -> Option<u8> {
        self.src.get(self.pos).copied()
    }

    fn bump(&mut self) -> Option<u8> {
        let c = self.peek()?;
        self.pos += 1;
        Some(c)
    }

    fn skip_ws(&mut self) -> bool {
        let start = self.pos;
        while let Some(c) = self.peek() {
            if c == b' ' || c == b'\t' || c == b'\n' || c == b'\r' {
                self.pos += 1;
            } else {
                break;
            }
        }
        self.pos > start
    }

    fn read_ident(&mut self) -> String {
        let start = self.pos;
        while let Some(c) = self.peek() {
            if is_ident_continue(c) {
                self.pos += 1;
            } else {
                break;
            }
        }
        std::str::from_utf8(&self.src[start..self.pos])
            .unwrap_or_default()
            .to_string()
    }

    fn read_quoted(&mut self, quote: u8) -> Result<String, ParseError> {
        let mut out = String::new();
        self.pos += 1; // consume opening quote
        loop {
            match self.bump() {
                None => return Err(ParseError::Unterminated("string")),
                Some(c) if c == quote => return Ok(out),
                Some(b'\\') => {
                    if let Some(n) = self.bump() {
                        out.push(n as char);
                    } else {
                        return Err(ParseError::Unterminated("string escape"));
                    }
                }
                Some(c) => out.push(c as char),
            }
        }
    }

    fn parse_list(&mut self) -> Result<SelectorList, ParseError> {
        let mut list = Vec::new();
        loop {
            self.skip_ws();
            if self.eof() {
                break;
            }
            let complex = self.parse_complex()?;
            list.push(complex);
            self.skip_ws();
            match self.peek() {
                None => break,
                Some(b',') => {
                    self.pos += 1;
                }
                Some(c) => return Err(ParseError::Unexpected(c as char, self.pos)),
            }
        }
        if list.is_empty() {
            return Err(ParseError::Empty);
        }
        Ok(SelectorList(list))
    }

    fn parse_complex(&mut self) -> Result<Complex, ParseError> {
        let mut compounds = vec![self.parse_compound()?];
        let mut combinators = Vec::new();
        loop {
            let had_ws = self.skip_ws();
            let comb = match self.peek() {
                None | Some(b',') => break,
                Some(b'>') => {
                    self.pos += 1;
                    self.skip_ws();
                    Combinator::Child
                }
                Some(b'+') => {
                    self.pos += 1;
                    self.skip_ws();
                    Combinator::Adjacent
                }
                Some(b'~') => {
                    self.pos += 1;
                    self.skip_ws();
                    Combinator::Sibling
                }
                _ if had_ws => Combinator::Descendant,
                Some(c) => return Err(ParseError::Unexpected(c as char, self.pos)),
            };
            combinators.push(comb);
            compounds.push(self.parse_compound()?);
        }
        Ok(Complex {
            compounds,
            combinators,
        })
    }

    fn parse_compound(&mut self) -> Result<Compound, ParseError> {
        let mut parts = Vec::new();
        loop {
            match self.peek() {
                None => break,
                Some(b',' | b' ' | b'\t' | b'\n' | b'\r' | b'>' | b'+' | b'~' | b')') => break,
                Some(b'*') => {
                    self.pos += 1;
                    parts.push(Simple::Universal);
                }
                Some(b'.') => {
                    self.pos += 1;
                    let name = self.read_ident();
                    if name.is_empty() {
                        return Err(ParseError::Unexpected('.', self.pos - 1));
                    }
                    parts.push(Simple::Class(name));
                }
                Some(b'#') => {
                    self.pos += 1;
                    let name = self.read_ident();
                    if name.is_empty() {
                        return Err(ParseError::Unexpected('#', self.pos - 1));
                    }
                    parts.push(Simple::Id(name));
                }
                Some(b'[') => {
                    parts.push(Simple::Attr(self.parse_attr()?));
                }
                Some(b':') => {
                    self.pos += 1;
                    if self.peek() == Some(b':') {
                        return Err(ParseError::Unsupported("pseudo-element"));
                    }
                    let name = self.read_ident();
                    if name == "not" {
                        if self.peek() != Some(b'(') {
                            return Err(ParseError::Unexpected('?', self.pos));
                        }
                        self.pos += 1;
                        self.skip_ws();
                        let inner = self.parse_compound()?;
                        self.skip_ws();
                        if self.peek() != Some(b')') {
                            return Err(ParseError::Unterminated(":not"));
                        }
                        self.pos += 1;
                        parts.push(Simple::Not(inner));
                    } else {
                        return Err(ParseError::Unsupported("functional / state pseudo-class"));
                    }
                }
                Some(c) if is_ident_start(c) => {
                    let name = self.read_ident();
                    parts.push(Simple::Type(name));
                }
                Some(c) => return Err(ParseError::Unexpected(c as char, self.pos)),
            }
        }
        if parts.is_empty() {
            return Err(ParseError::Empty);
        }
        Ok(Compound { parts })
    }

    fn parse_attr(&mut self) -> Result<AttrSelector, ParseError> {
        // Enter on `[`
        self.pos += 1;
        self.skip_ws();
        let name = self.read_ident();
        if name.is_empty() {
            return Err(ParseError::Unexpected('[', self.pos - 1));
        }
        self.skip_ws();
        let mut op = AttrOp::Present;
        let mut value = String::new();
        match self.peek() {
            Some(b']') => {
                self.pos += 1;
            }
            Some(c) => {
                op = match c {
                    b'=' => {
                        self.pos += 1;
                        AttrOp::Eq
                    }
                    b'~' | b'|' | b'^' | b'$' | b'*' => {
                        self.pos += 1;
                        if self.peek() != Some(b'=') {
                            return Err(ParseError::Unexpected(c as char, self.pos - 1));
                        }
                        self.pos += 1;
                        match c {
                            b'~' => AttrOp::Includes,
                            b'|' => AttrOp::DashMatch,
                            b'^' => AttrOp::Prefix,
                            b'$' => AttrOp::Suffix,
                            b'*' => AttrOp::Substring,
                            _ => unreachable!(),
                        }
                    }
                    _ => return Err(ParseError::Unexpected(c as char, self.pos)),
                };
                self.skip_ws();
                value = match self.peek() {
                    Some(b'"') => self.read_quoted(b'"')?,
                    Some(b'\'') => self.read_quoted(b'\'')?,
                    Some(_) => self.read_ident(),
                    None => return Err(ParseError::Unterminated("attribute")),
                };
                self.skip_ws();
                // Skip optional case-insensitive flag `i` / `s` — treated as noop.
                if matches!(self.peek(), Some(b'i' | b's' | b'I' | b'S')) {
                    self.pos += 1;
                    self.skip_ws();
                }
                if self.peek() != Some(b']') {
                    return Err(ParseError::Unterminated("attribute"));
                }
                self.pos += 1;
            }
            None => return Err(ParseError::Unterminated("attribute")),
        }
        Ok(AttrSelector { name, op, value })
    }
}

fn is_ident_start(c: u8) -> bool {
    c.is_ascii_alphabetic() || c == b'_' || c == b'-'
}

fn is_ident_continue(c: u8) -> bool {
    c.is_ascii_alphanumeric() || c == b'_' || c == b'-'
}

pub fn parse(s: &str) -> Result<SelectorList, ParseError> {
    let mut p = Parser::new(s);
    p.parse_list()
}

// --------------------------------------------------------------
// Matcher
// --------------------------------------------------------------

pub fn matches(tree: &Tree, node: NodeId, list: &SelectorList) -> bool {
    list.0.iter().any(|c| matches_complex(tree, node, c))
}

fn matches_complex(tree: &Tree, node: NodeId, complex: &Complex) -> bool {
    // Right-to-left match: the rightmost compound must match `node`.
    let n = complex.compounds.len();
    if !matches_compound(tree, node, &complex.compounds[n - 1]) {
        return false;
    }
    let mut current = node;
    for i in (0..n - 1).rev() {
        let comb = complex.combinators[i];
        let compound = &complex.compounds[i];
        match comb {
            Combinator::Child => {
                let parent = tree.parent_node(current);
                if parent == 0 || !matches_compound(tree, parent, compound) {
                    return false;
                }
                current = parent;
            }
            Combinator::Descendant => {
                let mut p = tree.parent_node(current);
                loop {
                    if p == 0 {
                        return false;
                    }
                    if matches_compound(tree, p, compound) {
                        current = p;
                        break;
                    }
                    p = tree.parent_node(p);
                }
            }
            Combinator::Adjacent => {
                let prev = tree.previous_sibling(current);
                if prev == 0 || !matches_compound(tree, prev, compound) {
                    return false;
                }
                current = prev;
            }
            Combinator::Sibling => {
                let mut s = tree.previous_sibling(current);
                loop {
                    if s == 0 {
                        return false;
                    }
                    if matches_compound(tree, s, compound) {
                        current = s;
                        break;
                    }
                    s = tree.previous_sibling(s);
                }
            }
        }
    }
    true
}

fn matches_compound(tree: &Tree, node: NodeId, compound: &Compound) -> bool {
    if tree.node_kind(node) != Some(NodeKind::Element) {
        return false;
    }
    compound.parts.iter().all(|s| matches_simple(tree, node, s))
}

fn matches_simple(tree: &Tree, node: NodeId, simple: &Simple) -> bool {
    match simple {
        Simple::Universal => true,
        Simple::Type(t) => tree
            .local_name(node)
            .is_some_and(|n| n.eq_ignore_ascii_case(t)),
        Simple::Id(id) => tree.id_attr(node) == Some(id.as_str()),
        Simple::Class(cls) => tree
            .get_attribute(node, "class")
            .map(|c| c.split_ascii_whitespace().any(|p| p == cls))
            .unwrap_or(false),
        Simple::Attr(a) => match_attr(tree, node, a),
        Simple::Not(compound) => !matches_compound(tree, node, compound),
    }
}

fn match_attr(tree: &Tree, node: NodeId, a: &AttrSelector) -> bool {
    let Some(value) = tree.get_attribute(node, &a.name) else {
        return false;
    };
    match a.op {
        AttrOp::Present => true,
        AttrOp::Eq => value == a.value,
        AttrOp::Includes => value.split_ascii_whitespace().any(|p| p == a.value),
        AttrOp::DashMatch => value == a.value || value.starts_with(&format!("{}-", a.value)),
        AttrOp::Prefix => !a.value.is_empty() && value.starts_with(&a.value),
        AttrOp::Suffix => !a.value.is_empty() && value.ends_with(&a.value),
        AttrOp::Substring => !a.value.is_empty() && value.contains(&a.value),
    }
}

// --------------------------------------------------------------
// High-level queries over Tree
// --------------------------------------------------------------

pub fn query_selector(tree: &Tree, root: NodeId, selector: &SelectorList) -> Option<NodeId> {
    let mut stack = tree
        .children(root)
        .iter()
        .copied()
        .rev()
        .collect::<Vec<_>>();
    while let Some(current) = stack.pop() {
        if matches(tree, current, selector) {
            return Some(current);
        }
        for &child in tree.children(current).iter().rev() {
            stack.push(child);
        }
    }
    None
}

pub fn query_selector_all(tree: &Tree, root: NodeId, selector: &SelectorList) -> Vec<NodeId> {
    let mut out = Vec::new();
    let mut stack = tree
        .children(root)
        .iter()
        .copied()
        .rev()
        .collect::<Vec<_>>();
    while let Some(current) = stack.pop() {
        if matches(tree, current, selector) {
            out.push(current);
        }
        for &child in tree.children(current).iter().rev() {
            stack.push(child);
        }
    }
    out
}

pub fn closest(tree: &Tree, node: NodeId, selector: &SelectorList) -> Option<NodeId> {
    let mut current = node;
    while current != 0 {
        if matches(tree, current, selector) {
            return Some(current);
        }
        current = tree.parent_node(current);
    }
    None
}
