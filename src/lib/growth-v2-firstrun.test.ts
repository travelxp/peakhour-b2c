import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import type { DraftLine, DraftOffer, FirstRunDraftResponse } from "@/lib/api/growth-v2";
import {
  EMPTY_ANSWERS,
  asksForCampaigns,
  buildPlanBody,
  campaignLine,
  chosenLines,
  lineShares,
  suggestedShares,
  ceilingChips,
  parseAmount,
  planBlockedReason,
  resolveTarget,
  selectedFocus,
  selectedOffer,
  sendErrorMessage,
  targetQuestion,
  TARGET_NOT_A_FEE,
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
  it("C7: the third question asks what the merchant wants to spend on ads, never what they can pay Peakhour, and says it is not a fee", () => {
    expect(targetQuestion("cost_per_outcome", "booking")).toBe("What is the most you want to spend on ads to get one booking?");
    expect(targetQuestion("roas", "order")).toBe("What return do you need on your ad spend?");
    expect(TARGET_NOT_A_FEE).toBe("The engine aims to spend no more than this on ads for each one. It is not a Peakhour charge.");
    // and the blocked-reason sentences no longer say "pay"
    expect(planBlockedReason(draft({ offers: [LEADS] }), answers({ target: "" }), true)).toBe("Enter the most you want to spend on ads per outcome: the target box is empty.");
    expect(`${targetQuestion("cost_per_outcome", "lead")}${TARGET_NOT_A_FEE}`).not.toMatch(/pay|can pay/i);
  });
  it("never takes a default of the other kind", () => {
    const wrong: DraftOffer = { ...SALES, defaultTarget: { kind: "cost_per_outcome", value: 90, low: 1, high: 2, currency: "INR" } };
    expect(resolveTarget(wrong, answers())).toBeUndefined();
  });
});

