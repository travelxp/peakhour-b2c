import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVAL_LINE, APPROVALS_BEGIN, APPROVALS_END, formatApprovalLine, parseApprovalsSource } from "./approvals-format";
import { PAGE_APPROVALS } from "./approvals";
import { PAGES } from "./pages";
import { capabilitiesSatisfied, currentContentHash } from "./publish";

const SOURCE = readFileSync(path.resolve(__dirname, "approvals.ts"), "utf8");

describe("approvals.ts, the file the api edits by text", () => {
  it("parses with the line format the api relies on, and the parse equals the exported rows", () => {
    expect(parseApprovalsSource(SOURCE)).toEqual(PAGE_APPROVALS);
  });

  it("holds one object per line between the two marker lines, sorted by pageId, one row per page", () => {
    const lines = SOURCE.split(/\r?\n/);
    const a = lines.findIndex((l) => l.trim() === APPROVALS_BEGIN);
    const b = lines.findIndex((l) => l.trim() === APPROVALS_END);
    expect(a).toBeGreaterThan(0);
    const body = lines.slice(a + 1, b);
    expect(body.length).toBe(PAGE_APPROVALS.length);
    for (const l of body) expect(l, l).toMatch(APPROVAL_LINE);
    const ids = PAGE_APPROVALS.map((r) => r.pageId);
    expect(ids).toEqual([...ids].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("round-trips a row through the one formatter, and refuses a line that is not that shape", () => {
    const row = { pageId: "x.y", contentHash: `sha256:${"a".repeat(64)}`, reviewer: "Asha Rao", approvedAt: "2026-11-16", source: "cms" as const };
    expect(APPROVAL_LINE.exec(formatApprovalLine(row))).not.toBeNull();
    expect(parseApprovalsSource(`${APPROVALS_BEGIN}\n${formatApprovalLine(row)}\n${APPROVALS_END}`)).toEqual([row]);
    expect(() => parseApprovalsSource(`${APPROVALS_BEGIN}\n  { pageId: "x", reviewer: "a" },\n${APPROVALS_END}`)).toThrow(/row format/);
    expect(() => parseApprovalsSource("no markers")).toThrow(/markers/);
    // A reviewer name with a double quote would break the line, so the format refuses it.
    expect(APPROVAL_LINE.test(formatApprovalLine({ ...row, reviewer: 'A "B"' }))).toBe(false);
  });

  it("names only registry pages, at the current hash, each a placeholder by owner dated from the capability records", () => {
    const ids = new Set(PAGES.map((p) => p.pageId));
    for (const r of PAGE_APPROVALS) {
      expect(ids.has(r.pageId), r.pageId).toBe(true);
      expect(r.contentHash, r.pageId).toBe(currentContentHash(r.pageId));
      expect(r.source).toBe("placeholder");
      expect(r.reviewer).toBe("owner");
      expect(r.approvedAt).toBe("2026-11-15");
    }
  });

  it("seeds exactly the pages published before approvals began (53)", () => {
    const before = PAGES.filter((p) => p.editorialStatus === "published" && p.indexable && capabilitiesSatisfied(p)).map((p) => p.pageId).sort();
    expect(before).toHaveLength(53);
    expect(PAGE_APPROVALS.map((r) => r.pageId)).toEqual(before);
  });
});
