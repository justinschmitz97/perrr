// perrr-dom-shim / dual
// Spec: specs/milestones/m2-dom-shim.md §4e.ii
//
// Differential-testing harness. Runs every DOM mutation through both
// happy-dom and perrr-dom; serializes + diffs tree shapes at verify
// points. Any divergence throws.
//
// Purpose: prove perrr-dom parity with happy-dom *before* we cut the
// happy-dom dep. This is not a production code path — it's a
// measurement utility.

// `perrr` is a CJS package (napi-rs generated index.js). Load via
// createRequire so this module stays ESM-clean.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PerrrDom } = require("perrr");

// State lives on globalThis so it's shared across the vitest env
// module graph and the test-file module graph — vitest doesn't
// dedupe our modules across those boundaries.
const GLOBAL_KEY = "__perrr_dual_state__";

function getGlobal() {
  const g = /** @type {any} */ (globalThis);
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      state: null,
      divergences: [],
      patches: new Map(),
      strict: false,
      opCounter: 0,
      queryCounter: 0,
      /**
       * Count mirror-skip events caused by bimap lookup misses. Spec:
       * specs/overview/05-hypotheses.md §H4b. Non-zero means we have
       * happy-dom nodes the harness never registered.
       */
      missedMirrorCount: 0,
      /**
       * Per-API counts for UNHOOKED mutation paths (H1 trackers).
       * We do NOT mirror these; the count alone tells us whether the
       * hypothesis "nothing critical is unhooked" holds for the
       * current fixture.
       */
      trackerCounts: {},
    };
  }
  return g[GLOBAL_KEY];
}

/** @returns {any} */
function getState() {
  return getGlobal().state;
}
function setState(s) {
  getGlobal().state = s;
}

function pushDivergence(event) {
  getGlobal().divergences.push({ ...event, ts: Date.now() });
}

function maybeVerifyAfterMutation(op, args) {
  const g = getGlobal();
  if (!g.strict) return;
  g.opCounter += 1;
  const hd = serializeHappyDom();
  const nt = serializeNative();
  if (hd === nt) return;
  const d = diffSerialized(hd, nt);
  const err = new Error(
    `dual STRICT divergence after op #${g.opCounter} (${op}): ` +
      `char ${d.divergentAt} | HD len ${d.hdLength} vs native ${d.nativeLength}\n` +
      `  args: ${safeArgsPreview(args)}\n` +
      `  HD:     ...${d.hdExcerpt}...\n` +
      `  NATIVE: ...${d.nativeExcerpt}...`,
  );
  err.divergence = d;
  err.op = op;
  err.opIndex = g.opCounter;
  throw err;
}

function safeArgsPreview(args) {
  try {
    return JSON.stringify(
      Array.from(args ?? []).map((a) => {
        if (a == null) return a;
        if (typeof a === "string") return a.slice(0, 80);
        if (typeof a === "number" || typeof a === "boolean") return a;
        if (a.nodeType != null) return `<${a.localName ?? "#" + a.nodeType}>`;
        return typeof a;
      }),
    );
  } catch {
    return "[unprintable]";
  }
}

function patch(proto, key, fn) {
  // `original` is undefined when the method is inherited from a super
  // prototype; restoreAll handles both cases.
  const original = Object.getOwnPropertyDescriptor(proto, key);
  const id = `${proto.constructor?.name ?? "?"}.${key}`;
  const patches = getGlobal().patches;
  if (patches.has(id)) {
    throw new Error(`dual: ${id} already patched`);
  }
  patches.set(id, { proto, key, original });
  Object.defineProperty(proto, key, fn);
}

function restoreAll() {
  const patches = getGlobal().patches;
  for (const { proto, key, original } of patches.values()) {
    if (original) {
      Object.defineProperty(proto, key, original);
    } else {
      // Method was inherited; removing our override falls back to the
      // inherited implementation.
      delete proto[key];
    }
  }
  patches.clear();
}

// --------------------------------------------------------------
// Install
// --------------------------------------------------------------

/**
 * Install dual-backend monkey patches on top of an existing happy-dom
 * global registration. Must be called AFTER happy-dom's
 * `GlobalRegistrator.register(...)`.
 *
 * @param {object} [options]
 * @param {boolean} [options.strict] — verify full tree shape after every
 *   mutation; throws on first divergence. Slow (~O(n) per op) but
 *   catches errors at their source instead of at end-of-file.
 */
