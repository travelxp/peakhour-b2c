import { describe, it, expect } from "vitest";
import { CRON_METADATA, summarizeGoogleAdsOps } from "./cron-metadata";

/** G-10's watch summary (G-15 review round 3): every branch, and the daily flag from the response. */
const base = { level: "Basic", ceiling: 15_000, last24h: { operations: 3_000, band: "ok" }, refusedThisRun: 0, forecast: { status: "ok" } };

describe("summarizeGoogleAdsOps", () => {
  it("★a quiet run is a plain line with the share of the ceiling", () => {
    expect(summarizeGoogleAdsOps({ ...base, dailyRun: true })).toBe("3,000 Google Ads operations in the last 24 hours (20% of Basic's 15,000).");
  });
  it("★warn, alarm and a refusal are warnings", () => {
    for (const d of [{ ...base, last24h: { operations: 9_500, band: "warn" } }, { ...base, last24h: { operations: 12_500, band: "alarm" } }, { ...base, refusedThisRun: 2 }]) {
      expect(summarizeGoogleAdsOps(d)).toMatchObject({ level: "warning" });
    }
  });
  it("★★the forecast is said by the DAILY run only — read from the response's own dailyRun", () => {
    const trig = { ...base, forecast: { status: "trigger" } };
    expect(summarizeGoogleAdsOps({ ...trig, dailyRun: true })).toMatchObject({ level: "warning", message: expect.stringContaining("next access level") });
    expect(summarizeGoogleAdsOps({ ...trig, dailyRun: false })).toBe("3,000 Google Ads operations in the last 24 hours (20% of Basic's 15,000).");
    // No flag in the response: the key decides.
    expect(CRON_METADATA["google-ads-ops-watch"]!.summarize!(trig)).toMatchObject({ level: "warning" });
    expect(CRON_METADATA["google-ads-ops-watch-intraday"]!.summarize!(trig)).toBe("3,000 Google Ads operations in the last 24 hours (20% of Basic's 15,000).");
  });
  it("PASS: an absent figure is not zero — no summary at all", () => {
    expect(summarizeGoogleAdsOps({ level: "Basic", ceiling: 15_000 })).toBeNull();
    expect(summarizeGoogleAdsOps(null)).toBeNull();
  });
  it("PASS: Standard's unlimited ceiling (null in JSON) names no share", () => {
    expect(summarizeGoogleAdsOps({ ...base, ceiling: null })).toBeNull();
  });
});
