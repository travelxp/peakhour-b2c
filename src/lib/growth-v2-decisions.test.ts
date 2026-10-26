import { describe, expect, it } from "vitest";
import type { DecisionStatus } from "./api/growth-v2";
import { FIXTURE_DECISIONS } from "./growth-v2-fixtures";
import { describeImpact, describeOp, isSpendDecision, queueTab, tabCounts, whatsappPreview } from "./growth-v2-decisions";

describe("queueTab", () => {
  const cases: Array<[DecisionStatus, string]> = [
    ["proposed", "needs_you"],
    ["failed", "blocked"],
    ["held", "blocked"],
    ["approved", "done"],
    ["applied", "done"],
    ["rejected", "done"],
    ["expired", "done"],
    ["superseded", "done"],
    ["reverted", "done"],
  ];
  it.each(cases)("%s sits in %s", (status, tab) => {
    expect(queueTab(status)).toBe(tab);
  });

  it("puts every status in exactly one tab", () => {
    const all: DecisionStatus[] = ["proposed", "approved", "applied", "held", "rejected", "expired", "superseded", "reverted", "failed"];
    expect(all.map(queueTab).every((t) => ["needs_you", "done", "blocked"].includes(t))).toBe(true);
  });

  it("counts the fixture queue", () => {
    expect(tabCounts(FIXTURE_DECISIONS.decisions)).toEqual({ needs_you: 3, done: 1, blocked: 1 });
  });
});

describe("describeOp", () => {
  it("names the platform and campaign and shows the change in the currency", () => {
    expect(describeOp({ platform: "meta", campaignRef: "trip-videos", op: "set_daily_budget", from: 590, to: 653 }, "INR")).toBe(
      "Meta Ads, trip-videos: daily budget ₹590 to ₹653",
    );
  });

  it("reads a bid strategy change in words", () => {
    expect(describeOp({ platform: "google_ads", campaignRef: "search", op: "set_bid_strategy", from: "maximize_clicks", to: "target_cpa" }, "INR")).toBe(
      "Google Ads, search: bid strategy maximize clicks to target cpa",
    );
  });

  it("has no 'from' for a creative attach", () => {
    expect(describeOp({ platform: "meta", campaignRef: "c", op: "attach_creative", to: "6 creatives" }, "INR")).toBe("Meta Ads, c: attach creative 6 creatives");
  });

  it("does not print a from-clause when there is no previous value", () => {
    expect(describeOp({ platform: "x", campaignRef: "c", op: "set_status", to: "paused" }, "INR")).toBe("X Ads, c: status paused");
  });
});

describe("describeImpact", () => {
  it("reads an outcome range with signs", () => {
    expect(describeImpact({ metric: "outcomes", low: 2, high: 5, confidence: 0.8, horizonDays: 30 }, "INR", "bookings")).toEqual({
      range: "+2 to +5",
      caption: "extra bookings over 30 days (80% range)",
    });
  });

  it("reads a cost change in the currency, negative being an improvement", () => {
    const d = describeImpact({ metric: "cost_per_outcome", low: -68, high: -36, confidence: 0.7, horizonDays: 21 }, "INR", "bookings");
    expect(d.range).toBe("−₹68 to −₹36");
    expect(d.caption).toBe("cost per booking after 21 days (70% range)");
  });
});

describe("whatsappPreview", () => {
  const byId = (id: string) => FIXTURE_DECISIONS.decisions.find((d) => d.id === id)!;

  it("asks for CONFIRM on a spend decision", () => {
    expect(isSpendDecision("budget_move")).toBe(true);
    expect(whatsappPreview(byId("preview-d1"), "Acme").confirmNote).toContain("CONFIRM");
  });

  it("does not ask for CONFIRM on a creative approval, and offers Review", () => {
    const wa = whatsappPreview(byId("preview-d2"), "Acme");
    expect(isSpendDecision("creative_approval")).toBe(false);
    expect(wa.confirmNote).toBeUndefined();
    expect(wa.buttons).toEqual(["Review", "Hold"]);
  });

  it("carries the business name and the decision's own words", () => {
    const wa = whatsappPreview(byId("preview-d1"), "Acme");
    expect(wa.header).toBe("Decision for Acme");
    expect(wa.body).toContain(byId("preview-d1").title);
    expect(wa.buttons).toEqual(["Approve", "Hold", "Details"]);
  });
});
