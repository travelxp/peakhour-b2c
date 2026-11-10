import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Horizontal-overflow guard. Both the inset and the scroll column are flex
 * items whose automatic minimum width is their content's min-content, so one
 * nowrap strip (PillarTabs, a kanban board, a wide table) made the whole
 * column as wide as that strip and pushed the page past the viewport by the
 * sidebar's width. `min-w-0` lets them shrink, so wide children scroll inside
 * themselves instead.
 */
const src = readFileSync(join(__dirname, "layout.tsx"), "utf8");

describe("dashboard shell can shrink below its widest child", () => {
  it("SidebarInset carries min-w-0", () => {
    expect(src).toMatch(/<SidebarInset className="[^"]*\bmin-w-0\b[^"]*">/);
  });

  it("the scroll container carries min-w-0 beside overflow-auto", () => {
    const m = src.match(/<div className="([^"]*\boverflow-auto\b[^"]*)">/);
    expect(m, "scroll container not found").not.toBeNull();
    expect(m![1]).toMatch(/\bmin-w-0\b/);
    expect(m![1]).toMatch(/\bflex-1\b/);
  });
});
