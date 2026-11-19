import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import type { MemoryLine, MemoryPage } from "@/lib/api/creative";
import { assembleMemory, checkDraft, exportBody, lineNote, patchPages, runChange, tasteLines } from "@/lib/studio-memory";

const line = (over: Partial<MemoryLine> = {}): MemoryLine => ({
  id: "l1",
  text: "You prefer deep reds",
  kind: "taste",
  source: "learned",
  origin: "A pattern we noticed",
  evidence: { count: 12, since: "2026-11-03T00:00:00.000Z", basis: "pattern", label: "Based on 12 posts, since 3 Nov." },
  editable: false,
  ...over,
});

const fails = (status: number, code = "X") => async () => {
  throw new ApiError(code, "x", status);
};

describe("runChange", () => {
  it("done when the call works", async () => expect(await runChange(async () => ({}))).toBe("done"));
  it("a 404 on one line is gone (already deleted elsewhere), not a failure", async () => expect(await runChange(fails(404, "NOT_FOUND"), { goneOn404: true })).toBe("gone"));
  it("a 404 anywhere else is a failure: a wipe that was not found must never read as done", async () => expect(await runChange(fails(404, "NOT_FOUND"))).toBe("failed"));
  it("any other error is a failure", async () => {
    expect(await runChange(fails(500))).toBe("failed");
    expect(await runChange(fails(403, "PRO_TOOLS_REQUIRED"))).toBe("failed");
    expect(
      await runChange(async () => {
        throw new Error("offline");
      }),
    ).toBe("failed");
  });
});

describe("checkDraft", () => {
  it("trims and accepts 1 to 140 characters", () => {
    expect(checkDraft("  keep it short  ")).toEqual({ ok: true, text: "keep it short" });
    expect(checkDraft("a".repeat(140)).ok).toBe(true);
  });
  it("refuses empty, blank and 141 characters", () => {
    expect(checkDraft("")).toEqual({ ok: false, problem: "empty" });
    expect(checkDraft("   ")).toEqual({ ok: false, problem: "empty" });
    expect(checkDraft("a".repeat(141))).toEqual({ ok: false, problem: "too_long" });
  });
});

describe("lineNote", () => {
  it("a learned line says where it came from and how much is behind it", () => {
    expect(lineNote(line())).toBe("A pattern we noticed. Based on 12 posts, since 3 Nov.");
  });
  it("a thin line says it is an early guess", () => {
    const thin = line({ evidence: { count: 2, since: "2026-11-03T00:00:00.000Z", basis: "pattern", label: "Early guess. Based on 2 posts." } });
    expect(lineNote(thin)).toContain("Early guess. Based on 2 posts.");
  });
  it("a line from a test says so, never proof", () => {
    expect(lineNote(line({ origin: "From a test of two versions" }))).toMatch(/^From a test of two versions\./);
  });
  it("a line the merchant wrote has no evidence tag", () => {
    expect(lineNote(line({ source: "you", evidence: null, origin: "You wrote this" }))).toBe("You wrote this");
  });
  it("a learned line with no evidence shows its origin alone", () => expect(lineNote(line({ evidence: null }))).toBe("A pattern we noticed"));
});

describe("tasteLines and exportBody", () => {
  it("keeps only taste lines", () => expect(tasteLines({ lines: [line(), line({ id: "r", kind: "rule" })] }).map((l) => l.id)).toEqual(["l1"]));
  it("the export is readable JSON that round-trips", () => {
    const d = { exportedAt: "2026-11-19T00:00:00.000Z", lines: [], pooledOptIn: false };
    expect(exportBody(d)).toContain("\n");
    expect(JSON.parse(exportBody(d))).toEqual(d);
  });
});

describe("assembleMemory", () => {
  const first = (over: Partial<MemoryPage> = {}): MemoryPage => ({
    lines: [line({ id: "a" }), line({ id: "b" })],
    next: "cursor-1",
    totalLines: 5,
    rules: [{ text: "Your logo and legal text stay as they are.", changeIn: "brand-kit" }],
    note: "Learning never overrides these.",
    trends: { approvedPosts: 0, enough: false, needs: 10, comparable: false, firstMonth: null, now: null, lines: [] },
    pooledOptIn: true,
    ...over,
  });
  it("is nothing until the first page is in", () => {
    expect(assembleMemory(undefined)).toBeUndefined();
    expect(assembleMemory([])).toBeUndefined();
  });
  it("takes the rules, trends and opt-in from the first page, every line read so far, and the last page's cursor", () => {
    const m = assembleMemory([first(), { lines: [line({ id: "c" })], next: "cursor-2" }])!;
    expect(m.lines.map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect(m.next).toBe("cursor-2");
    expect(m.totalLines).toBe(5);
    expect(m.pooledOptIn).toBe(true);
    expect(m.rules).toHaveLength(1);
  });
  it("no cursor on the last page means everything has been read", () => expect(assembleMemory([first({ next: undefined })])!.next).toBeUndefined());
  it("a line a later page repeats (the list moved between reads) is drawn once", () => {
    const m = assembleMemory([first(), { lines: [line({ id: "b" }), line({ id: "c" })] }])!;
    expect(m.lines.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });
  it("patchPages changes every page's lines and the first page's own fields, without touching the rest", () => {
    const pages = [first(), { lines: [line({ id: "c" })] }] as MemoryPage[];
    const out = patchPages(pages, (ls) => ls.filter((l) => l.id !== "b" && l.id !== "c"), (f) => ({ ...f, totalLines: 3 }));
    expect(out[0]!.lines.map((l) => l.id)).toEqual(["a"]);
    expect(out[1]!.lines).toEqual([]);
    expect(out[0]!.totalLines).toBe(3);
    expect(out[0]!.next).toBe("cursor-1");
    expect(pages[0]!.lines).toHaveLength(2);
  });
});