export function installDualBackend(options = {}) {
  if (getState()) throw new Error("dual: already installed");
  const g = getGlobal();
  g.strict = !!options.strict;
  g.opCounter = 0;
  const native = new PerrrDom();
  const idOf = new WeakMap(); // HD node -> NodeId (u32)
  const nodeOf = new Map(); // NodeId -> HD node

  setState({ native, idOf, nodeOf });

  // ----- Seed pre-existing tree: document, html, head, body.
  const doc = globalThis.document;
  idOf.set(doc, native.documentId());
  nodeOf.set(native.documentId(), doc);
  const html = doc.documentElement;
  const htmlId = native.children(native.documentId())[0];
  idOf.set(html, htmlId);
  nodeOf.set(htmlId, html);
  const head = doc.head;
  const body = doc.body;
  const htmlChildren = native.children(htmlId);
  idOf.set(head, htmlChildren[0]);
  nodeOf.set(htmlChildren[0], head);
  idOf.set(body, htmlChildren[1]);
  nodeOf.set(htmlChildren[1], body);

  // ----- Node creation hooks.

  patchCreate(doc, "createElement", (tag) => native.createElement(tag), idOf, nodeOf);
  patchCreate(doc, "createElementNS", (ns, tag) => native.createElementNs(ns, tag), idOf, nodeOf);
  patchCreate(doc, "createTextNode", (data) => native.createTextNode(data ?? ""), idOf, nodeOf);
  patchCreate(doc, "createComment", (data) => native.createComment(data ?? ""), idOf, nodeOf);
  patchCreate(doc, "createDocumentFragment", () => native.createDocumentFragment(), idOf, nodeOf);

  // ----- Tree mutation hooks.

  patchTreeOp("appendChild", function (child) {
    const pid = idOf.get(this);
    const cid = idOf.get(child);
    if (pid == null || cid == null) {
      getGlobal().missedMirrorCount += 1;
    }
    if (pid != null && cid != null) {
      try {
        native.appendChild(pid, cid);
      } catch (e) {
        pushDivergence({
          kind: "mirror-throw",
          op: "appendChild",
          error: String(e),
        });
      }
    }
    maybeVerifyAfterMutation("appendChild", arguments);
  });

  patchTreeOp("insertBefore", function (newChild, refChild) {
    const pid = idOf.get(this);
    const cid = idOf.get(newChild);
    const rid = refChild == null ? 0 : idOf.get(refChild);
    if (pid == null || cid == null) {
      getGlobal().missedMirrorCount += 1;
    }
    if (pid != null && cid != null) {
      try {
        native.insertBefore(pid, cid, rid ?? 0);
      } catch (e) {
        pushDivergence({
          kind: "mirror-throw",
          op: "insertBefore",
          error: String(e),
        });
      }
    }
    maybeVerifyAfterMutation("insertBefore", arguments);
  });

  patchTreeOp("removeChild", function (child) {
    const pid = idOf.get(this);
    const cid = idOf.get(child);
    if (pid == null || cid == null) {
      getGlobal().missedMirrorCount += 1;
    }
    if (pid != null && cid != null) {
      try {
        native.removeChild(pid, cid);
      } catch (e) {
        pushDivergence({
          kind: "mirror-throw",
          op: "removeChild",
          error: String(e),
        });
      }
    }
    maybeVerifyAfterMutation("removeChild", arguments);
  });

  patchTreeOp("replaceChild", function (newChild, oldChild) {
    const pid = idOf.get(this);
    const nid = idOf.get(newChild);
    const oid = idOf.get(oldChild);
    if (pid != null && nid != null && oid != null) {
      try {
        native.insertBefore(pid, nid, oid);
        native.removeChild(pid, oid);
      } catch (e) {
        pushDivergence({
          kind: "mirror-throw",
          op: "replaceChild",
          error: String(e),
        });
      }
    }
    maybeVerifyAfterMutation("replaceChild", arguments);
  });

  // ----- Attribute hooks.

  patchAttr("setAttribute", function (name, value) {
    const id = idOf.get(this);
    if (id == null) getGlobal().missedMirrorCount += 1;
    if (id != null) {
      try {
        native.setAttribute(id, String(name), String(value));
      } catch (e) {
        pushDivergence({
          kind: "mirror-throw",
          op: "setAttribute",
          name,
          error: String(e),
        });
      }
    }
    maybeVerifyAfterMutation("setAttribute", arguments);
  });

  patchAttr("removeAttribute", function (name) {
    const id = idOf.get(this);
    if (id != null) {
      try {
        native.removeAttribute(id, String(name));
      } catch (e) {
        pushDivergence({
          kind: "mirror-throw",
          op: "removeAttribute",
          name,
          error: String(e),
        });
      }
    }
    maybeVerifyAfterMutation("removeAttribute", arguments);
  });

  patchAttr("toggleAttribute", function (name, force) {
    const id = idOf.get(this);
    if (id != null) {
      try {
        // happy-dom returns the final presence. We reflect it.
        if (native.hasAttribute(id, String(name))) {
          if (force === true) {
            // keep as-is
          } else {
            native.removeAttribute(id, String(name));
          }
        } else if (force === false) {
          // keep absent
        } else {
          native.setAttribute(id, String(name), "");
        }
      } catch (e) {
        pushDivergence({
          kind: "mirror-throw",
          op: "toggleAttribute",
          name,
          error: String(e),
        });
      }
    }
  });

  // ----- Text node data setter.

  patchDataSetter();

  // ----- Element.textContent setter — mirrored. See H1d.
  patchTextContentSetter();

  // ----- H1 trackers: count unhooked mutation paths.
  installTrackers();

  // ----- Read-side: verify queries agree between backends.
  patchQuery("matches", function (selector) {
    const id = idOf.get(this);
    if (id == null) return;
    return { id, selector: String(selector) };
  });

  patchQuery("closest", function (selector) {
    const id = idOf.get(this);
    if (id == null) return;
    return { id, selector: String(selector) };
  });

  // querySelector + querySelectorAll live on both Element and Document;
  // Document inherits from Node in happy-dom but the methods are on the
  // Element mixin. Patch both prototypes if present and distinct.
  patchSelectorQuery("querySelector", false);
  patchSelectorQuery("querySelectorAll", true);
}

