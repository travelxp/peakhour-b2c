import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import type { DecisionAction, DecisionStatus, DecisionView } from "./api/growth-v2";
import { FIXTURE_DECISIONS, previewDecisions } from "./growth-v2-fixtures";
import {
  canApprove,
  canHold,
  decisionNotice,
  describeImpact,
  describeOp,
  isSpendDecision,
  queueTab,
  tabCounts,
  undoOpenUntil,
  whatsappPreview,
} from "./growth-v2-decisions";

describe("queueTab", () => {
  const cases: Array<[DecisionStatus, string]> = [
    ["proposed", "needs_you"],
    ["held", "needs_you"],
    ["failed", "done"],
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

  it("puts every status in exactly one of the two decision tabs; Blocked is the guardrail blocks, never a status", () => {
    const all: DecisionStatus[] = ["proposed", "approved", "applied", "held", "rejected", "expired", "superseded", "reverted", "failed"];
    expect(all.map(queueTab).every((t) => ["needs_you", "done"].includes(t))).toBe(true);
  });

  it("counts the fixture queue", () => {
    expect(tabCounts(FIXTURE_DECISIONS.decisions)).toEqual({ needs_you: 3, done: 2, blocked: 0 });
  });
});

describe("the preview splits the sample the way the server does", () => {
  it("open holds the waiting decisions, done the rest, blocked the sample block and no decision", () => {
    const open = previewDecisions("open");
    const done = previewDecisions("done");
    const blocked = previewDecisions("blocked");
    expect(open.decisions.map((d) => d.status)).toEqual(["proposed", "proposed", "proposed"]);
    expect(done.decisions.map((d) => d.status).sort()).toEqual(["applied", "failed"]);
    expect(blocked.decisions).toEqual([]);
    expect(blocked.blocks).toHaveLength(1);
    expect(open.blocks).toEqual([]);
    for (const q of [open, done, blocked]) expect(q.counts).toEqual({ open: 3, done: 2, blocked: 1 });
  });

  it("every sample op carries the sentence the card shows", () => {
    for (const d of FIXTURE_DECISIONS.decisions) for (const op of d.ops) expect(op.description.length).toBeGreaterThan(0);
  });
});

describe("what a person may do", () => {
  const base = FIXTURE_DECISIONS.decisions[0]!;
  const at = (iso: string) => Date.parse(iso);

  it("approves a proposed decision until it expires, and not after", () => {
    expect(canApprove(base, at(base.createdAt))).toBe(true);
    expect(canApprove(base, at(base.expiresAt!) - 1)).toBe(true);
    expect(canApprove(base, at(base.expiresAt!))).toBe(false);
  });

  it("a held decision can be approved again but not held again", () => {
    const held: DecisionView = { ...base, status: "held" };
    expect(canApprove(held, at(base.createdAt))).toBe(true);
    expect(canHold(held, at(base.createdAt))).toBe(false);
    expect(canHold(base, at(base.createdAt))).toBe(true);
  });

  it("an answered decision, or one that needs nobody, cannot be approved", () => {
    for (const status of ["applied", "rejected", "expired", "superseded", "reverted", "failed", "approved"] as const) {
      expect(canApprove({ ...base, status }, at(base.createdAt)), status).toBe(false);
    }
    expect(canApprove({ ...base, needsPerson: false }, at(base.createdAt))).toBe(false);
  });

  it("a decision with no expiry never expires", () => {
    const noExpiry: DecisionView = { ...base, expiresAt: undefined };
    expect(canApprove(noExpiry, at("2030-01-01T00:00:00Z"))).toBe(true);
  });

  it("★undo is open exactly until undoUntil, only on an applied decision", () => {
    const applied: DecisionView = { ...base, status: "applied", undoUntil: "2026-10-21T10:00:00Z" };
    expect(undoOpenUntil(applied, at("2026-10-21T09:59:59Z"))).toBe(at("2026-10-21T10:00:00Z"));
    expect(undoOpenUntil(applied, at("2026-10-21T10:00:00Z"))).toBeUndefined();
    expect(undoOpenUntil({ ...applied, undoUntil: undefined }, at("2026-10-20T00:00:00Z"))).toBeUndefined();
    expect(undoOpenUntil({ ...applied, status: "reverted" }, at("2026-10-20T00:00:00Z"))).toBeUndefined();
    expect(undoOpenUntil({ ...applied, undoUntil: "not a date" }, at("2026-10-20T00:00:00Z"))).toBeUndefined();
  });
});

describe("decisionNotice: a refusal as something to do", () => {
  const err = (code: string, message = "the api's sentence") => new ApiError(code, message, 409);
  const notice = (code: string, action: DecisionAction = "approve") => decisionNotice(err(code), action);

  it("★NEEDS_REAUTH offers Reconnect", () => {
    expect(notice("NEEDS_REAUTH")).toMatchObject({ tone: "warn", link: { label: "Reconnect", href: "/dashboard/integrations" } });
    expect(notice("NEEDS_REAUTH").text).toMatch(/reconnected/);
  });
  it("★ADS_HALTED says ads are paused", () => {
    expect(notice("ADS_HALTED").text).toBe("Ads are paused for this business.");
  });
  it("★QUIET_HOURS says it will apply after quiet hours", () => {
    expect(notice("QUIET_HOURS").text).toMatch(/^Will apply after quiet hours/);
  });
  it("★GOVERNOR_HOLD says the platform is still learning", () => {
    expect(notice("GOVERNOR_HOLD").text).toMatch(/^Waiting for the platform to finish learning/);
  });
  it.each(["NOT_CONNECTED", "AD_ACCOUNT_NOT_AUTHORIZED", "AD_ACCOUNT_FORBIDDEN"])("%s sends the merchant to the connection", (code) => {
    expect(notice(code).link?.href).toBe("/dashboard/integrations");
  });
  it.each(["BLACKOUT", "CHANNEL_DENIED"])("%s sends the merchant to their rules", (code) => {
    expect(notice(code).link?.href).toBe("/dashboard/growth/rules");
  });
  it("an expired answer says nothing changed", () => {
    expect(notice("EXPIRED")).toMatchObject({ tone: "bad", text: expect.stringContaining("nothing changed") });
  });
  it("UNDO_WINDOW_CLOSED names the 24-hour window", () => {
    expect(notice("UNDO_WINDOW_CLOSED", "undo").text).toBe("The 24-hour undo window has passed.");
  });
  it("any other code says what the api said", () => {
    expect(notice("CAMPAIGN_CHANGED_SINCE").text).toBe("the api's sentence");
    expect(decisionNotice(new ApiError("X", "", 500), "undo").text).toMatch(/couldn't be undone/);
  });
  it("a failure that is not the api's says nothing changed", () => {
    expect(decisionNotice(new TypeError("Failed to fetch"), "approve")).toEqual({ tone: "bad", text: "That didn't go through. Nothing changed." });
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

  it("reads a geo inclusion", () => {
    expect(describeOp({ platform: "x", campaignRef: "c", op: "set_geo_inclusions", to: ["IN", "AE"] }, "INR")).toBe('X Ads, c: targeted areas ["IN","AE"]');
  });

  it("does not print a from-clause when there is no previous value", () => {
    expect(describeOp({ platform: "x", campaignRef: "c", op: "set_status", to: "paused" }, "INR")).toBe("X Ads, c: status paused");
  });
});

describe("describeImpact", () => {
  it("reads an outcome range with signs", () => {
    expect(describeImpact({ metric: "outcomes", low: 2, high: 5, confidence: 0.8, horizonDays: 30 }, "INR", { one: "booking", many: "bookings" })).toEqual({
      range: "+2 to +5",
      caption: "extra bookings over 30 days (80% range)",
    });
  });

  it("reads a cost change in the currency, negative being an improvement", () => {
    const d = describeImpact({ metric: "cost_per_outcome", low: -68, high: -36, confidence: 0.7, horizonDays: 21 }, "INR", { one: "booking", many: "bookings" });
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

describe("describeOp units", () => {
  it("does not print a target as money, since it may be a multiplier", () => {
    expect(describeOp({ platform: "google_ads", campaignRef: "c", op: "set_target", from: 3.5, to: 4 }, "INR")).toBe("Google Ads, c: target 3.5 to 4");
  });

  it("prints a zero bound of a cost change without a plus sign", () => {
    expect(describeImpact({ metric: "cost_per_outcome", low: 0, high: 40, confidence: 0.5, horizonDays: 7 }, "INR", { one: "lead", many: "leads" }).range).toBe("\u20B90 to +\u20B940");
  });
});
