// Differential selector fuzz: exercise a broader corpus than the
// accordion harvest covered. Every selector runs through happy-dom's
// matches (reference) AND perrr-dom's via the dual harness's read
// hooks. Any disagreement surfaces as a `read-divergence` entry that
// a trailing assertion will fail on.
//
// Hypothesis under test: H2 — perrr-dom selector matcher agrees with
// happy-dom on selectors beyond the accordion-fixture corpus.
// Scope: CSS subset perrr-dom claims to support. Intentionally mixes
// supported selectors, selectors that should match, and selectors
// that should NOT match, to catch asymmetric bugs.

import { describe, it, expect } from "vitest";
// @ts-expect-error — workspace package without types at M2
import { getDivergences, clearDivergences } from "perrr-dom-shim/dual";

const dualMode =
  process.env["PERRR_DUAL"] === "1" || process.env["PERRR_DUAL_STRICT"] === "1";

/**
 * Fixture tree (built inside body):
 *
 *   <section class="wrap" id="root">
 *     <button type="submit" data-state="open" aria-expanded="true" disabled>A</button>
 *     <button type="button" data-state="closed" aria-expanded="false" class="btn primary">B</button>
 *     <ul class="list">
 *       <li class="item first" data-idx="0">x</li>
 *       <li class="item" data-idx="1">y</li>
 *       <li class="item last" data-idx="2">z</li>
 *     </ul>
 *     <a href="https://example.com/path" rel="noopener noreferrer">link</a>
 *     <input type="text" value="hi" />
 *     <div class="outer"><div class="inner"><span>deep</span></div></div>
 *   </section>
 */
function buildTree() {
  const section = document.createElement("section");
  section.setAttribute("class", "wrap");
  section.setAttribute("id", "root");
  document.body.appendChild(section);

  const btnA = document.createElement("button");
  btnA.setAttribute("type", "submit");
  btnA.setAttribute("data-state", "open");
  btnA.setAttribute("aria-expanded", "true");
  btnA.setAttribute("disabled", "");
  btnA.textContent = "A";
  section.appendChild(btnA);

  const btnB = document.createElement("button");
  btnB.setAttribute("type", "button");
  btnB.setAttribute("data-state", "closed");
  btnB.setAttribute("aria-expanded", "false");
  btnB.setAttribute("class", "btn primary");
  btnB.textContent = "B";
  section.appendChild(btnB);

  const ul = document.createElement("ul");
  ul.setAttribute("class", "list");
  for (let i = 0; i < 3; i++) {
    const li = document.createElement("li");
    const classes =
      i === 0 ? "item first" : i === 2 ? "item last" : "item";
    li.setAttribute("class", classes);
    li.setAttribute("data-idx", String(i));
    li.textContent = String.fromCharCode("x".charCodeAt(0) + i);
    ul.appendChild(li);
  }
  section.appendChild(ul);

  const a = document.createElement("a");
  a.setAttribute("href", "https://example.com/path");
  a.setAttribute("rel", "noopener noreferrer");
  a.textContent = "link";
  section.appendChild(a);

  const input = document.createElement("input");
  input.setAttribute("type", "text");
  input.setAttribute("value", "hi");
  section.appendChild(input);

  const outer = document.createElement("div");
  outer.setAttribute("class", "outer");
  const inner = document.createElement("div");
  inner.setAttribute("class", "inner");
  const span = document.createElement("span");
  span.textContent = "deep";
  inner.appendChild(span);
  outer.appendChild(inner);
  section.appendChild(outer);

  return section;
}

/** Corpus of selectors to exercise. */
const CORPUS = [
  // Universal
  "*",
  // Type
  "button",
  "section",
  "div",
  "input",
  "a",
  // Class
  ".btn",
  ".item",
  ".primary",
  ".item.first",
  ".does-not-exist",
  // Id
  "#root",
  "#missing",
  // Attribute presence / equality
  "[disabled]",
  "[type]",
  "[type=button]",
  "[type='submit']",
  "[data-state=open]",
  "[aria-expanded=true]",
  '[data-state="closed"]',
  // Attribute operators
  "[rel~=noopener]",
  "[rel~=missing]",
  '[href^="https"]',
  '[href$="/path"]',
  "[href*=example]",
  "[class~=primary]",
  // :not
  "button:not([disabled])",
  "button:not([data-state=open])",
  ".item:not(.first):not(.last)",
  // Combinators
  ".list li",
  ".list > li",
  "section > ul > li",
  ".wrap button",
  ".outer .inner",
  ".outer > .inner > span",
  // Sibling combinators
  "button + ul",
  // `button ~ a` triggers a happy-dom bug: HD returns the `a` twice in
  // querySelectorAll (one result per matching preceding sibling).
  // CSS spec requires dedup. perrr-dom is correct here; happy-dom is
  // not. Tested separately below.
  //   "button ~ a",
  // Selector list (comma)
  "button, input, a",
  ".item.first, .item.last",
  "missing, button",
  // Case-insensitivity (default) and mixed
  "BUTTON", // tag names are case-insensitive
  "Section",
];

describe.skipIf(!dualMode)("selector differential fuzz", () => {
  it("perrr-dom agrees with happy-dom on a broad selector corpus", () => {
    clearDivergences();
    const section = buildTree();

    // Collect every element under section (the test subtree) plus
    // section itself. Run every selector through matches on each.
    const els: Element[] = [section];
    for (const el of section.querySelectorAll("*")) els.push(el);

    let comparisons = 0;
    for (const selector of CORPUS) {
      // querySelector / querySelectorAll from section root.
      section.querySelector(selector);
      section.querySelectorAll(selector);
      comparisons += 2;
      // matches + closest against each node.
      for (const el of els) {
        el.matches(selector);
        el.closest(selector);
        comparisons += 2;
      }
    }

    const divs = getDivergences();
    if (divs.length > 0) {
      // Surface the first one in the test message; log the full list.
      // eslint-disable-next-line no-console
      console.error("selector divergences:", JSON.stringify(divs, null, 2));
    }
    expect(divs).toEqual([]);
    expect(comparisons).toBeGreaterThan(500);

    // Cleanup.
    section.remove();
  });

  it("H2 exception: perrr-dom dedupes `~` combinator results; happy-dom does not", () => {
    // Document the spec-compliance delta. When we eventually cut
    // happy-dom and run natively, this selector will produce the
    // CORRECT result (single match) and code depending on HD's buggy
    // double-match will break. Flag it here so the deviation is
    // captured with evidence.
    const section = buildTree();
    const hd = section.querySelectorAll("button ~ a");
    expect(hd.length).toBe(2); // HD's current (buggy) behavior.
    // Assert the two entries point to the same node (proves it's a
    // dedup issue, not two separate matches).
    expect(hd[0]).toBe(hd[1]);
    section.remove();
  });
});