// --------------------------------------------------------------
// H1 trackers — count unhooked mutation paths to test the claim that
// happy-dom ↔ perrr-dom shape parity holds on the full surface, not
// just the eight hooked mutations.
// --------------------------------------------------------------

function trackerIncr(name) {
  const g = getGlobal();
  g.trackerCounts[name] = (g.trackerCounts[name] ?? 0) + 1;
}

function trackerWrap(proto, key, label) {
  if (!proto) return;
  const descriptor = Object.getOwnPropertyDescriptor(proto, key);
  if (!descriptor) return;
  const patchId = `TRACKER:${label}`;
  const patches = getGlobal().patches;
  if (patches.has(patchId)) return;
  patches.set(patchId, { proto, key, original: descriptor });
  if (typeof descriptor.value === "function") {
    Object.defineProperty(proto, key, {
      configurable: true,
      writable: true,
      value: function (...args) {
        trackerIncr(label);
        return descriptor.value.apply(this, args);
      },
    });
  } else if (descriptor.set) {
    Object.defineProperty(proto, key, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set: function (v) {
        trackerIncr(label);
        descriptor.set.call(this, v);
      },
    });
  }
}

function installTrackers() {
  const El = globalThis.Element?.prototype;
  const Node = globalThis.Node?.prototype;
  const HTMLInput = globalThis.HTMLInputElement?.prototype;
  const DOMTokenList = globalThis.DOMTokenList?.prototype;

  // Element-level mutating methods / setters we do NOT currently mirror.
  trackerWrap(El, "innerHTML", "Element.set innerHTML");
  trackerWrap(El, "outerHTML", "Element.set outerHTML");
  // Element.textContent setter is *mirrored* (see patchTextContent) not
  // just tracked — measurement showed 158 calls on accordion, and
  // because textContent sets live inside detached subtrees, our shape
  // check never saw the drift (H1d).
  trackerWrap(El, "insertAdjacentHTML", "Element.insertAdjacentHTML");
  trackerWrap(El, "insertAdjacentElement", "Element.insertAdjacentElement");
  trackerWrap(El, "insertAdjacentText", "Element.insertAdjacentText");

  // Node-level convenience mutations (ChildNode / ParentNode mixins).
  trackerWrap(El, "remove", "Element.remove");
  trackerWrap(El, "before", "Element.before");
  trackerWrap(El, "after", "Element.after");
  trackerWrap(El, "replaceWith", "Element.replaceWith");
  trackerWrap(El, "append", "Element.append");
  trackerWrap(El, "prepend", "Element.prepend");
  trackerWrap(El, "replaceChildren", "Element.replaceChildren");
  trackerWrap(Node, "normalize", "Node.normalize");

  // classList / dataset access paths.
  trackerWrap(DOMTokenList, "add", "classList.add");
  trackerWrap(DOMTokenList, "remove", "classList.remove");
  trackerWrap(DOMTokenList, "toggle", "classList.toggle");
  trackerWrap(DOMTokenList, "replace", "classList.replace");

  // Form controls.
  trackerWrap(HTMLInput, "value", "HTMLInputElement.set value");
  trackerWrap(HTMLInput, "checked", "HTMLInputElement.set checked");
}

