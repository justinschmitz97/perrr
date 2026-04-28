---
title: dom api coverage matrix
kind: overview
status: approved
related:
  - specs/milestones/m2-dom-shim.md
  - specs/crates/perrr-dom/spec.md
  - specs/packages/perrr-dom-shim/spec.md
  - specs/overview/04-fixtures.md
last-reviewed: 2026-04-28
---

## Purpose
- Living matrix of DOM APIs perrr must support, derived from what v0.1 acceptance fixtures actually touch.
- Single source of truth for M2 scope: every row either `supported` or `stubbed` at M2 close.

## Methodology
1. **Static pre-pass (this doc, pre-M2a):** enumerate APIs visible by reading fixture source + obvious React/RTL/radix/motion usage.
2. **Dynamic harvest (M2a):** run `accordion.test.tsx` under `perrr-dom-shim` with `setLoggingMode("log")`; collect every facade access into `.perrr/miss-log.json`.
3. **Reconcile (M2b):** merge static + dynamic lists into the table below; assign `plan` per row.
4. **Implement (M2c):** work rows top-down by call frequency until `accordion.test.tsx` green.
5. **Lock (M2 close):** set `status: approved`; subsequent milestones update this doc as APIs move from `stubbed` → `real`.

## Status legend
- `supported` — real behavior backed by `perrr-dom` + facade.
- `stubbed` — returns a fixed value; documented deviation from browser.
- `fail-loud` — calling it throws `perrr: unimplemented`; add to this list when hit by a test.
- `deferred-mN` — will be supported starting at milestone `N`.

## Backend reality at M2
- **Current JS DOM backend:** happy-dom (via `@happy-dom/global-registrator`). All browser APIs below are answered by happy-dom.
- **perrr-dom native implementation:** available, measured equivalent to happy-dom for the mutation + selector surface the accordion fixture exercises (see `specs/packages/perrr-dom-shim/spec.md` §Measured outcome). NOT yet primary backend for JS code.
- **Facade native swap (M2c):** pending. When it lands, the rows below marked `native-ready` become the primary backend; `happy-dom` column retires.

## Static pre-pass (from fixture reading)
_Frozen pre-M2a snapshot. Superseded by the dynamic-harvest section below for authoritative call frequencies and by `specs/crates/perrr-dom/spec.md` for what's implemented natively. Status values in this section marked (M2) mean "satisfied today via happy-dom"; see the M2c column in the Tier tables below for native readiness._

### Tree mutation
| API | status | notes |
|---|---|---|
| `Document.createElement(tag)` | supported (M2) | |
| `Document.createTextNode(text)` | supported (M2) | |
| `Document.createDocumentFragment()` | supported (M2) | React uses |
| `Document.createComment(data)` | supported (M2) | React hydration markers |
| `Node.appendChild(child)` | supported (M2) | |
| `Node.insertBefore(new, ref)` | supported (M2) | |
| `Node.removeChild(child)` | supported (M2) | |
| `Node.replaceChild(new, old)` | supported (M2) | |
| `Node.cloneNode(deep?)` | supported (M2) | radix asChild |

### Attributes + classes
| API | status | notes |
|---|---|---|
| `Element.getAttribute`, `setAttribute`, `removeAttribute`, `hasAttribute` | supported (M2) | |
| `Element.attributes` (NamedNodeMap) | supported (M2) | only what fixture reads |
| `Element.className` (get + set) | supported (M2) | |
| `Element.classList` (add, remove, toggle, contains, `.length`, iterable) | supported (M2) | |
| `Element.id` (get + set) | supported (M2) | |
| `HTMLElement.dataset` | supported (M2) | Proxy over `data-*` attrs |
| `HTMLElement.ariaExpanded` / `ariaHidden` / … | supported (M2) | mirror of `aria-*` attrs |

