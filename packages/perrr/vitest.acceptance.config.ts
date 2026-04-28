// Spec: specs/milestones/m2-dom-shim.md (§Design)
// Runs acceptance fixtures under the "perrr" environment.
//
// Consumers: `pnpm -F perrr test:acceptance`

import path from "node:path";
import { defineConfig } from "vitest/config";

// Normalize to forward slashes so globs work on Windows.
const fixturesDir = path
  .resolve(__dirname, "../../fixtures/acceptance")
  .replaceAll("\\", "/");

export default defineConfig({
  test: {
    environment: "perrr",
    include: [
      `${fixturesDir}/components/**/*.test.tsx`,
      "./test/dual-sanity.test.ts",
    ],
    globals: false,
  },
  resolve: {
    alias: [
      { find: /^@\/lib\/(.+)$/, replacement: `${fixturesDir}/lib/$1` },
      { find: /^@\/bench\/(.+)$/, replacement: `${fixturesDir}/bench/$1` },
    ],
  },
});
