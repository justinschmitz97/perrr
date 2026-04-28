// Self-test for the differential DOM harness: proves verifyDualShapes
// actually detects divergence. A detector that never fires is a sham.
//
// Spec: specs/milestones/m2-dom-shim.md §4e.ii

import { describe, it, expect } from "vitest";
// @ts-expect-error — workspace package without types at M2
import {
  verifyDualShapes,
  nativeInstance,
  getDualIdOf,
} from "perrr-dom-shim/dual";

const dualMode =
  process.env["PERRR_DUAL"] === "1" || process.env["PERRR_DUAL_STRICT"] === "1";

describe.skipIf(!dualMode)("dual harness self-test", () => {
  it("baseline: trees match after creating + inserting an element", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    expect(() => verifyDualShapes()).not.toThrow();
    div.remove();
  });

  it("detects silent divergence: native-only mutation", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);

    const native = nativeInstance();
    const id = getDualIdOf(div);
    expect(id).not.toBeNull();
    expect(native).not.toBeNull();

    // Bypass the facade hooks: write only to native. Trees now disagree.
    native!.setAttribute(id!, "injected-native-only", "diverge");

    expect(() => verifyDualShapes()).toThrowError(/divergence/i);

    // Cleanup: remove the injected attr so afterEach teardown is clean.
    native!.removeAttribute(id!, "injected-native-only");
    div.remove();
  });

  it("detects silent divergence: happy-dom-only mutation", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);

    // Bypass our hooks by setting an attribute via a *stashed* original
    // setter. For simplicity we mutate via childNodes manipulation — add
    // a text child on the happy-dom side only by going through a method
    // we don't hook: innerHTML.
    div.innerHTML = "<span>leak</span>";

    expect(() => verifyDualShapes()).toThrowError(/divergence/i);

    // Restore parity for teardown.
    div.innerHTML = "";
    // innerHTML="" clears on HD but leaves native stale; teardown would
    // also diverge. Force-clear both:
    const native = nativeInstance();
    const id = getDualIdOf(div);
    if (native && id != null) {
      for (const c of native.children(id)) native.removeChild(id, c);
    }
    div.remove();
  });

  it("op counter advances for each mirrored mutation", () => {
    const stats1 = verifyDualShapes();
    const a = document.createElement("div");
    document.body.appendChild(a);
    a.setAttribute("x", "1");
    a.removeAttribute("x");
    a.remove();
    const stats2 = verifyDualShapes();
    // Strict mode counts; loose mode reports 0.
    if (stats1.strict) {
      expect(stats2.mutationsChecked).toBeGreaterThan(stats1.mutationsChecked);
    }
  });
});
