import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number,
    ) {
      super(message);
    }
  }
  return { ApiError, api: { get: h.get, post: h.post, patch: h.patch, delete: h.del } };
});

const m = await import("./business-apps");
const { ApiError } = await import("@/lib/api");

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
});

describe("appLabel", () => {
  it("uses the store name, trimmed", () => {
    expect(m.appLabel({ name: "  Acme  ", platform: "ios" })).toBe("Acme");
  });
  it("falls back to a plain platform label when the name is missing or blank", () => {
    expect(m.appLabel({ platform: "ios" })).toBe("iPhone app");
    expect(m.appLabel({ name: "   ", platform: "android" })).toBe("Android app");
  });
});

describe("safeHttpsUrl", () => {
  it("passes https and drops everything else", () => {
    expect(m.safeHttpsUrl("https://apps.apple.com/app/id1")).toBe("https://apps.apple.com/app/id1");
    expect(m.safeHttpsUrl("http://x.com")).toBeUndefined();
    expect(m.safeHttpsUrl("javascript:alert(1)")).toBeUndefined();
    expect(m.safeHttpsUrl("nope")).toBeUndefined();
    expect(m.safeHttpsUrl(undefined)).toBeUndefined();
  });
});

describe("addAppErrorMessage", () => {
  it("speaks plainly for the two known codes", () => {
    expect(m.addAppErrorMessage(new ApiError("INVALID_STORE_URL", "raw", 400))).toBe("That isn't an App Store or Google Play app link.");
    expect(m.addAppErrorMessage(new ApiError("APP_EXISTS", "raw", 409))).toBe("That app is already on your list.");
  });
  it("never shows raw error text for anything else", () => {
    expect(m.addAppErrorMessage(new ApiError("BOOM", "internal detail", 500))).toBe("Couldn't add that app. Try again.");
    expect(m.addAppErrorMessage(new Error("x"))).toBe("Couldn't add that app. Try again.");
  });
});

describe("splitApps", () => {
  it("groups by status and keeps order", () => {
    const mk = (appId: string, status: "pending" | "confirmed" | "rejected") => ({ appId, status }) as never;
    const r = m.splitApps([mk("a", "rejected"), mk("b", "confirmed"), mk("c", "pending"), mk("d", "confirmed")]);
    expect(r.confirmed.map((a) => a.appId)).toEqual(["b", "d"]);
    expect(r.pending.map((a) => a.appId)).toEqual(["c"]);
    expect(r.rejected.map((a) => a.appId)).toEqual(["a"]);
  });
});

describe("requests", () => {
  it("lists from the one route", async () => {
    h.get.mockResolvedValue({ apps: [{ appId: "ios:1" }] });
    expect(await m.listBusinessApps()).toEqual([{ appId: "ios:1" }]);
    expect(h.get).toHaveBeenCalledWith("/v1/business/apps");
  });
  it("POSTs the trimmed store link as { storeUrl }", async () => {
    h.post.mockResolvedValue({ app: { appId: "ios:1" } });
    await m.addBusinessApp("  https://apps.apple.com/us/app/x/id1  ");
    expect(h.post).toHaveBeenCalledWith("/v1/business/apps", { storeUrl: "https://apps.apple.com/us/app/x/id1" });
  });
  it("PATCHes the status and encodes the appId", async () => {
    h.patch.mockResolvedValue({ app: {} });
    await m.setBusinessAppStatus("android:com.brand.app", "rejected");
    expect(h.patch).toHaveBeenCalledWith("/v1/business/apps/android%3Acom.brand.app", { status: "rejected" });
  });
  it("DELETEs by encoded appId", async () => {
    h.del.mockResolvedValue(undefined);
    await m.removeBusinessApp("ios:123");
    expect(h.del).toHaveBeenCalledWith("/v1/business/apps/ios%3A123");
  });
  it("treats PARSE_ERROR on a 204 as success, but not on any other status", async () => {
    h.del.mockRejectedValueOnce(new ApiError("PARSE_ERROR", "x", 204));
    await expect(m.removeBusinessApp("ios:1")).resolves.toBeUndefined();
    h.del.mockRejectedValueOnce(new ApiError("PARSE_ERROR", "x", 502));
    await expect(m.removeBusinessApp("ios:1")).rejects.toThrow();
    h.del.mockRejectedValueOnce(new ApiError("NOT_FOUND", "x", 404));
    await expect(m.removeBusinessApp("ios:1")).rejects.toThrow();
  });
});
