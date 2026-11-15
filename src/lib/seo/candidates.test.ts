import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderCandidates, parseCsv, CSV_PATH, OUT_PATH } from "../../../scripts/seo/import-candidates";
import { CANDIDATES } from "./candidates";
import { PAGES } from "./pages";

const root = resolve(__dirname, "..", "..", "..");

describe("candidates.ts", () => {
  it("equals the generator output for docs/seo/page-audit-v2.csv", () => {
    const expected = renderCandidates(readFileSync(resolve(root, CSV_PATH), "utf8"));
    expect(readFileSync(resolve(root, OUT_PATH), "utf8")).toBe(expected);
  });

  it("holds every row of the audit (195) with unique ids", () => {
    const rows = parseCsv(readFileSync(resolve(root, CSV_PATH), "utf8")).length - 1;
    expect(CANDIDATES).toHaveLength(rows);
    expect(CANDIDATES).toHaveLength(195);
    expect(new Set(CANDIDATES.map((c) => c.pageId)).size).toBe(195);
  });

  it("parses quoted commas and doubled quotes", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });

  it("agrees with the page registry: a registered page that has an audit row keeps the audit path", () => {
    const byId = new Map(CANDIDATES.map((c) => [c.pageId, c]));
    for (const p of PAGES) {
      const c = byId.get(p.pageId);
      if (c) expect(p.path, p.pageId).toBe(c.path);
    }
  });
});
