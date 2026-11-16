import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAGES } from "../../src/lib/seo/pages";
import { BEGIN, END, REPORT_PATH, pagesTable, withTable } from "./report-pages";

describe("the gap report's page table", () => {
  const doc = readFileSync(REPORT_PATH, "utf8");

  it("has one row per registry page", () => {
    const rows = pagesTable().split("\n").filter((l) => l.startsWith("| `/"));
    expect(rows).toHaveLength(PAGES.length);
  });

  it("is what the registry produces now (run `npx tsx scripts/seo/report-pages.ts --write`)", () => {
    const between = doc.slice(doc.indexOf(BEGIN) + BEGIN.length, doc.indexOf(END)).trim().replace(/\r\n/g, "\n");
    expect(between).toBe(pagesTable());
  });

  it("splices a table between the markers and nothing else", () => {
    const out = withTable(`a\n${BEGIN}\nold\n${END}\nz\n`, "T");
    expect(out).toBe(`a\n${BEGIN}\n\nT\n\n${END}\nz\n`);
    expect(() => withTable("no markers", "T")).toThrow(/markers/);
  });
});
