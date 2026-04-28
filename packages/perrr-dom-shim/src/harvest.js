// perrr-dom-shim / harvest
// Spec: specs/milestones/m2-dom-shim.md §M2b
//       specs/overview/03-dom-api-coverage.md
//
// Wraps selected DOM prototypes with a method-call counter so that
// after running the acceptance suite we can sort APIs by frequency
// and drive M2c implementation priority.

/** @type {Map<string, number>} */
const callCounts = new Map();

/** @type {Array<{proto: object, key: string, original: any}>} */
const patched = [];

const PROTOTYPE_KEYS = [
  "Node",
  "Element",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLDivElement",
  "HTMLSpanElement",
  "HTMLAnchorElement",
  "HTMLHeadingElement",
  "HTMLFormElement",
  "HTMLParagraphElement",
  "HTMLLIElement",
  "HTMLUListElement",
  "HTMLOListElement",
  "Text",
  "Comment",
  "DocumentFragment",
  "Document",
  "EventTarget",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "PointerEvent",
  "FocusEvent",
  "InputEvent",
];

function shouldSkipKey(key) {
  if (typeof key !== "string") return true;
  if (key === "constructor") return true;
  // Skip well-known symbol-shaped strings
  if (key.startsWith("__")) return true;
  return false;
}

export function installHarvestInstrumentation(globalScope) {
  for (const ctorName of PROTOTYPE_KEYS) {
    const ctor = globalScope[ctorName];
    if (!ctor || !ctor.prototype) continue;
    const proto = ctor.prototype;
    const ownKeys = Object.getOwnPropertyNames(proto);
    for (const key of ownKeys) {
      if (shouldSkipKey(key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (!descriptor) continue;
      if (typeof descriptor.value === "function") {
        const original = descriptor.value;
        const counterKey = `${ctorName}.${key}`;
        const wrapped = function (...args) {
          callCounts.set(counterKey, (callCounts.get(counterKey) ?? 0) + 1);
          return original.apply(this, args);
        };
        // Preserve name + length for frameworks that read them
        Object.defineProperty(wrapped, "name", { value: original.name });
        Object.defineProperty(proto, key, {
          ...descriptor,
          value: wrapped,
        });
        patched.push({ proto, key, original: descriptor });
      } else if (descriptor.get || descriptor.set) {
        const getterKey = `${ctorName}.get ${key}`;
        const setterKey = `${ctorName}.set ${key}`;
        const originalGet = descriptor.get;
        const originalSet = descriptor.set;
        Object.defineProperty(proto, key, {
          configurable: true,
          enumerable: descriptor.enumerable,
          get: originalGet
            ? function () {
                callCounts.set(
                  getterKey,
                  (callCounts.get(getterKey) ?? 0) + 1,
                );
                return originalGet.call(this);
              }
            : undefined,
          set: originalSet
            ? function (v) {
                callCounts.set(
                  setterKey,
                  (callCounts.get(setterKey) ?? 0) + 1,
                );
                return originalSet.call(this, v);
              }
            : undefined,
        });
        patched.push({ proto, key, original: descriptor });
      }
    }
  }
}

export function uninstallHarvestInstrumentation() {
  for (const { proto, key, original } of patched) {
    Object.defineProperty(proto, key, original);
  }
  patched.length = 0;
}

export function getCallLog() {
  return Object.fromEntries(
    [...callCounts.entries()].sort((a, b) => b[1] - a[1]),
  );
}

export function clearCallLog() {
  callCounts.clear();
}

export function summarizeCallLog() {
  const entries = [...callCounts.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return {
    uniqueApis: entries.length,
    totalCalls: total,
    all: entries,
  };
}
