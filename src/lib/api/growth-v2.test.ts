import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { FIXTURE_HOME, FIXTURE_RULES, previewDecisions } from "@/lib/growth-v2-fixtures";
import { NOT_BUILT, growthV2Api, isNotBuilt, mergeDecisionPages, mandateFor, loadOrPreview, notBuiltRow, type HomeResponse, type RulesResponse } from "./growth-v2";

const notBuilt = (row = "H1") => new ApiError(NOT_BUILT, `This route is built by plan row ${row}.`, 501, "req-1", { row });

describe("loadOrPreview: the 501 NOT_BUILT fallback", () => {
  it("returns the fixture, flagged as a preview with the row that will replace it", async () => {
    const fetcher = vi.fn<() => Promise<HomeResponse>>().mockRejectedValue(notBuilt("H1"));
    const r = await loadOrPreview(fetcher, () => FIXTURE_HOME);
    expect(r.preview).toBe(true);
    expect(r.row).toBe("H1");
    expect(r.data).toBe(FIXTURE_HOME);
  });

  it("returns live data untouched and never flags it a preview", async () => {
    const live: HomeResponse = { ...FIXTURE_HOME, outcome: { kind: "leads", label: "Leads", optimizeFor: "count" } };
    const fixture = vi.fn<() => HomeResponse>(() => FIXTURE_HOME);
    const r = await loadOrPreview(async () => live, fixture);
    expect(r).toEqual({ data: live, preview: false });
    expect(fixture).not.toHaveBeenCalled();
  });

  it.each([
    ["500 INTERNAL", new ApiError("INTERNAL", "boom", 500)],
    ["403 forbidden", new ApiError("FORBIDDEN", "no", 403)],
    ["401", new ApiError("UNAUTHORIZED", "no", 401)],
    ["404 route missing", new ApiError("NOT_FOUND", "no", 404)],
    ["501 with another code", new ApiError("NOT_IMPLEMENTED", "no", 501)],
    ["NOT_BUILT code on a 500", new ApiError(NOT_BUILT, "odd", 500)],
    ["a plain network error", new TypeError("Failed to fetch")],
  ])("rethrows %s instead of showing sample data", async (_name, err) => {
    const fixture = vi.fn<() => RulesResponse>(() => FIXTURE_RULES);
    await expect(loadOrPreview(async () => Promise.reject(err), fixture)).rejects.toBe(err);
    expect(fixture).not.toHaveBeenCalled();
  });
});

describe("isNotBuilt / notBuiltRow", () => {
  it("needs both the 501 status and the NOT_BUILT code", () => {
    expect(isNotBuilt(notBuilt())).toBe(true);
    expect(isNotBuilt(new ApiError(NOT_BUILT, "x", 500))).toBe(false);
    expect(isNotBuilt(new ApiError("X", "x", 501))).toBe(false);
    expect(isNotBuilt(null)).toBe(false);
  });

  it("reads the row from the details, and tolerates details of another shape", () => {
    expect(notBuiltRow(notBuilt("C5"))).toBe("C5");
    expect(notBuiltRow(new ApiError(NOT_BUILT, "x", 501, undefined, "nope"))).toBeUndefined();
    expect(notBuiltRow(new ApiError(NOT_BUILT, "x", 501))).toBeUndefined();
  });
});

describe("mandateFor", () => {
  it("lends a mandate only to a screen of the same kind of data", () => {
    const sample = { data: FIXTURE_RULES, preview: true };
    const live = { data: { ...FIXTURE_RULES, mandate: { ...FIXTURE_RULES.mandate!, currency: "USD" } }, preview: false };
    expect(mandateFor(sample, true)?.currency).toBe("INR");
    expect(mandateFor(sample, false)).toBeUndefined();
    expect(mandateFor(live, false)?.currency).toBe("USD");
    expect(mandateFor(live, true)).toBeUndefined();
    expect(mandateFor(undefined, false)).toBeUndefined();
  });
});

describe("mergeDecisionPages", () => {
  const page = (queue: "open" | "blocked", ids: string[], blockIds: string[], nextCursor?: string) => ({
    preview: false,
    data: {
      queue,
      decisions: ids.map((id) => ({ id }) as never),
      blocks: blockIds.map((id) => ({ id }) as never),
      counts: { open: ids.length, done: 0, blocked: blockIds.length },
      ...(nextCursor ? { nextCursor } : {}),
    },
  });

  it("★keeps every page's decisions AND blocks, in order, and the newest page's counts and cursor", () => {
    const m = mergeDecisionPages({ pages: [page("open", ["a", "b"], [], "c1"), page("open", ["c"], [], undefined)] });
    expect(m.data.decisions.map((d) => d.id)).toEqual(["a", "b", "c"]);
    expect(m.data.counts.open).toBe(1);
    expect(m.hasMore).toBe(false);
    const b = mergeDecisionPages({ pages: [page("blocked", [], ["x"], "c1"), page("blocked", [], ["y"])] });
    expect(b.data.blocks.map((x) => x.id)).toEqual(["x", "y"]);
  });
});

describe("the decisions client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks for a queue, with the cursor and limit only when given", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({});
    await growthV2Api.decisions("open");
    await growthV2Api.decisions("done", { cursor: "abc_1", limit: 5 });
    await growthV2Api.decisions("blocked");
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      "/v1/growth/v2/decisions?status=open",
      "/v1/growth/v2/decisions?status=done&cursor=abc_1&limit=5",
      "/v1/growth/v2/decisions?status=blocked",
    ]);
  });

  it("answers a decision at its own route, and asks about it at /ask with the question", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({});
    await growthV2Api.decide("d 1", "undo");
    await growthV2Api.ask("d1", "Why?");
    expect(post.mock.calls).toEqual([["/v1/growth/v2/decisions/d%201/undo"], ["/v1/growth/v2/decisions/d1/ask", { question: "Why?" }]]);
  });

  it("★a preview only on 501 NOT_BUILT: the sample for that queue, and a 500 reaches the caller", async () => {
    const preview = await loadOrPreview(async () => Promise.reject(notBuilt("H2")), () => previewDecisions("done"));
    expect(preview.preview).toBe(true);
    expect(preview.data.queue).toBe("done");
    const boom = new ApiError("INTERNAL", "boom", 500);
    await expect(loadOrPreview(async () => Promise.reject(boom), () => previewDecisions("open"))).rejects.toBe(boom);
  });
});
