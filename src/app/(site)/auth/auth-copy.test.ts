import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SEO-7 took "Five modules" off every public surface because Support is not live (plan Q3). The sign-in panel was the one left.
describe("/auth sign-in panel", () => {
  const src = readFileSync(path.join(__dirname, "auth-flow.tsx"), "utf8");

  it("does not promise five modules, and says Support is coming soon", () => {
    expect(src).not.toMatch(/Five modules/i);
    expect(src).toMatch(/Support\s+coming soon/);
  });
});