function patchCreate(docInstance, method, nativeCall, idOf, nodeOf) {
  const proto = Object.getPrototypeOf(docInstance);
  const original = proto[method];
  if (typeof original !== "function") return;
  const id = `Document.${method}`;
  getGlobal().patches.set(id, {
    proto,
    key: method,
    original: Object.getOwnPropertyDescriptor(proto, method),
  });
  Object.defineProperty(proto, method, {
    configurable: true,
    writable: true,
    value: function (...args) {
      const hd = original.apply(this, args);
      const nid = nativeCall(...args);
      idOf.set(hd, nid);
      nodeOf.set(nid, hd);
      return hd;
    },
  });
}

function patchTreeOp(method, mirror) {
  const NodeProto = globalThis.Node?.prototype;
  if (!NodeProto) return;
  const original = NodeProto[method];
  if (typeof original !== "function") return;
  patch(NodeProto, method, {
    configurable: true,
    writable: true,
    value: function (...args) {
      const result = original.apply(this, args);
      mirror.apply(this, args);
      return result;
    },
  });
}

function patchAttr(method, mirror) {
  const ElProto = globalThis.Element?.prototype;
  if (!ElProto) return;
  const original = ElProto[method];
  if (typeof original !== "function") return;
  patch(ElProto, method, {
    configurable: true,
    writable: true,
    value: function (...args) {
      const result = original.apply(this, args);
      mirror.apply(this, args);
      return result;
    },
  });
}

/**
 * Patch a boolean-returning query method (`matches`, `closest`) on
 * Element.prototype. `extractNativeArgs` returns `{ id, selector }` or
 * undefined (to skip this call).
 *
 * For `matches`: HD returns bool; native returns bool. Compare.
 * For `closest`: HD returns Element | null; native returns NodeId (0
 * == null). Compare after bimap translation.
 */
function patchQuery(method, extractNativeArgs) {
  const ElProto = globalThis.Element?.prototype;
  if (!ElProto) return;
  const original = ElProto[method];
  if (typeof original !== "function") return;
  patch(ElProto, method, {
    configurable: true,
    writable: true,
    value: function (...args) {
      const hdResult = original.apply(this, args);
      const extracted = extractNativeArgs.apply(this, args);
      if (extracted) {
        compareQueryResult(method, this, args, hdResult, extracted);
      }
      return hdResult;
    },
  });
}

function compareQueryResult(method, self, args, hdResult, extracted) {
  const s = getState();
  if (!s) return;
  const { id, selector } = extracted;
  getGlobal().queryCounter = (getGlobal().queryCounter ?? 0) + 1;
  let ntResult;
  try {
    if (method === "matches") ntResult = s.native.matches(id, selector);
    else if (method === "closest") ntResult = s.native.closest(id, selector);
    else throw new Error(`patchQuery: unknown method ${method}`);
  } catch (e) {
    pushDivergence({
      kind: "read-throw",
      op: method,
      selector,
      error: String(e),
    });
    return;
  }
  if (method === "matches") {
    if (hdResult !== ntResult) {
      pushDivergence({
        kind: "read-divergence",
        op: "matches",
        selector,
        hdResult,
        ntResult,
      });
    }
  } else if (method === "closest") {
    const hdId = hdResult == null ? 0 : s.idOf.get(hdResult) ?? null;
    if (hdId == null) {
      pushDivergence({
        kind: "read-translation-miss",
        op: "closest",
        selector,
        note: "HD returned a node not in bimap",
      });
    } else if (hdId !== ntResult) {
      pushDivergence({
        kind: "read-divergence",
        op: "closest",
        selector,
        hdId,
        ntResult,
      });
    }
  }
}

