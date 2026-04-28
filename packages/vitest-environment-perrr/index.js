// vitest-environment-perrr
// Spec: specs/milestones/m2-dom-shim.md
// Decision: specs/decisions/0003-vitest-environment-package-naming.md
//
// At M2a: registered env, no DOM (red test).
// At 4b: happy-dom-backed DOM via perrr-dom-shim (temporary). Harvest
//        mode optional via env var PERRR_HARVEST=1.
// At M2c: perrr-dom native; happy-dom goes away.

import {
  installGlobals,
  uninstallGlobals,
  summarizeCallLog,
  clearCallLog,
} from "perrr-dom-shim";
import {
  installDualBackend,
  disposeDualBackend,
  verifyDualShapes,
  getDivergences,
} from "perrr-dom-shim/dual";
import fs from "node:fs";
import path from "node:path";

const harvest = process.env["PERRR_HARVEST"] === "1";
const dual = process.env["PERRR_DUAL"] === "1";
const dualStrict = process.env["PERRR_DUAL_STRICT"] === "1";

/** @type {import('vitest/environments').Environment} */
export default {
  name: "perrr",
  viteEnvironment: "client",
  setup() {
    if (harvest) clearCallLog();
    installGlobals({ harvest });
    if (dual || dualStrict) installDualBackend({ strict: dualStrict });
    return {
      async teardown() {
        if (harvest) {
          const summary = summarizeCallLog();
          const outDir = path.resolve(process.cwd(), ".perrr");
          fs.mkdirSync(outDir, { recursive: true });
          fs.writeFileSync(
            path.join(outDir, "miss-log.json"),
            JSON.stringify(summary, null, 2),
          );
        }
        if (dual || dualStrict) {
          try {
            const stats = verifyDualShapes();
            const outDir = path.resolve(process.cwd(), ".perrr");
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(
              path.join(outDir, "dual-report.json"),
              JSON.stringify(
                {
                  mode: dualStrict ? "strict" : "loose",
                  stats,
                  divergences: getDivergences(),
                },
                null,
                2,
              ),
            );
          } finally {
            disposeDualBackend();
          }
        }
        await uninstallGlobals();
      },
    };
  },
};