### Queries
| API | status | notes |
|---|---|---|
| `Document.getElementById` | supported (M2) | |
| `Element.querySelector` | supported (M2) | |
| `Element.querySelectorAll` | supported (M2) | |
| `Element.getElementsByTagName` | supported (M2) | |
| `Document.getElementsByRole` | — | RTL uses `querySelectorAll` + filter; no direct API |

### Text + values
| API | status | notes |
|---|---|---|
| `Node.textContent` (get + set) | supported (M2) | |
| `Text.nodeValue`, `Text.data` | supported (M2) | |
| `HTMLInputElement.value` | supported (M2) | fixture keyboard tests |
| `HTMLInputElement.checked` | supported (M2) | |
| `HTMLButtonElement.disabled` | supported (M2) | disabled-items suite |
| `HTMLElement.innerText` | stubbed (M2) | = textContent; revisit if fixture asserts on it |
| `HTMLElement.outerHTML`, `innerHTML` (get) | supported (M2) | RTL error messages include them |
| `HTMLElement.outerHTML`, `innerHTML` (set) | supported (M2) | React hydration |

### Events
| API | status | notes |
|---|---|---|
| `EventTarget.addEventListener` (type, listener, options) | supported (M2) | `options.capture`, `.once`, `.passive` honored |
| `EventTarget.removeEventListener` | supported (M2) | |
| `EventTarget.dispatchEvent` | supported (M2) | returns `!defaultPrevented` |
| `Event` (type, bubbles, cancelable, composed) | supported (M2) | |
| `Event.preventDefault`, `stopPropagation`, `stopImmediatePropagation` | supported (M2) | |
| `Event.target`, `currentTarget`, `eventPhase`, `timeStamp` | supported (M2) | |
| `Event.isTrusted` | stubbed (M2) | `true` for dispatched events (matches jsdom) |
| `CustomEvent.detail` | supported (M2) | |
| `MouseEvent` (clientX, clientY, button, buttons, altKey, …) | supported (M2) | user-event needs coords |
| `KeyboardEvent` (key, code, ctrlKey, shiftKey, altKey, metaKey, repeat) | supported (M2) | keyboard suite |
| `PointerEvent`, `FocusEvent`, `InputEvent` | supported (M2) | user-event synthesizes |

### Focus
| API | status | notes |
|---|---|---|
| `HTMLElement.focus()`, `.blur()` | supported (M2) | |
| `Document.activeElement` | supported (M2) | keyboard nav suite |
| `Element.tabIndex` (get + set) | supported (M2) | |
| `Element.matches(":focus")` | supported (M2) | |

### Motion-path / layout (pre-layout behavior)
| API | status | notes |
|---|---|---|
| `Element.getBoundingClientRect()` | stubbed (M2) | returns `{0,0,0,0,...}` at M2; real in M4 |
| `Element.getClientRects()` | stubbed (M2) | `[rect]` of stub rect |
| `HTMLElement.offsetWidth/Height/Top/Left` | stubbed (M2) | `0` at M2 |
| `HTMLElement.clientWidth/Height` | stubbed (M2) | `0` at M2 |
| `HTMLElement.scrollWidth/Height/Top/Left` | stubbed (M2) | `0` at M2 |
| `HTMLElement.style` (get + assign CSSOM values) | supported (M2) | motion writes inline styles |
| `getComputedStyle(el)` | stubbed (M2) | returns default-valued proxy; real in M3 |
| `Element.animate()` | stubbed (M2) | returns animation that resolves next microtask |
| `Element.getAnimations()` | stubbed (M2) | `[]` |

### Scheduling
| API | status | notes |
|---|---|---|
| `queueMicrotask` | supported (M2) | native |
| `Promise` | supported (M2) | native |
| `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` | supported (M2) | Node built-in |
| `requestAnimationFrame(fn)` | stubbed (M2) | `queueMicrotask(fn)`; real frame scheduler in M5 |
| `cancelAnimationFrame(id)` | stubbed (M2) | noop |

