// Spec: specs/crates/perrr-node/spec.md
// Milestone: specs/milestones/m1-workspace-skeleton.md

import { describe, it, expect } from "vitest";
import { hello } from "..";

describe("perrr binding", () => {
  it("hello() returns 'ok'", () => {
    expect(hello()).toBe("ok");
  });
});
