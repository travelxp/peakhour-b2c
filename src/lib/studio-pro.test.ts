import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(
      readonly code: string,
      message: string,
      readonly status = 400,
      readonly details?: unknown,
    ) {
      super(message);
    }
  }
  return { ApiError, api: {}, API_BASE_URL: "https://api.example" };
});

const { ApiError } = await import("@/lib/api");
const { groupHistory, restoreMessage, liveLinkFor } = await import("./studio-pro");
const { approvalLinkUrl } = await import("./studio");
import type { ApprovalLink, HistoryItem } from "@/lib/api/creative-studio";

const h = (previewId: string, version: number, over: Partial<HistoryItem> = {}): HistoryItem => ({
  previewId,
  version,
  summary: `v${version}`,
  at: "2026-11-19T10:00:00.000Z",
  current: false,
  restorable: true,
  ...over,
});

describe("version history grouping (S17)", () => {
  const previews = [
    { id: "p1", headline: "Flat 20% off" },
    { id: "p2", headline: null },
  ];

  it("one timeline per preview, newest first with the current look on top, in the order the previews are shown", () => {
    const items = [h("p2", 0), h("p2", 1, { current: true, restorable: false }), h("p1", 0), h("p1", 1), h("p1", 2, { current: true, restorable: false })];
    const g = groupHistory(items, previews);
    expect(g.map((x) => [x.previewId, x.number])).toEqual([
      ["p1", 1],
      ["p2", 2],
    ]);
    expect(g[0]!.items.map((i) => [i.version, i.current])).toEqual([
      [2, true],
      [1, false],
      [0, false],
    ]);
    expect(g[0]!.headline).toBe("Flat 20% off");
  });

  it("a preview that is not on the page is left out, never numbered as Preview 1", () => {
    expect(groupHistory([h("gone", 0)], previews)).toEqual([]);
  });

  it("a preview with nothing to go back to is left out", () => {
    expect(groupHistory([h("p1", 0, { current: true, restorable: false })], previews)).toEqual([]);
  });
});

describe("restore refusals", () => {
  it("says the api's two plain things, and falls back to the shared line", () => {
    expect(restoreMessage(new ApiError("VERSION_GONE", "x", 409))).toBe("That version is no longer kept.");
    expect(restoreMessage(new ApiError("VERSION_CONFLICT", "x", 409))).toContain("changed by someone else");
    expect(restoreMessage(new Error("offline"))).toBe("We couldn't go back. Try again.");
  });
});

describe("approval links", () => {
  const link = (id: string, previewId: string, state: ApprovalLink["state"]): ApprovalLink => ({
    id,
    previewId,
    state,
    expiresAt: "2026-11-26T00:00:00.000Z",
    answeredName: null,
    answeredAt: null,
  });

  it("the live link for a preview is the one still waiting", () => {
    const links = [link("l1", "p1", "revoked"), link("l2", "p1", "waiting"), link("l3", "p2", "approved")];
    expect(liveLinkFor(links, "p1")?.id).toBe("l2");
    expect(liveLinkFor(links, "p2")).toBeUndefined();
  });

  it("the address is the public page with the token in the path, encoded, on any origin", () => {
    expect(approvalLinkUrl("https://peakhour.ai/", "abc_-DEF")).toBe("https://peakhour.ai/share/studio/abc_-DEF");
    expect(approvalLinkUrl("https://peakhour.ai", "a/b")).toBe("https://peakhour.ai/share/studio/a%2Fb");
  });
});