### Window + history + location
| API | status | notes |
|---|---|---|
| `Window.innerWidth`, `innerHeight` | stubbed (M2) | 1280 × 720 default |
| `Window.devicePixelRatio` | stubbed (M2) | `1` |
| `Window.location.href`, `.origin`, `.pathname` | stubbed (M2) | `about:blank` |
| `Window.history.pushState`, `replaceState` | stubbed (M2) | noops |
| `Window.matchMedia(q)` | stubbed (M2) | `{ matches: false, addListener: noop, … }` |

### Observers
| API | status | notes |
|---|---|---|
| `MutationObserver` | stubbed (M2) | `observe`, `disconnect` noops; fires nothing |
| `ResizeObserver` | stubbed (M2) | same |
| `IntersectionObserver` | stubbed (M2) | same |
| `PerformanceObserver` | stubbed (M2) | `observe`, `disconnect` noops; real in M7 |

### Other
| API | status | notes |
|---|---|---|
| `HTMLElement.ownerDocument` | supported (M2) | |
| `Node.isConnected` | supported (M2) | reachable from `document` |
| `Node.nodeName`, `nodeType`, `parentNode`, `childNodes`, `firstChild`, `lastChild`, `nextSibling`, `previousSibling` | supported (M2) | |
| `Element.tagName` | supported (M2) | |
| `Element.namespaceURI` | stubbed (M2) | `"http://www.w3.org/1999/xhtml"` |
| `Range`, `Selection` | stubbed (M2) | motion/RTL may not touch in this fixture |

## Dynamic harvest (2026-04-28)
- Method: `PERRR_HARVEST=1 pnpm -F perrr test:acceptance` with happy-dom backend wrapped by `perrr-dom-shim/src/harvest.js`.
- Run scope: `fixtures/acceptance/components/accordion.test.tsx` (39/39 green).
- Unique APIs: **72**. Total calls: **121,833**.
- Output artifact: `packages/perrr/.perrr/miss-log.json` (gitignored).
- Harvest limitations: method calls on `Document.prototype` (e.g. `createElement`) did not show up because happy-dom exposes them via own-property prototypes outside our PROTOTYPE_KEYS walker. Not a gap for M2c — we know those are called.

### Tier 1 — hot path (>1k calls/run)
Implement natively with per-call overhead < 500 ns target.

| API | calls | backend plan |
|---|---|---|
| `Node.get nodeType` | 19,276 | `u8` constant in `NodeKind`, no N-API call; cache on JS facade |
| `Element.getAttribute` | 13,110 | native, linear scan over small attr vec |
| `Event.get eventPhase` | 12,850 | JS-side Event instance field |
| `Event.get type` | 11,623 | JS-side |
| `Element.get localName` | 11,574 | `&str` from native; cache in facade |
| `Node.get parentNode` | 6,253 | native single-field read |
| `Node.getRootNode` | 5,684 | native walk to ancestor root |
| `Element.matches` | 5,535 | native `selectors` crate match |
| `Element.get shadowRoot` | 5,344 | JS-side: always `null` |
| `Element.setAttribute` | 4,197 | native attr vec mutation |
| `Node.get ownerDocument` | 3,793 | JS-side: singleton `Document` |
| `HTMLElement.get style` | 2,970 | JS-side `CSSStyleDeclaration` proxy; writes buffered in facade, flushed to native on read-back |
| `Element.get tagName` | 2,455 | native `&str` (upper-case) |
| `Element.get namespaceURI` | 2,354 | stubbed constant: `"http://www.w3.org/1999/xhtml"` |
| `Element.get nodeName` | 1,784 | same as tagName for elements |
| `Node.get parentElement` | 1,730 | native (parentNode if element) |
| `Element.getAttributeNode` | 1,404 | native; returns small `Attr` DTO |
| `Element.hasAttribute` | 1,043 | native |
| `Event.get target` | 1,006 | JS-side |

### Tier 2 — warm (100–1000 calls/run)

