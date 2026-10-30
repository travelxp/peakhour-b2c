import { describe, it, expect } from "vitest";
import type { GoogleBiddingState, GoogleChannelType } from "@/lib/api/google-ads";
import {
  EMPTY_BIDDING_DRAFT,
  googleBiddingChoiceOf,
  googleBiddingDraftOf,
  googleBiddingProblem,
  googleBiddingSavable,
  googleBiddingSavedSentence,
  googleBiddingSentence,
  googleBiddingStrategiesFor,
  googleBiddingUnavailable,
  googleBiddingWarning,
  googleBiddingWithPick,
  googleDefaultBiddingLabel,
  googlePortfolioOffered,
  type GoogleBiddingDraft,
} from "./google-bidding-view";

/**
 * ★★G-14b — the bidding control's words and rules (RMF C.96–C.98, M.96–M.98).
 * Pure, so each decision is pinned here; the control and the dialog only render
 * them. The per-type table mirrors peakhour-api's `googleMerchantBiddingRefusal`
 * (its own suite pins the same fifteen cases).
 */

const d = (o: Partial<GoogleBiddingDraft>): GoogleBiddingDraft => ({ ...EMPTY_BIDDING_DRAFT, ...o });

describe("which campaign type takes which strategy", () => {
  it.each([
    ["SEARCH", "MAXIMIZE_CONVERSIONS", "standard", null],
    ["SEARCH", "TARGET_CPA", "standard", null],
    ["SEARCH", "TARGET_CPA", "portfolio", null],
    ["SEARCH", "TARGET_ROAS", "standard", null],
    ["SEARCH", "TARGET_ROAS", "portfolio", null],
    ["PERFORMANCE_MAX", "MAXIMIZE_CONVERSIONS", "standard", null],
    ["PERFORMANCE_MAX", "TARGET_CPA", "standard", null],
    ["PERFORMANCE_MAX", "TARGET_ROAS", "standard", null],
    ["PERFORMANCE_MAX", "TARGET_CPA", "portfolio", /Performance Max/],
    ["PERFORMANCE_MAX", "TARGET_ROAS", "portfolio", /Performance Max/],
    ["DEMAND_GEN", "MAXIMIZE_CONVERSIONS", "standard", null],
    ["DEMAND_GEN", "TARGET_CPA", "standard", null],
    ["DEMAND_GEN", "TARGET_ROAS", "standard", /Target ROAS isn't available/],
    ["DEMAND_GEN", "TARGET_CPA", "portfolio", /Portfolio bidding strategies aren't available/],
    ["DEMAND_GEN", "TARGET_ROAS", "portfolio", /Target ROAS isn't available/],
  ] as const)("%s, %s, %s", (type, strategy, form, want) => {
    const got = googleBiddingUnavailable(type, strategy, form);
    if (want === null) expect(got).toBeNull();
    else expect(got).toMatch(want);
  });

  it("Maximize Conversions is Standard only, on every type", () => {
    for (const t of ["SEARCH", "PERFORMANCE_MAX", "DEMAND_GEN"] as GoogleChannelType[]) {
      expect(googleBiddingUnavailable(t, "MAXIMIZE_CONVERSIONS", "portfolio")).toMatch(/Standard/);
    }
  });

  it("the control lists what each type takes, and offers Portfolio on Search only", () => {
    expect(googleBiddingStrategiesFor("SEARCH").map((s) => s.value)).toEqual(["MAXIMIZE_CONVERSIONS", "TARGET_CPA", "TARGET_ROAS"]);
    expect(googleBiddingStrategiesFor("PERFORMANCE_MAX").map((s) => s.value)).toEqual(["MAXIMIZE_CONVERSIONS", "TARGET_CPA", "TARGET_ROAS"]);
    expect(googleBiddingStrategiesFor("DEMAND_GEN").map((s) => s.value)).toEqual(["MAXIMIZE_CONVERSIONS", "TARGET_CPA"]);
    expect([googlePortfolioOffered("SEARCH"), googlePortfolioOffered("PERFORMANCE_MAX"), googlePortfolioOffered("DEMAND_GEN")]).toEqual([true, false, false]);
  });

  it("the default named at create is each type's own: Maximize Clicks on Search, Maximize Conversions on the other two", () => {
    expect(googleDefaultBiddingLabel("SEARCH")).toBe("Maximize Clicks");
    expect(googleDefaultBiddingLabel(undefined)).toBe("Maximize Clicks");
    expect(googleDefaultBiddingLabel("PERFORMANCE_MAX")).toBe("Maximize Conversions");
    expect(googleDefaultBiddingLabel("DEMAND_GEN")).toBe("Maximize Conversions");
  });
});

describe("the draft, checked and sent", () => {
  it("DEFAULT sends nothing, and is allowed only at create", () => {
    expect(googleBiddingProblem("SEARCH", EMPTY_BIDDING_DRAFT, true)).toBeNull();
    expect(googleBiddingChoiceOf(EMPTY_BIDDING_DRAFT)).toBeUndefined();
    expect(googleBiddingProblem("SEARCH", EMPTY_BIDDING_DRAFT, false)).toMatch(/Choose/);
  });

  it("Maximize Conversions is sent Standard with no target, whatever the form or target fields hold", () => {
    const draft = d({ pick: "MAXIMIZE_CONVERSIONS", form: "portfolio", target: "12" });
    expect(googleBiddingProblem("SEARCH", draft, false)).toBeNull();
    expect(googleBiddingChoiceOf(draft)).toEqual({ strategy: "MAXIMIZE_CONVERSIONS", form: "standard" });
  });

  it("★a Target CPA is sent as the amount typed, in the form picked", () => {
    expect(googleBiddingChoiceOf(d({ pick: "TARGET_CPA", form: "portfolio", target: "450.50" }))).toEqual({ strategy: "TARGET_CPA", form: "portfolio", target: 450.5 });
    expect(googleBiddingProblem("SEARCH", d({ pick: "TARGET_CPA", target: "" }), false)).toMatch(/cost per conversion/);
    expect(googleBiddingProblem("SEARCH", d({ pick: "TARGET_CPA", target: "0" }), false)).toMatch(/greater than 0/);
    expect(googleBiddingProblem("SEARCH", d({ pick: "TARGET_CPA", target: "1e3" }), false)).not.toBeNull();
    // Review round 1: what a number field or a comma locale gives is a number.
    for (const [t, n] of [[".5", 0.5], ["5.", 5], ["12,5", 12.5]] as const) {
      expect(googleBiddingProblem("SEARCH", d({ pick: "TARGET_CPA", target: t }), false)).toBeNull();
      expect(googleBiddingChoiceOf(d({ pick: "TARGET_CPA", target: t }))!.target).toBe(n);
    }
  });

  it("★a Target ROAS is typed as a percent and sent as Google's ratio, within 1% to 100,000%", () => {
    expect(googleBiddingChoiceOf(d({ pick: "TARGET_ROAS", target: "350" }))).toEqual({ strategy: "TARGET_ROAS", form: "standard", target: 3.5 });
    expect(googleBiddingProblem("SEARCH", d({ pick: "TARGET_ROAS", target: "1" }), false)).toBeNull();
    // ★What is checked is what is sent (review round 1): no rounding to a whole percent.
    expect(googleBiddingChoiceOf(d({ pick: "TARGET_ROAS", target: "350.5" }))!.target).toBe(3.505);
    expect(googleBiddingChoiceOf(d({ pick: "TARGET_ROAS", target: "1.4" }))!.target).toBe(0.014);
    expect(googleBiddingProblem("SEARCH", d({ pick: "TARGET_ROAS", target: "100000" }), false)).toBeNull();
    expect(googleBiddingProblem("SEARCH", d({ pick: "TARGET_ROAS", target: "0.5" }), false)).toMatch(/1% to 100,000%/);
    expect(googleBiddingProblem("SEARCH", d({ pick: "TARGET_ROAS", target: "100001" }), false)).toMatch(/1% to 100,000%/);
  });

  it("★changing the strategy clears the target, whose unit changes with it (review round 1)", () => {
    const cpa = d({ pick: "TARGET_CPA", target: "5" });
    expect(googleBiddingWithPick(cpa, "TARGET_ROAS")).toEqual({ pick: "TARGET_ROAS", form: "standard", target: "" });
    expect(googleBiddingProblem("SEARCH", googleBiddingWithPick(cpa, "TARGET_ROAS"), false)).not.toBeNull();
    expect(googleBiddingWithPick(cpa, "TARGET_CPA")).toBe(cpa);
  });

  it("a choice the type refuses is the problem (the type changed under it)", () => {
    expect(googleBiddingProblem("PERFORMANCE_MAX", d({ pick: "TARGET_CPA", form: "portfolio", target: "5" }), true)).toMatch(/Performance Max/);
    expect(googleBiddingProblem("DEMAND_GEN", d({ pick: "TARGET_ROAS", target: "300" }), true)).toMatch(/Target ROAS isn't available/);
  });

  it("a campaign's current bidding opens as its draft; one Peakhour does not set opens on Maximize Conversions", () => {
    expect(googleBiddingDraftOf({ strategy: "TARGET_ROAS", form: "portfolio", target: 3.5, managed: true })).toEqual({ pick: "TARGET_ROAS", form: "portfolio", target: "350" });
    expect(googleBiddingDraftOf({ strategy: "TARGET_CPA", form: "standard", target: 12.5, managed: true })).toEqual({ pick: "TARGET_CPA", form: "standard", target: "12.5" });
    expect(googleBiddingDraftOf({ strategy: "MAXIMIZE_CLICKS", form: "standard", managed: false })).toEqual({ pick: "MAXIMIZE_CONVERSIONS", form: "standard", target: "" });
  });

  it("one of the three with no readable target opens as itself, its target empty (review round 1)", () => {
    expect(googleBiddingDraftOf({ strategy: "TARGET_CPA", form: "standard", managed: false })).toEqual({ pick: "TARGET_CPA", form: "standard", target: "" });
    expect(googleBiddingDraftOf({ strategy: "TARGET_ROAS", form: "portfolio", managed: false })).toEqual({ pick: "TARGET_ROAS", form: "portfolio", target: "" });
  });

  it("★Save is offered after an edit, or at once when Google holds what Peakhour does not set (review round 1)", () => {
    expect(googleBiddingSavable({ strategy: "MAXIMIZE_CLICKS", form: "standard", managed: false }, false)).toBe(true);
    expect(googleBiddingSavable({ strategy: "TARGET_CPA", form: "standard", managed: false }, false)).toBe(true);
    expect(googleBiddingSavable({ strategy: "TARGET_CPA", form: "standard", target: 4, managed: true }, false)).toBe(false);
    expect(googleBiddingSavable({ strategy: "TARGET_CPA", form: "standard", target: 4, managed: true }, true)).toBe(true);
    expect(googleBiddingSavable(undefined, false)).toBe(false);
  });
});

describe("★the fewer-than-15 warning: said, never a refusal", () => {
  const H = (n: number | null) => ({ conversions30d: n, minimum: 15, days: 30 });
  it.each([
    [0, /had 0 conversions in the last 30 days.*at least 15.*still used as you set it/],
    [1, /had 1 conversion in the last 30 days/],
    [14.5, /had 14\.5 conversions/],
  ])("%s conversions: warned, and the target kept", (n, want) => {
    expect(googleBiddingWarning("TARGET_CPA", H(n))).toMatch(want);
    expect(googleBiddingWarning("TARGET_ROAS", H(n))).toMatch(want);
  });
  it("★the target is kept: what decides whether a draft is sent takes no history at all (review round 1)", () => {
    // Structural, so no history can ever withhold a target: (type, draft, allowDefault).
    expect(googleBiddingProblem.length).toBe(3);
    expect(googleBiddingChoiceOf(d({ pick: "TARGET_CPA", target: "40" }))).toEqual({ strategy: "TARGET_CPA", form: "standard", target: 40 });
  });
  it("15 or more: no warning; an unreadable history: said so, target kept", () => {
    expect(googleBiddingWarning("TARGET_CPA", H(15))).toBeNull();
    expect(googleBiddingWarning("TARGET_CPA", H(null))).toMatch(/couldn't read.*still used as you set it/);
  });
  it("no target strategy, or no history read yet: no warning", () => {
    expect(googleBiddingWarning("MAXIMIZE_CONVERSIONS", H(0))).toBeNull();
    expect(googleBiddingWarning("DEFAULT", H(0))).toBeNull();
    expect(googleBiddingWarning("TARGET_CPA", undefined)).toBeNull();
  });
});

describe("sentences", () => {
  const P = (o: Partial<GoogleBiddingState> = {}): GoogleBiddingState => ({
    strategy: "TARGET_CPA",
    form: "portfolio",
    target: 400,
    managed: true,
    portfolio: { resourceName: "customers/1/biddingStrategies/7", name: "Autumn linen · Target CPA", type: "TARGET_CPA", ours: true, campaigns: 1, target: 400 },
    ...o,
  });
  it("a Portfolio says its name, and how many other campaigns share it", () => {
    expect(googleBiddingSentence(P(), "INR")).toMatch(/^Target CPA of .*400.*, a Portfolio strategy \("Autumn linen · Target CPA"\)\.$/);
    expect(googleBiddingSentence(P({ portfolio: { ...P().portfolio!, campaigns: 3 } }), "INR")).toMatch(/shared with 2 other campaigns\.$/);
  });
  it("a Portfolio Peakhour does not set, or cannot read, is named and says it can be switched (review round 1)", () => {
    expect(googleBiddingSentence({ strategy: "TARGET_SPEND", form: "portfolio", managed: false }, undefined)).toBe(
      "Maximize Clicks, a Portfolio strategy. Peakhour can switch it to one of the strategies below.",
    );
    expect(googleBiddingSentence({ strategy: "UNREADABLE", form: "portfolio", managed: false }, undefined)).toMatch(/^A strategy this account can't read, a Portfolio strategy\. Peakhour can switch/);
  });
  it("a Standard ROAS is a percent; a strategy Peakhour does not set says it can be switched", () => {
    expect(googleBiddingSentence({ strategy: "TARGET_ROAS", form: "standard", target: 3.5, managed: true }, undefined)).toBe("Target ROAS of 350%.");
    expect(googleBiddingSentence({ strategy: "MAXIMIZE_CLICKS", form: "standard", managed: false }, undefined)).toBe(
      "Maximize Clicks. Peakhour can switch it to one of the strategies below.",
    );
  });
  it("a save says what changed, or that nothing did", () => {
    expect(googleBiddingSavedSentence({ strategy: "TARGET_ROAS", form: "portfolio", target: 3 }, true)).toMatch(/^Bidding set to Target ROAS \(Portfolio\)\./);
    expect(googleBiddingSavedSentence({ strategy: "MAXIMIZE_CONVERSIONS", form: "standard" }, false)).toMatch(/nothing changed/);
  });
});
