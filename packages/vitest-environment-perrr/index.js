// vitest-environment-perrr
// M2a stub: registers the "perrr" environment with Vitest but installs
// no globals. Triggers the planned red test "document is not defined"
// when accordion.test.tsx runs.
//
// Real implementation arrives in M2b/M2c: installs native-backed
// window + document + HTMLElement via perrr-dom-shim.
//
// Spec: specs/milestones/m2-dom-shim.md
// Decision: specs/decisions/0003-vitest-environment-package-naming.md

/** @type {import('vitest/environments').Environment} */
export default {
  name: "perrr",
  viteEnvironment: "client",
  setup() {
    // Intentionally empty at M2a. No DOM globals installed.
    return {
      teardown() {
        // noop
      },
    };
  },
};