function patchSelectorQuery(method, many) {
  const targets = new Set();
  const pushProto = (obj) => {
    const proto = obj?.prototype;
    if (proto && typeof proto[method] === "function") targets.add(proto);
  };
  pushProto(globalThis.Element);
  pushProto(globalThis.Document);
  pushProto(globalThis.DocumentFragment);

  for (const proto of targets) {
    const original = proto[method];
    patch(proto, method, {
      configurable: true,
      writable: true,
      value: function (selector) {
        const hdResult = original.call(this, selector);
        const s = getState();
        if (s) {
          const id = s.idOf.get(this);
          if (id != null) {
            compareSelectorQueryResult(method, many, s, id, String(selector), hdResult);
          }
        }
        return hdResult;
      },
    });
  }
}

function compareSelectorQueryResult(method, many, s, id, selector, hdResult) {
  getGlobal().queryCounter = (getGlobal().queryCounter ?? 0) + 1;
  let ntResult;
  try {
    ntResult = many
      ? s.native.querySelectorAll(id, selector)
      : s.native.querySelector(id, selector);
  } catch (e) {
    pushDivergence({
      kind: "read-throw",
      op: method,
      selector,
      error: String(e),
    });
    return;
  }
  if (many) {
    const hdIds = Array.from(hdResult ?? []).map((n) => s.idOf.get(n) ?? 0);
    const ntIds = ntResult;
    if (
      hdIds.length !== ntIds.length ||
      hdIds.some((x, i) => x !== ntIds[i])
    ) {
      pushDivergence({
        kind: "read-divergence",
        op: method,
        selector,
        hdIds,
        ntIds,
      });
    }
  } else {
    const hdId = hdResult == null ? 0 : s.idOf.get(hdResult) ?? null;
    if (hdId == null) {
      pushDivergence({
        kind: "read-translation-miss",
        op: method,
        selector,
        note: "HD returned a node not in bimap",
      });
    } else if (hdId !== ntResult) {
      pushDivergence({
        kind: "read-divergence",
        op: method,
        selector,
        hdId,
        ntResult,
      });
    }
  }
}

function patchTextContentSetter() {
  const El = globalThis.Element?.prototype;
  if (!El) return;
  const original = Object.getOwnPropertyDescriptor(El, "textContent");
  if (!original || !original.set) return;
  patch(El, "textContent", {
    configurable: true,
    enumerable: original.enumerable,
    get: original.get,
    set: function (value) {
      original.set.call(this, value);
      const s = getState();
      const id = s?.idOf.get(this);
      if (id == null) {
        if (s) getGlobal().missedMirrorCount += 1;
        return;
      }
      try {
        s.native.setTextContent(id, value == null ? "" : String(value));
      } catch (e) {
        pushDivergence({
          kind: "mirror-throw",
          op: "set textContent",
          error: String(e),
        });
      }
      maybeVerifyAfterMutation("set textContent", [value]);
    },
  });
}

function patchDataSetter() {
  // Text + Comment share `.data` and `.nodeValue` on CharacterData.
  const CharacterData = globalThis.CharacterData?.prototype;
  if (!CharacterData) return;
  for (const key of ["data", "nodeValue"]) {
    const original = Object.getOwnPropertyDescriptor(CharacterData, key);
    if (!original || !original.set) continue;
    patch(CharacterData, key, {
      configurable: true,
      enumerable: original.enumerable,
      get: original.get,
      set: function (value) {
        original.set.call(this, value);
        const s = getState();
        const id = s?.idOf.get(this);
        if (id != null && s) {
          try {
            s.native.setNodeData(id, String(value));
          } catch (e) {
            pushDivergence({
              kind: "mirror-throw",
              op: `set ${key}`,
              error: String(e),
            });
          }
        }
      },
    });
  }
}

// --------------------------------------------------------------
// Verify + teardown
// --------------------------------------------------------------

/**
 * Serialize the happy-dom tree rooted at the document.
 */
export function serializeHappyDom() {
  return hdSerialize(globalThis.document);
}

function hdSerialize(node) {
  if (!node) return "";
  const t = node.nodeType;
  if (t === 3) return `<#text ${JSON.stringify(node.data ?? "")}>`;
  if (t === 8) return `<!--${node.data ?? ""}-->`;
  if (t === 9) {
    return `<#document>${childrenOf(node).map(hdSerialize).join("")}</#document>`;
  }
  if (t === 11) {
    return `<#fragment>${childrenOf(node).map(hdSerialize).join("")}</#fragment>`;
  }
  const local = (node.localName ?? "").toLowerCase();
  const attrs = Array.from(node.attributes ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ` ${a.name}=${JSON.stringify(a.value)}`)
    .join("");
  return `<${local}${attrs}>${childrenOf(node).map(hdSerialize).join("")}</${local}>`;
}

