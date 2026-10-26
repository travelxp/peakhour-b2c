import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { FIXTURE_HOME, FIXTURE_RULES } from "@/lib/growth-v2-fixtures";
import { NOT_BUILT, isNotBuilt, mandateFor, loadOrPreview, notBuiltRow, type HomeResponse, type RulesResponse } from "./growth-v2";

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
