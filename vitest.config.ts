import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config for peakhour-b2c unit tests.
 *
 * Scope (today): pure, DOM-free logic — the composer caret helpers,
 * and any future framework-agnostic util. `environment: "node"` keeps
 * the runner lightweight (no jsdom) since nothing under test touches
 * the DOM. When a primitive needs DOM/React-testing-library coverage,
 * add `@testing-library/react` + `jsdom` and flip per-file via a
 * `// @vitest-environment jsdom` docblock rather than globally.
 *
 * The `@/*` alias mirrors tsconfig.json so test imports match app code.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