| API | calls | backend plan |
|---|---|---|
| `HTMLButtonElement.dispatchEvent` | 963 | native dispatch; JS facade marshals Event to NodeId + fires |
| `Node.appendChild` | 715 | native op |
| `Node.get childNodes` | 510 | native: returns NodeId[] snapshot |
| `Event.composedPath` | 482 | JS-side (no Shadow DOM) |
| `HTMLElement.get hidden` | 454 | JS-side attr reflection |
| `HTMLButtonElement.get type` | 350 | JS-side attr reflection (default "submit") |
| `Event.get defaultPrevented` | 330 | JS-side |
| `HTMLElement.get onfocusin` | 228 | JS-side: null default |
| `Element.get id` | 223 | native attr |
| `HTMLElement.get contentEditable` | 221 | JS-side attr reflection (default "inherit") |
| `HTMLElement.set onclick` | 172 | JS-side; registers via `addEventListener("click", fn)` |
| `Element.set textContent` | 158 | native: remove children, insert text node |
| `HTMLElement.get onclick` | 152 | JS-side |
| `HTMLElement.get onpointerdown` | 137 | JS-side |
| `HTMLElement.get onpointerup` | 137 | JS-side |
| `HTMLElement.get onmousedown` | 130 | JS-side |
| `HTMLElement.get onmouseup` | 130 | JS-side |
| `Event.get cancelable` | 128 | JS-side |
| `HTMLButtonElement.get labels` | 123 | stub: empty NodeList at M2 |
| `HTMLElement.get onpointerover` | 116 | JS-side |
| `HTMLElement.get onmouseover` | 116 | JS-side |
| `HTMLElement.get onpointermove` | 116 | JS-side |
| `HTMLElement.get onmousemove` | 116 | JS-side |
| `Event.get bubbles` | 110 | JS-side |
| `Event.get timeStamp` | 110 | JS-side (`performance.now()` at construction; virtual at M5) |
| `Node.get firstChild` | 101 | native single-field read |

### Tier 3 — cool (10–100 calls/run)

| API | calls | backend plan |
|---|---|---|
| `Element.getBoundingClientRect` | 99 | stubbed: `{0,0,0,0,...}` at M2; real in M4 |
| `Element.removeAttribute` | 95 | native |
| `Node.removeChild` | 89 | native |
| `Node.get previousSibling` | 89 | native |
| `Node.get nextSibling` | 89 | native |
| `HTMLButtonElement.get disabled` | 83 | JS-side attr reflection (bool) |
| `Element.querySelectorAll` | 79 | native `selectors` crate |
| `HTMLElement.get onpointerenter` | 78 | JS-side |
| `HTMLElement.get onmouseenter` | 78 | JS-side |
| `HTMLElement.get onkeydown` | 77 | JS-side |
| `HTMLElement.get onkeyup` | 77 | JS-side |
| `HTMLElement.get onfocusout` | 63 | JS-side |
| `HTMLElement.get onpointerout` | 44 | JS-side |
| `HTMLElement.get onmouseout` | 44 | JS-side |
| `HTMLElement.focus` | 33 | native (updates `active_element`) |
| `HTMLElement.get onfocus` | 33 | JS-side |
| `Element.get role` | 33 | JS-side attr reflection |
| `Node.contains` | 24 | native ancestor walk |
| `Element.closest` | 23 | native |
| `Event.preventDefault` | 18 | JS-side |
| `Element.get scrollTop` | 14 | stubbed `0` at M2 |
| `Element.set scrollTop` | 14 | stubbed noop at M2 |
| `Element.set scrollLeft` | 14 | stubbed noop at M2 |

### Tier 4 — cold (<10 calls/run)

| API | calls | backend plan |
|---|---|---|
| `HTMLElement.blur` | 9 | native (clears `active_element`) |
| `HTMLElement.get onblur` | 9 | JS-side |
| `HTMLElement.get onpointerleave` | 6 | JS-side |
| `HTMLElement.get onmouseleave` | 6 | JS-side |

### Gap list — called but not yet instrumented
_(known-called by observation; harvest missed them due to PROTOTYPE_KEYS walker not reaching these prototypes)_

