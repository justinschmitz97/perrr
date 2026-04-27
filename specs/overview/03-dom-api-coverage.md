---
title: dom api coverage matrix
kind: overview
status: draft
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

## Static pre-pass (from fixture reading)
_Not authoritative. Will be superseded by M2a harvest._

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

## Dynamic harvest (M2a)
_Populated during M2a run. Format below._

| API | status | caller | required-for-green | plan |
|---|---|---|---|---|
| _(empty until M2a runs)_ | | | | |

## Changelog
- 2026-04-28: initial static pre-pass (pre-M2a). Dynamic harvest table empty.
