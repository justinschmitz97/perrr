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
const strictMode = process.env["PERRR_DUAL_STRICT"] === "1";

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

  it("query counter advances on matches/querySelector calls", async () => {
    const { getDivergences: getDivs, clearDivergences } = await import(
      // @ts-expect-error
      "perrr-dom-shim/dual"
    );
    clearDivergences();
    const baseStats = verifyDualShapes();
    const el = document.createElement("button");
    el.setAttribute("data-state", "open");
    document.body.appendChild(el);
    // Real-world query shapes from the accordion harvest.
    el.matches("[data-state=open]");
    el.matches("button");
    el.closest("[data-state]");
    document.querySelector("button");
    document.querySelectorAll("[data-state]");
    const afterStats = verifyDualShapes();
    expect(afterStats.queriesChecked).toBeGreaterThan(baseStats.queriesChecked);
    expect(getDivs().length).toBe(0);
    el.remove();
  });

  it("query detector fires on injected native-side divergence", async () => {
    // @ts-expect-error
    const { getDivergences: getDivs, clearDivergences } = await import(
      "perrr-dom-shim/dual"
    );
    clearDivergences();
    const el = document.createElement("button");
    el.setAttribute("data-state", "open");
    document.body.appendChild(el);

    const native = nativeInstance();
    const id = getDualIdOf(el);

    // Inject: flip native attr so HD and native disagree on an attr
    // that selector matchers care about.
    native!.setAttribute(id!, "data-state", "closed");

    el.matches("[data-state=open]");

    const divs = getDivs();
    const readDivs = divs.filter((d: any) => d.kind === "read-divergence");
    expect(readDivs.length).toBeGreaterThan(0);
    expect(readDivs[0].op).toBe("matches");

    // Restore parity.
    native!.setAttribute(id!, "data-state", "open");
    el.remove();
    clearDivergences();
  });

  it("textContent mirror keeps trees in sync (H1d regression guard)", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.textContent = "Trigger 0";
    expect(() => verifyDualShapes()).not.toThrow();
    btn.textContent = "Trigger 1";
    expect(() => verifyDualShapes()).not.toThrow();
    btn.textContent = "";
    expect(() => verifyDualShapes()).not.toThrow();
    btn.remove();
  });

  // H4b / H4a deliberately inject unfixable divergence to validate the
  // detector. In strict mode the injection throws immediately (which
  // IS the proof, but makes the test un-runnable as a standalone unit).
  // We use loose mode here; strict mode's catch behavior is proven by
  // the "strict mode catches bimap miss at mutation time" test below.
  it.skipIf(strictMode)("H4b — missedMirrorCount increments on bimap miss", async () => {
    // @ts-expect-error
    const { clearDivergences, getDualStats } = await import(
      "perrr-dom-shim/dual"
    );
    clearDivergences();
    const before = getDualStats();
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    // Construct a child node but delete its bimap entry to force a
    // bimap miss on the subsequent hooked mutation.
    const child = document.createElement("span");
    // @ts-expect-error — accessing internal bimap for the self-test.
    const dualState = (globalThis as any).__perrr_dual_state__?.state;
    dualState.idOf.delete(child);
    parent.appendChild(child);
    const after = getDualStats();
    expect(after.missedMirrorCount).toBeGreaterThan(before.missedMirrorCount);

    // Clean up both sides back to parity so env-teardown doesn't fire.
    // Remove child from HD manually (it's attached to parent); native
    // already has no knowledge of it.
    parent.removeChild(child);
    parent.remove();
  });

  it.skipIf(strictMode)("H4a — HD-throws, mirror-didn't-run stays consistent", () => {
    // happy-dom throws on setAttribute with an invalid name ("" is invalid).
    const el = document.createElement("div");
    document.body.appendChild(el);
    let hdThrew = false;
    try {
      el.setAttribute("", "x");
    } catch {
      hdThrew = true;
    }
    // Either HD throws or accepts; whatever it does, native mirror
    // path is guarded by `original.apply` running first, so if HD
    // threw, the mirror never ran — and native is unchanged.
    // Post-state must be equivalent.
    expect(() => verifyDualShapes()).not.toThrow();
    el.remove();
    // Document the observation regardless of HD's spec conformance.
    // (HD happens to accept "" without throwing at the time of writing.)
    void hdThrew;
  });

  it("H8 — mixed-case HTML attribute names agree between backends", () => {
    // HTML attribute names are supposed to be case-insensitive (per
    // spec stored in ASCII-lowercase form). If HD lowercases on set
    // but perrr-dom preserves, the serialized trees diverge.
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.setAttribute("Data-State", "OPEN");
    el.setAttribute("ARIA-expanded", "true");
    // Shape check: if HD and perrr-dom normalize differently, this
    // throws (name ordering in the serializer would also surface it).
    expect(() => verifyDualShapes()).not.toThrow();
    // Both sides should report the attribute under its lowercase
    // lookup name (HTML-spec behavior). If either side is case-sensitive
    // on READ, this fails.
    expect(el.getAttribute("data-state")).toBe(el.getAttribute("Data-State"));
    el.remove();
  });

  it.skipIf(!strictMode)("strict mode throws at the op that introduces divergence", async () => {
    // @ts-expect-error
    const { clearDivergences } = await import("perrr-dom-shim/dual");
    clearDivergences();
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const child = document.createElement("span");
    const dualState = (globalThis as any).__perrr_dual_state__?.state;
    dualState.idOf.delete(child);

    // In strict mode, appendChild verifies after mutation → throws.
    expect(() => parent.appendChild(child)).toThrowError(
      /STRICT divergence after op/,
    );

    // Restore parity by rebuilding bimap manually: remove span from HD,
    // clear the (still-divergent) state so env teardown is clean. We
    // can't easily reconcile via public APIs, so tear down the whole
    // divergent parent.
    try {
      parent.removeChild(child);
    } catch {
      /* may or may not fire through strict again */
    }
    try {
      parent.remove();
    } catch {
      /* ditto */
    }
  });
});
