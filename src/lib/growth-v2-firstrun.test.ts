import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import type { DraftOffer, FirstRunDraftResponse } from "@/lib/api/growth-v2";
import {
  EMPTY_ANSWERS,
  buildPlanBody,
  ceilingChips,
  parseAmount,
  planBlockedReason,
  resolveTarget,
  selectedFocus,
  selectedOffer,
  sendErrorMessage,
  type FirstRunAnswers,
} from "./growth-v2-firstrun";

/**
 * H5: the three questions become the plan that is sent to WhatsApp, and the button says why it is off.
 *
 * ★WHAT ONLY THESE TESTS CAN GET WRONG: that the plan carries the focus the merchant picked and only for orders; that the
 * target is the merchant's own number when typed and the playbook's otherwise, of the kind the outcome is measured by; that an
 * empty or unreadable box is "no answer", never 0; and that every missing answer keeps the plan from being built.
 */

const SAREES: DraftOffer["focusSuggestions"][number] = { by: "product_type", values: ["Sarees"], label: "Sarees", source: "revenue", revenue: 800000 };
const KURTAS: DraftOffer["focusSuggestions"][number] = { by: "product_type", values: ["Kurtas", "Kurta Sets"], label: "Kurtas", source: "playbook", revenue: 300000 };

const SALES: DraftOffer = {
  kind: "sales",
  source: "orders",
  optimizeFor: "value",
  label: "Sales",
  focusSuggestions: [SAREES, KURTAS],
  focusWindowDays: 90,
  defaultTarget: { kind: "roas", value: 2.5, low: 1.5, high: 5 },
  targetSource: "playbook",
};
const LEADS: DraftOffer = {
  kind: "leads",
  source: "win_definition",
  optimizeFor: "count",
  label: "Leads",
  focusSuggestions: [],
  defaultTarget: { kind: "cost_per_outcome", value: 350, low: 100, high: 1500, currency: "INR" },
  targetSource: "playbook",
};
const CALLS: DraftOffer = { kind: "calls", source: "ads_conversions", optimizeFor: "count", label: "Calls", focusSuggestions: [], targetSource: "merchant" };

const draft = (over: Partial<FirstRunDraftResponse> = {}): FirstRunDraftResponse => ({
  alreadyActive: false,
  currency: "INR",
  timeZone: { value: "Asia/Kolkata" },
  offers: [SALES, LEADS, CALLS],
  askAboutStores: false,
  playbook: { id: "growth-ecommerce-d2c", version: 3, title: "D2C" },
  channels: [],
  ceilingBands: { currency: "INR", bands: [{ key: "starter", amount: 30000 }, { key: "steady", amount: 60000 }, { key: "growth", amount: 120000 }] },
  excludedByGuardrails: [],
  ...over,
});
const answers = (over: Partial<FirstRunAnswers> = {}): FirstRunAnswers => ({ ...EMPTY_ANSWERS, ceiling: "60000", ...over });

describe("the offered outcomes are the only ones chosen from", () => {
  it("takes the first offer until the merchant picks, and ignores a pick that is no longer offered", () => {
    expect(selectedOffer(draft(), answers())?.kind).toBe("sales");
    expect(selectedOffer(draft(), answers({ offer: "leads:win_definition" }))?.kind).toBe("leads");
    // store visits are not in this business's offers: a stale pick falls back, it never invents one
    expect(selectedOffer(draft(), answers({ offer: "store_visits:ads_conversions" }))?.kind).toBe("sales");
    expect(selectedOffer(draft({ offers: [] }), answers())).toBeUndefined();
  });

  it("a focus is taken from orders only, and only one the api suggested", () => {
    expect(selectedFocus(SALES, answers({ focus: "Sarees" }))?.values).toEqual(["Sarees"]);
    expect(selectedFocus(SALES, answers({ focus: "Hotels" }))).toBeUndefined();
    expect(selectedFocus(LEADS, answers({ focus: "Sarees" }))).toBeUndefined();
    expect(selectedFocus(SALES, answers())).toBeUndefined();
  });
});

describe("a typed number is text until it is read", () => {
  it.each([
    ["60000", 60000],
    ["60,000", 60000],
    [" 2.5 ", 2.5],
  ])("%s is %s", (typed, n) => expect(parseAmount(typed)).toBe(n));
  it.each([[""], ["   "], ["0"], ["-5"], ["abc"], ["1e999"], ["NaN"], ["1e6"], ["0x1F"], ["1_000"], ["1.2.3"], ["Infinity"]])("%j is no answer, never 0 and never a number in disguise", (typed) =>
    expect(parseAmount(typed)).toBeUndefined(),
  );
});

describe("the target", () => {
  it("is the playbook's default of the right kind until the merchant types their own", () => {
    expect(resolveTarget(SALES, answers())).toEqual({ target: { kind: "roas", value: 2.5 }, source: "playbook" });
    expect(resolveTarget(SALES, answers({ target: "3.2" }))).toEqual({ target: { kind: "roas", value: 3.2 }, source: "merchant" });
    expect(resolveTarget(LEADS, answers({ target: "400" }))).toEqual({ target: { kind: "cost_per_outcome", value: 400 }, source: "merchant" });
  });
  it("is nothing when the playbook has no default and nothing was typed", () => {
    expect(resolveTarget(CALLS, answers())).toBeUndefined();
  });
  it("a CLEARED or unreadable box is not an untouched one: it resolves to nothing, never to the default the merchant cannot see", () => {
    expect(resolveTarget(SALES, answers({ target: "" }))).toBeUndefined();
    expect(resolveTarget(SALES, answers({ target: "abc" }))).toBeUndefined();
    expect(buildPlanBody(draft(), answers({ target: "" }))).toBeUndefined();
    expect(planBlockedReason(draft(), answers({ target: "" }), true)).toMatch(/target box is empty/);
  });
  it("never takes a default of the other kind", () => {
    const wrong: DraftOffer = { ...SALES, defaultTarget: { kind: "cost_per_outcome", value: 90, low: 1, high: 2, currency: "INR" } };
    expect(resolveTarget(wrong, answers())).toBeUndefined();
  });
});