- `Document.createElement`, `Document.createElementNS`, `Document.createTextNode`, `Document.createDocumentFragment`, `Document.createComment`, `Document.createEvent`
- `Document.querySelector`, `Document.querySelectorAll`, `Document.getElementById`
- `Document.body`, `Document.documentElement`, `Document.head`
- `Event.stopPropagation`, `Event.stopImmediatePropagation`, `Event.initEvent`
- `EventTarget.addEventListener`, `EventTarget.removeEventListener` (on non-HTMLElement targets)

All of Tier 1+2 reachability implies these ARE called; M2c implementation plan covers them explicitly.

## Native-readiness snapshot (end of round 4e.vi)

| surface | native in perrr-dom? | measured-equivalent-to-HD? |
|---|---|---|
| Tree mutation (appendChild, insertBefore, removeChild, replaceChild-via-insert+remove, setAttribute, removeAttribute, toggleAttribute, CharacterData data/nodeValue setters, Element.textContent setter) | ✓ | ✓ (4,351 strict-mode per-op diffs, 0 divergence) |
| Metadata reads (nodeType, localName, tagName, nodeName, namespaceURI, parentNode, parentElement, ownerDocument, rootNode, first/last/next/previous/childNodes, contains) | ✓ | indirect (shape checks catch any difference) |
| Attribute ops (getAttribute, hasAttribute, setAttribute, removeAttribute, attributeNames, idAttr) | ✓ (HTML lowercase; SVG preserves case) | ✓ (H8 regression test + strict shape check) |
| Selector queries (matches, querySelector, querySelectorAll, closest) | ✓ | ✓ (5,637 real-fixture queries + ~500 fuzz queries; one HD bug found — see H2) |
| Focus tracking (focus, blur, activeElement) | ✓ | ✓ (H9 closed; activeElement spec-compliant; dual harness verifies on every read) |
| Text content | ✓ | ✓ (after H1d fix; 158 previously-unmirrored setter calls now verified per-op) |
| Listener counter (incrListener, decrListener, listenerCount, totalListenerCount) | ✓ | no HD equivalent (perrr-specific metric for M8) |
| addEventListener / removeEventListener | ✓ (full registry: id, type, capture, once, passive; spec dedup) | ✓ (H10a+H10b closed) |
| has_listener_of_type | ✓ | — (foundation for dispatch path) |
| Event dispatch (dispatchEvent, capture/target/bubble, preventDefault, stopPropagation) | ✗ | ✗ (H10c open — HD still handles actual firing) |
| Layout APIs (getBoundingClientRect, offsetWidth/Height, clientWidth/Height, scrollWidth/Height) | ✗ | ✗ (stubbed zeros; M4 work) |
| getComputedStyle | ✗ | ✗ (stubbed; M3 work) |
| MutationObserver / ResizeObserver / IntersectionObserver / PerformanceObserver | ✗ | ✗ (noop stubs; M7 for PerformanceObserver, later for others if fixtures demand) |

## Plan for M2c ordering
1. Swap facade to route reads through perrr-dom for already-native APIs; run dual-mode acceptance; expect zero divergence (shape + query already proven).
2. Implement event dispatch in perrr-dom (addEventListener/removeEventListener/dispatchEvent with capture/target/bubble). Close H10.
3. Add activeElement read-side parity check in dual harness (close H9).
4. Uninstall happy-dom from the env; run acceptance. Fix any new divergence.

## Changelog
- 2026-04-28: initial static pre-pass (pre-M2a).
- 2026-04-28: dynamic harvest from 4b/4c landed. 72 unique APIs, 121,833 calls, sorted into 4 tiers. Status moved from draft → approved. Pre-M2a static table now superseded by tiers below.
- 2026-04-28: added §Backend reality at M2 to clarify that "(M2)" status in the static pre-pass currently means "happy-dom-backed", not natively implemented. Added native-readiness snapshot table reflecting perrr-dom's actual implementation state at end of round 4e.vi.
