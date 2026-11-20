import { describe, expect, it } from "vitest";
import {
  ackVersionToAsk,
  isAckRequiredRedirect,
  overseasAckCopy,
  withOverseasAck,
} from "./overseas-ack";

describe("overseas acknowledgement", () => {
  it("asks only when the api flagged the provider", () => {
    const rows = [
      { provider: "tiktok_ads", requiresAck: { version: "tiktok_india_v1" } },
      { provider: "x_ads" },
    ];
    expect(ackVersionToAsk(rows, "tiktok_ads")).toBe("tiktok_india_v1");
    expect(ackVersionToAsk(rows, "x_ads")).toBeNull();
    expect(ackVersionToAsk([{ provider: "tiktok_ads" }], "tiktok_ads")).toBeNull();
  });

  it("puts the accepted version on the authorize url", () => {
    const url = withOverseasAck(
      "https://api.example/v1/integrations/tiktok_ads/authorize?returnTo=%2Fdashboard%2Fintegrations",
      "tiktok_india_v1",
    );
    expect(url).toBe(
      "https://api.example/v1/integrations/tiktok_ads/authorize?returnTo=%2Fdashboard%2Fintegrations&ackOverseas=tiktok_india_v1",
    );
  });

  it("recognises the api's redirect, on either param", () => {
    const p = (q: string) => new URLSearchParams(q);
    expect(isAckRequiredRedirect(p("error=tiktok_india_ack_required"))).toBe(true);
    expect(isAckRequiredRedirect(p("integration=error&msg=tiktok_india_ack_required"))).toBe(true);
    expect(isAckRequiredRedirect(p("error=other"))).toBe(false);
    expect(isAckRequiredRedirect(null)).toBe(false);
  });

  it("holds the approved wording for tiktok_india_v1", () => {
    const c = overseasAckCopy("tiktok_india_v1")!;
    expect(c.title).toBe("TikTok is banned in India");
    expect(c.body).toHaveLength(3);
    expect(c.confirm).toBe("Connect TikTok");
    expect(overseasAckCopy("nope")).toBeNull();
  });
});