describe("the plan that is sent", () => {
  it("carries the outcome, the focus, the ceiling, the target and the pinned playbook", () => {
    const body = buildPlanBody(draft(), answers({ focus: "Kurtas", ceiling: "75,000" }))!;
    expect(body).toEqual({
      outcome: { kind: "sales", source: "orders", optimizeFor: "value", focus: { by: "product_type", values: ["Kurtas", "Kurta Sets"], label: "Kurtas" } },
      currency: "INR",
      monthlyCeiling: 75000,
      target: { kind: "roas", value: 2.5 },
      targetSource: "playbook",
      playbook: { id: "growth-ecommerce-d2c", version: 3 },
    });
  });

  it("has no focus for an outcome counted from a win or an ads conversion, and a merchant's own target is marked so", () => {
    const body = buildPlanBody(draft(), answers({ offer: "leads:win_definition", focus: "Sarees", target: "420" }))!;
    expect(body.outcome).toEqual({ kind: "leads", source: "win_definition", optimizeFor: "count" });
    expect(body.target).toEqual({ kind: "cost_per_outcome", value: 420 });
    expect(body.targetSource).toBe("merchant");
  });

  it("is never built without an answer, a playbook, a clock or a currency", () => {
    expect(buildPlanBody(draft(), answers({ ceiling: "" }))).toBeUndefined();
    expect(buildPlanBody(draft(), answers({ ceiling: "0" }))).toBeUndefined();
    expect(buildPlanBody(draft({ offers: [CALLS] }), answers())).toBeUndefined(); // no target for calls
    expect(buildPlanBody(draft({ playbook: undefined }), answers())).toBeUndefined();
    expect(buildPlanBody(draft({ timeZone: { absent: "No time zone" } }), answers())).toBeUndefined();
    expect(buildPlanBody(draft({ currency: undefined }), answers())).toBeUndefined();
    expect(buildPlanBody(draft({ alreadyActive: true }), answers())).toBeUndefined();
    expect(buildPlanBody(draft({ tie: { candidates: [{ playbookId: "a", version: 1, title: "A" }] } }), answers())).toBeUndefined();
  });
});

describe("why Send to WhatsApp is off", () => {
  it("is on only when everything is answered and the signal is done", () => {
    expect(planBlockedReason(draft(), answers(), true)).toBeUndefined();
  });
  it.each<[string, () => string | undefined, RegExp]>([
    ["loading", () => planBlockedReason(undefined, answers(), true), /loading/],
    ["already on", () => planBlockedReason(draft({ alreadyActive: true }), answers(), true), /already on/],
    ["a tie", () => planBlockedReason(draft({ tie: { candidates: [] } }), answers(), true), /which description/i],
    ["no playbook", () => planBlockedReason(draft({ playbook: undefined }), answers(), true), /no playbook/],
    ["nothing offered", () => planBlockedReason(draft({ offers: [] }), answers(), true), /Nothing can be measured/],
    ["no time zone", () => planBlockedReason(draft({ timeZone: { absent: "x" } }), answers(), true), /time zone/],
    ["no ceiling", () => planBlockedReason(draft(), answers({ ceiling: "" }), true), /ceiling/],
    ["no target", () => planBlockedReason(draft({ offers: [CALLS] }), answers(), true), /no playbook default/],
    ["signal not done", () => planBlockedReason(draft(), answers(), false), /step 4/],
  ])("%s", (_n, reason, re) => expect(reason()).toMatch(re));

  it("a tie comes before anything else the merchant could answer", () => {
    expect(planBlockedReason(draft({ tie: { candidates: [] }, offers: [] }), answers({ ceiling: "" }), false)).toMatch(/which description/i);
  });
});

describe("the ceiling suggestions", () => {
  it("are the api's bands, named, and none when the playbook has no minimum in the currency", () => {
    expect(ceilingChips(draft()).map((c) => [c.label, c.amount])).toEqual([["Starter", 30000], ["Steady", 60000], ["Growth", 120000]]);
    expect(ceilingChips(draft({ ceilingBands: { absent: "no minimum" } }))).toEqual([]);
  });
});

describe("a failed send", () => {
  it("says what the api said for the codes it writes for the merchant, and something plain for the rest", () => {
    expect(sendErrorMessage(new ApiError("SIGNAL_NOT_READY", "raw", 409))).toMatch(/conversion signal/);
    expect(sendErrorMessage(new ApiError("NO_VERIFIED_CONTACT", "raw", 422))).toMatch(/Verify your WhatsApp number/);
    expect(sendErrorMessage(new ApiError("VALIDATION_ERROR", "raw", 400))).toMatch(/ceiling and the target/);
    expect(sendErrorMessage(new ApiError("SOMETHING_ELSE", "stack trace goes here", 500))).not.toMatch(/stack trace/);
    expect(sendErrorMessage(new TypeError("Failed to fetch"))).toMatch(/Try again/);
  });
});
