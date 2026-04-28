// perrr-dom-shim
// Spec: specs/packages/perrr-dom-shim/spec.md
//
// M2 strategy: ship a *temporary* happy-dom-backed DOM so the Vitest
// environment is end-to-end-green first. M2c then replaces happy-dom
// with perrr-dom (native) one surface at a time, tracked in
// specs/overview/03-dom-api-coverage.md.
//
// The public API (`installGlobals`, `uninstallGlobals`, `resetDocument`)
// is contract-stable; only the backend is transient.

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
  installHarvestInstrumentation,
  uninstallHarvestInstrumentation,
} from "./harvest.js";

let installed = false;
let harvestActive = false;

/**
 * Install DOM globals (window, document, HTMLElement, …) onto globalThis.
 * Idempotent within a process.
 *
 * @param {object} [options]
 * @param {{width?: number, height?: number}} [options.viewport]
 * @param {string} [options.url]
 * @param {boolean} [options.harvest] — if true, wrap key DOM prototypes
 *   with a call-counter. See specs/milestones/m2-dom-shim.md §M2b.
 */
export function installGlobals(options = {}) {
  if (installed) return;
  GlobalRegistrator.register({
    url: options.url ?? "http://localhost/",
    width: options.viewport?.width ?? 1280,
    height: options.viewport?.height ?? 720,
  });
  installed = true;

  if (options.harvest) {
    installHarvestInstrumentation(globalThis);
    harvestActive = true;
  }
}

/**
 * Remove DOM globals and release the happy-dom Window.
 */
export async function uninstallGlobals() {
  if (!installed) return;
  if (harvestActive) {
    uninstallHarvestInstrumentation(globalThis);
    harvestActive = false;
  }
  await GlobalRegistrator.unregister();
  installed = false;
}

/**
 * Reset the document to `<html><head></head><body></body></html>`.
 * Does NOT re-install globals; call between tests for fresh DOM state.
 */
export function resetDocument() {
  if (!installed) return;
  const doc = /** @type {Document} */ (globalThis.document);
  if (!doc) return;
  // Clear attributes and children of <html>
  doc.documentElement.innerHTML = "<head></head><body></body>";
}

export { getCallLog, clearCallLog, summarizeCallLog } from "./harvest.js";