function childrenOf(node) {
  const cn = node.childNodes;
  if (!cn) return [];
  const arr = [];
  for (let i = 0; i < cn.length; i++) arr.push(cn[i]);
  return arr;
}

/**
 * Serialize the perrr-dom tree.
 */
export function serializeNative() {
  const s = getState();
  if (!s) throw new Error("dual: not installed");
  return nativeSerialize(s.native, s.native.documentId());
}

function nativeSerialize(dom, id) {
  const t = dom.nodeType(id);
  if (t === 3) return `<#text ${JSON.stringify(dom.nodeData(id) ?? "")}>`;
  if (t === 8) return `<!--${dom.nodeData(id) ?? ""}-->`;
  const children = dom.children(id).map((c) => nativeSerialize(dom, c)).join("");
  if (t === 9) return `<#document>${children}</#document>`;
  if (t === 11) return `<#fragment>${children}</#fragment>`;
  const local = (dom.localName(id) ?? "").toLowerCase();
  const names = [...dom.attributeNames(id)].sort();
  const attrs = names
    .map((n) => ` ${n}=${JSON.stringify(dom.getAttribute(id, n) ?? "")}`)
    .join("");
  return `<${local}${attrs}>${children}</${local}>`;
}

/**
 * Compare serialized trees. Returns null if identical, else an
 * object with the first divergence location.
 */
export function diffSerialized(a, b) {
  if (a === b) return null;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const ctx = 40;
  return {
    divergentAt: i,
    hdExcerpt: a.slice(Math.max(0, i - ctx), i + ctx),
    nativeExcerpt: b.slice(Math.max(0, i - ctx), i + ctx),
    hdLength: a.length,
    nativeLength: b.length,
  };
}

/**
 * Throws if the two backends disagree. Otherwise logs a count of
 * operations mirrored so far.
 */
export function verifyDualShapes() {
  const hd = serializeHappyDom();
  const nt = serializeNative();
  const d = diffSerialized(hd, nt);
  if (d) {
    const err = new Error(
      `dual divergence at char ${d.divergentAt} (HD len ${d.hdLength}, native len ${d.nativeLength})\n` +
        `HD:     ...${d.hdExcerpt}...\n` +
        `NATIVE: ...${d.nativeExcerpt}...`,
    );
    err.divergence = d;
    throw err;
  }
  const g = getGlobal();
  return {
    hdBytes: hd.length,
    nativeBytes: nt.length,
    mirrorThrows: g.divergences.length,
    strict: g.strict,
    mutationsChecked: g.opCounter,
    queriesChecked: g.queryCounter ?? 0,
    missedMirrorCount: g.missedMirrorCount ?? 0,
    trackerCounts: { ...(g.trackerCounts ?? {}) },
  };
}

export function getDivergences() {
  return getGlobal().divergences.slice();
}

/**
 * Return the current counters and tracker state WITHOUT throwing on
 * divergence. Use when you want to observe drift instead of fail on it.
 */
export function getDualStats() {
  const g = getGlobal();
  return {
    strict: g.strict,
    mutationsChecked: g.opCounter,
    queriesChecked: g.queryCounter ?? 0,
    missedMirrorCount: g.missedMirrorCount ?? 0,
    divergences: g.divergences.length,
    trackerCounts: { ...(g.trackerCounts ?? {}) },
  };
}

export function clearDivergences() {
  getGlobal().divergences.length = 0;
}

export function disposeDualBackend() {
  const s = getState();
  if (!s) return;
  restoreAll();
  setState(null);
  clearDivergences();
  const g = getGlobal();
  g.strict = false;
  g.opCounter = 0;
  g.queryCounter = 0;
  g.missedMirrorCount = 0;
  g.trackerCounts = {};
}

export function nativeInstance() {
  return getState()?.native ?? null;
}

/**
 * Look up the native NodeId for a happy-dom node. Returns `null` if
 * dual is not installed or the node isn't tracked. Used by harness
 * self-tests.
 */
export function getDualIdOf(node) {
  return getState()?.idOf.get(node) ?? null;
}