describe("the plan that is sent", () => {
  it("carries the outcome, the focus, the ceiling, the target and the pinned playbook", () => {
    const body = buildPlanBody(draft(), answers({ focus: "Kurtas", ceiling: "75,000" }))!;
    // a playbook with no lines: one goal with all of the ceiling
    expect(body).toEqual({
      goals: [
        {
          outcome: { kind: "sales", source: "orders", optimizeFor: "value", focus: { by: "product_type", values: ["Kurtas", "Kurta Sets"], label: "Kurtas" } },
          share: 1,
          target: { kind: "roas", value: 2.5 },
          targetSource: "playbook",
        },
      ],
      currency: "INR",
      monthlyCeiling: 75000,
      playbook: { id: "growth-ecommerce-d2c", version: 3 },
    });
  });

  it("has no focus for an outcome counted from a win or an ads conversion, and a merchant's own target is marked so", () => {
    const body = buildPlanBody(draft(), answers({ offer: "leads:win_definition", focus: "Sarees", target: "420" }))!;
    expect(body.goals[0]!.outcome).toEqual({ kind: "leads", source: "win_definition", optimizeFor: "count" });
    expect(body.goals[0]!.target).toEqual({ kind: "cost_per_outcome", value: 420 });
    expect(body.goals[0]!.targetSource).toBe("merchant");
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

// -- PL-3: "What do you sell?" ---------------------------------------------------------------

const line = (id: string, label: string, over: Partial<DraftLine> = {}): DraftLine => ({ id, label, matched: false, score: 0, why: "", offers: [LEADS], ...over });
const FLIGHTS = line("flights", "Flights", { matched: true, score: 1, minMonthlyBudget: 30000 });
const HOTELS = line("hotels", "Hotels", { minMonthlyBudget: 20000 });
const HOLIDAYS = line("holidays", "Holidays", { matched: true, score: 1, minMonthlyBudget: 10000, offers: [{ ...LEADS, defaultTarget: { kind: "cost_per_outcome", value: 900, low: 300, high: 3000, currency: "INR" } }] });
const travel = (over: Partial<FirstRunDraftResponse> = {}) => draft({ playbook: { id: "growth-travel-india", version: 2, title: "Travel" }, lines: [FLIGHTS, HOTELS, HOLIDAYS], ...over });

describe("PL-3: one goal per line the business sells", () => {
  it("★two lines: a travel business selling flights and holidays has both pre-ticked and gets two goals whose shares sum to 1", () => {
    const d = travel();
    expect(chosenLines(d, {}).map((l) => l.id)).toEqual(["flights", "holidays"]);
    const body = buildPlanBody(d, answers({ ceiling: "50000" }))!;
    expect(body.goals.map((g) => [g.lineId, g.share, g.target, g.targetSource])).toEqual([
      ["flights", 0.75, { kind: "cost_per_outcome", value: 350 }, "playbook"],
      ["holidays", 0.25, { kind: "cost_per_outcome", value: 900 }, "playbook"],
    ]);
    expect(body.goals.reduce((t, g) => t + g.share, 0)).toBeCloseTo(1, 9);
    expect(body).toMatchObject({ currency: "INR", monthlyCeiling: 50000, playbook: { id: "growth-travel-india", version: 2 } });
    expect(body).not.toHaveProperty("outcome");
  });
  it("one line ticked gives one goal with all of the ceiling", () => {
    const body = buildPlanBody(travel(), answers({ lines: ["hotels"] }))!;
    expect(body.goals).toEqual([{ lineId: "hotels", outcome: { kind: "leads", source: "win_definition", optimizeFor: "count" }, share: 1, target: { kind: "cost_per_outcome", value: 350 }, targetSource: "playbook" }]);
  });
  it("a playbook without lines skips the step: no line is chosen and the plan is one goal, as before", () => {
    expect(chosenLines(draft(), {})).toEqual([]);
    expect(buildPlanBody(draft(), answers())!.goals).toHaveLength(1);
    expect(buildPlanBody(draft(), answers())!.goals[0]).not.toHaveProperty("lineId");
  });
  it("each goal has its own outcome and its own typed target", () => {
    const body = buildPlanBody(travel({ lines: [FLIGHTS, { ...HOLIDAYS, offers: [LEADS, SALES] }] }), answers({ goals: { holidays: { offer: "sales:orders", target: "4" } } }))!;
    expect(body.goals[1]).toMatchObject({ lineId: "holidays", outcome: { kind: "sales", optimizeFor: "value" }, target: { kind: "roas", value: 4 }, targetSource: "merchant" });
    expect(body.goals[0]).toMatchObject({ lineId: "flights", outcome: { kind: "leads" } });
  });

  it("suggestedShares: in proportion to each line's minimum budget, else even; whole percentages adding up to 100", () => {
    expect(suggestedShares([FLIGHTS, HOLIDAYS])).toEqual({ flights: 75, holidays: 25 });
    expect(suggestedShares([FLIGHTS, HOTELS, HOLIDAYS])).toEqual({ flights: 50, hotels: 33, holidays: 17 });
    expect(suggestedShares([FLIGHTS, line("x", "X")])).toEqual({ flights: 50, x: 50 }); // one has no minimum: even
    expect(suggestedShares([line("a", "A"), line("b", "B"), line("c", "C")])).toEqual({ a: 34, b: 33, c: 33 });
    expect(suggestedShares([FLIGHTS])).toEqual({ flights: 100 });
    expect(suggestedShares([])).toEqual({});
  });
  it("★shares the merchant types must add up to 100; an unreadable box blocks", () => {
    const d = travel();
    expect(planBlockedReason(d, answers({ shares: { flights: "60", holidays: "30" } }), true)).toMatch(/add up to 90%/);
    expect(planBlockedReason(d, answers({ shares: { flights: "60", holidays: "abc" } }), true)).toMatch(/share of the ceiling/);
    expect(planBlockedReason(d, answers({ shares: { flights: "60", holidays: "40" } }), true)).toBeUndefined();
    expect(buildPlanBody(d, answers({ shares: { flights: "60", holidays: "40" } }))!.goals.map((g) => g.share)).toEqual([0.6, 0.4]);
    expect(lineShares(d, answers({ shares: { flights: "60" } }))).toEqual({ flights: 60, holidays: 25 });
    expect(lineShares(d, answers({ shares: { flights: "150", holidays: "-50" } }))).toEqual({ flights: undefined, holidays: undefined });
  });
  it("FAIL: no line ticked, more than six, a line with nothing to measure, a missing target", () => {
    expect(planBlockedReason(travel(), answers({ lines: [] }), true)).toBe("Tick at least one thing you sell.");
    const seven = Array.from({ length: 7 }, (_, i) => line(`l${i}`, `L${i}`, { matched: true }));
    expect(planBlockedReason(travel({ lines: seven }), answers(), true)).toMatch(/at most 6 goals/);
    expect(planBlockedReason(travel({ lines: [FLIGHTS, { ...HOLIDAYS, offers: [] }] }), answers(), true)).toMatch(/Nothing can be measured for Holidays/);
    expect(planBlockedReason(travel(), answers({ goals: { flights: { target: "" } } }), true)).toMatch(/for Flights/);
    expect(buildPlanBody(travel(), answers({ lines: [] }))).toBeUndefined();
  });

  it("★the campaigns go to the chosen goals: the merchant's pick, else the suggestion when that line is chosen, else none", () => {
    const d = travel({
      campaigns: [
        { campaignId: "meta:1", platform: "meta", name: "Airfare", status: "active", suggestedLineId: "flights", why: "" },
        { campaignId: "meta:2", platform: "meta", name: "Hotels", status: "active", suggestedLineId: "hotels", why: "" },
        { campaignId: "meta:3", platform: "meta", name: "Brand", status: "active", why: "" },
      ],
    });
    expect(asksForCampaigns(d, answers())).toBe(true);
    expect(campaignLine(d, answers(), "meta:1")).toBe("flights");
    expect(campaignLine(d, answers(), "meta:2")).toBe(""); // hotels is not chosen
    expect(campaignLine(d, answers(), "meta:3")).toBe("");
    const body = buildPlanBody(d, answers({ campaigns: { "meta:3": "holidays" } }))!;
    expect(body.goals.map((g) => [g.lineId, g.campaignIds])).toEqual([["flights", ["meta:1"]], ["holidays", ["meta:3"]]]);
    // the merchant can give a suggested campaign to no goal
    expect(buildPlanBody(d, answers({ campaigns: { "meta:1": "" } }))!.goals.every((g) => g.campaignIds === undefined)).toBe(true);
    // one goal owns every campaign implicitly: none are named, and the step is not asked
    expect(asksForCampaigns(d, answers({ lines: ["flights"] }))).toBe(false);
    expect(buildPlanBody(d, answers({ lines: ["flights"] }))!.goals[0]).not.toHaveProperty("campaignIds");
  });
});
