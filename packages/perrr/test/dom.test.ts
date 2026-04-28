// Spec: specs/crates/perrr-dom/spec.md
//       specs/crates/perrr-node/spec.md

import { describe, expect, it } from "vitest";
import { PerrrDom } from "..";

describe("PerrrDom via N-API", () => {
  it("constructs with document > html > {head, body}", () => {
    const dom = new PerrrDom();
    const doc = dom.documentId();
    expect(doc).toBeGreaterThan(0);
    expect(dom.nodeType(doc)).toBe(9);

    const docChildren = dom.children(doc);
    expect(docChildren).toHaveLength(1);
    const html = docChildren[0]!;
    expect(dom.localName(html)).toBe("html");
    expect(dom.tagName(html)).toBe("HTML");

    const htmlChildren = dom.children(html);
    expect(htmlChildren).toHaveLength(2);
    expect(dom.localName(htmlChildren[0]!)).toBe("head");
    expect(dom.localName(htmlChildren[1]!)).toBe("body");
  });

  it("createElement + attribute round-trip", () => {
    const dom = new PerrrDom();
    const btn = dom.createElement("button");
    expect(dom.nodeType(btn)).toBe(1);
    expect(dom.tagName(btn)).toBe("BUTTON");

    expect(dom.hasAttribute(btn, "type")).toBe(false);
    dom.setAttribute(btn, "type", "button");
    expect(dom.hasAttribute(btn, "type")).toBe(true);
    expect(dom.getAttribute(btn, "type")).toBe("button");

    dom.removeAttribute(btn, "type");
    expect(dom.hasAttribute(btn, "type")).toBe(false);
    expect(dom.getAttribute(btn, "type")).toBeNull();
  });

  it("appendChild + tree walk", () => {
    const dom = new PerrrDom();
    const parent = dom.createElement("div");
    const a = dom.createElement("span");
    const b = dom.createElement("span");
    dom.appendChild(parent, a);
    dom.appendChild(parent, b);
    expect(dom.children(parent)).toEqual([a, b]);
    expect(dom.parentNode(a)).toBe(parent);
    expect(dom.nextSibling(a)).toBe(b);
    expect(dom.previousSibling(b)).toBe(a);
    expect(dom.firstChild(parent)).toBe(a);
    expect(dom.lastChild(parent)).toBe(b);
  });

  it("insertBefore places between existing children", () => {
    const dom = new PerrrDom();
    const parent = dom.createElement("ul");
    const a = dom.createElement("li");
    const c = dom.createElement("li");
    const b = dom.createElement("li");
    dom.appendChild(parent, a);
    dom.appendChild(parent, c);
    dom.insertBefore(parent, b, c);
    expect(dom.children(parent)).toEqual([a, b, c]);
  });

  it("removeChild unlinks", () => {
    const dom = new PerrrDom();
    const parent = dom.createElement("div");
    const child = dom.createElement("span");
    dom.appendChild(parent, child);
    dom.removeChild(parent, child);
    expect(dom.children(parent)).toEqual([]);
    expect(dom.parentNode(child)).toBe(0);
  });

  it("textContent concatenates", () => {
    const dom = new PerrrDom();
    const parent = dom.createElement("p");
    dom.appendChild(parent, dom.createTextNode("Hello, "));
    const span = dom.createElement("span");
    dom.appendChild(span, dom.createTextNode("world"));
    dom.appendChild(parent, span);
    dom.appendChild(parent, dom.createTextNode("!"));
    expect(dom.textContent(parent)).toBe("Hello, world!");
  });

  it("setTextContent replaces children", () => {
    const dom = new PerrrDom();
    const parent = dom.createElement("div");
    dom.appendChild(parent, dom.createElement("span"));
    dom.setTextContent(parent, "fresh");
    const c = dom.children(parent);
    expect(c).toHaveLength(1);
    expect(dom.nodeType(c[0]!)).toBe(3);
    expect(dom.nodeData(c[0]!)).toBe("fresh");
  });

  it("focus tracks activeElement; blur clears to body (HTML spec)", () => {
    const dom = new PerrrDom();
    const body = dom.children(dom.children(dom.documentId())[0]!)[1]!;
    const a = dom.createElement("button");
    const b = dom.createElement("button");
    dom.appendChild(body, a);
    dom.appendChild(body, b);
    dom.focus(a);
    expect(dom.activeElement()).toBe(a);
    dom.blur(b);
    expect(dom.activeElement()).toBe(a);
    dom.blur(a);
    // Spec: when nothing is focused, activeElement is body.
    expect(dom.activeElement()).toBe(body);
  });

  it("disconnected focused element falls back to body (HTML spec)", () => {
    const dom = new PerrrDom();
    const body = dom.children(dom.children(dom.documentId())[0]!)[1]!;
    const a = dom.createElement("button");
    // Never attached to the tree — disconnected.
    dom.focus(a);
    // Spec: disconnected elements are implicitly blurred.
    expect(dom.activeElement()).toBe(body);
  });

  it("event listener registry balances through add/remove/freeNode", () => {
    const dom = new PerrrDom();
    const el = dom.createElement("button");
    dom.addEventListener(el, "click", 1, false, false, false);
    dom.addEventListener(el, "keydown", 2, false, false, false);
    expect(dom.listenerCount(el)).toBe(2);
    expect(dom.totalListenerCount()).toBe(2);
    // DOM dedup: same (type, id, capture) is a no-op.
    dom.addEventListener(el, "click", 1, false, false, false);
    expect(dom.listenerCount(el)).toBe(2);
    // Remove by (type, id, capture).
    expect(dom.removeEventListener(el, "click", 1, false)).toBe(true);
    expect(dom.listenerCount(el)).toBe(1);
    expect(dom.hasListenerOfType(el, "keydown")).toBe(true);
    expect(dom.hasListenerOfType(el, "click")).toBe(false);
    dom.freeNode(el);
    expect(dom.totalListenerCount()).toBe(0);
  });

  it("contains walks ancestors", () => {
    const dom = new PerrrDom();
    const root = dom.createElement("div");
    const mid = dom.createElement("div");
    const leaf = dom.createElement("span");
    dom.appendChild(root, mid);
    dom.appendChild(mid, leaf);
    expect(dom.contains(root, leaf)).toBe(true);
    expect(dom.contains(mid, leaf)).toBe(true);
    expect(dom.contains(leaf, leaf)).toBe(true);
    expect(dom.contains(leaf, root)).toBe(false);
  });

  it("cycle detection on appendChild throws", () => {
    const dom = new PerrrDom();
    const a = dom.createElement("div");
    const b = dom.createElement("div");
    dom.appendChild(a, b);
    expect(() => dom.appendChild(b, a)).toThrow(/cycle/i);
  });

  it("selector matches / querySelector / querySelectorAll / closest", () => {
    const dom = new PerrrDom();
    const body = dom.children(dom.children(dom.documentId())[0]!)[1]!;
    const outer = dom.createElement("section");
    dom.setAttribute(outer, "class", "wrap");
    dom.appendChild(body, outer);
    const btnA = dom.createElement("button");
    dom.setAttribute(btnA, "data-state", "open");
    dom.setAttribute(btnA, "class", "trigger");
    dom.appendChild(outer, btnA);
    const btnB = dom.createElement("button");
    dom.setAttribute(btnB, "data-state", "closed");
    dom.setAttribute(btnB, "class", "trigger");
    dom.appendChild(outer, btnB);

    expect(dom.matches(btnA, '[data-state="open"]')).toBe(true);
    expect(dom.matches(btnB, '[data-state="open"]')).toBe(false);
    expect(dom.matches(btnA, ".trigger")).toBe(true);
    expect(dom.matches(btnA, ".wrap > .trigger")).toBe(true);

    expect(dom.querySelector(dom.documentId(), ".trigger")).toBe(btnA);
    expect(dom.querySelectorAll(dom.documentId(), ".trigger")).toEqual([btnA, btnB]);
    expect(dom.closest(btnA, ".wrap")).toBe(outer);
    expect(dom.closest(btnA, ".not-here")).toBe(0);
  });

  it("selector parse error bubbles as napi error", () => {
    const dom = new PerrrDom();
    expect(() => dom.matches(dom.documentId(), "::before")).toThrow(/pseudo-element/i);
  });
});
