import { describe, expect, it } from "vitest";
import {
  agencyCardPrice,
  findBundleTier,
  suiteCtaLabel,
  suiteTrialDays,
  type PricingEntry,
  type PricingResponse,
  type ResolvedProductTier,
} from "./pricing";
import { suiteModuleSlugs } from "./pricing-catalog";
import { signupTicks } from "@/app/(site)/auth/auth-copy";
import { hasTrial } from "./trial-copy";

/**
 * One catalog on the website (billing plan D19, P4.7): Peakhour Suite, Agency
 * (quarterly / yearly) and Enterprise (contact sales). No per-module plans, no
 * free tier; a new business starts on a Suite trial.
 */

function entry(over: Partial<PricingEntry> = {}): PricingEntry {
  return {
    currency: "INR",
    monthly: 4999,
    yearly: 49999,
    trialDays: 14,
    monthlyDiscountPct: 0,
    yearlyDiscountPct: 0,
    monthlyCampaignLabel: null,
    yearlyCampaignLabel: null,
    billingProviderKey: "razorpay",
    taxIncluded: false,
    gstApplicable: true,
    vatApplicable: false,
    displayPrefix: "₹",
    ...over,
  };
}

function tier(key: string, pricing: Partial<PricingEntry> = {}): ResolvedProductTier {
  return { key, name: key, features: [], limits: {}, highlightAsRecommended: false, version: 1, pricing: entry(pricing) };
}

const SUITE = tier("suite");
const AGENCY = tier("agency", { monthly: 24999, yearly: 249999, trialDays: 0 });

/** Every module served; Suite composes all but Growth. A per-product tier
 *  stays in this fixture although none exists since migration 394 (P4.5): it
 *  is what proves `suiteTrialDays` reads the Suite row and no other. */
function catalog(suite: ResolvedProductTier | null = SUITE): PricingResponse {
  const plans = (extra: ResolvedProductTier[]) => [...extra, AGENCY, ...(suite ? [suite] : [])];
  return {
    country: "IN",
    products: [
      { key: "presence", name: "Presence", pillar: "presence", status: "live", tiers: plans([tier("presence.free", { monthly: 0, yearly: 0 })]) },
      { key: "commerce_assistant", name: "Commerce", pillar: "commerce", status: "live", tiers: plans([tier("commerce_assistant.paid", { monthly: 1499 })]) },
      { key: "content_studio", name: "Content", pillar: "content", status: "live", tiers: plans([]) },
      { key: "support_inbox", name: "Support", pillar: "support", status: "live", tiers: plans([]) },
      { key: "growth", name: "Growth", pillar: "growth", status: "live", tiers: [AGENCY] },
    ],
  };
}

describe("suiteTrialDays: how a new business starts (D19)", () => {
  it("is Suite's own trialDays", () => {
    expect(suiteTrialDays(catalog())).toBe(14);
    expect(suiteTrialDays(catalog(tier("suite", { trialDays: 7 })))).toBe(7);
  });

  it("is null without a Suite, with a zero trial, or without pricing: no promised trial", () => {
    expect(suiteTrialDays(catalog(null))).toBeNull();
    expect(suiteTrialDays(catalog(tier("suite", { trialDays: 0 })))).toBeNull();
    expect(suiteTrialDays(null)).toBeNull();
  });

  it("never reads a per-product tier's trial", () => {
    // The fixture's per-product Commerce tier is listed first and carries 14
    // days too; only the Suite row may answer.
    expect(suiteTrialDays(catalog(tier("suite", { trialDays: 3 })))).toBe(3);
  });
});

describe("the Suite CTA names the trial it starts", () => {
  it("a trial: its length", () => {
    expect(suiteCtaLabel(14)).toBe("Start your 14-day free trial");
  });

  it("no trial: buy the plan", () => {
    expect(suiteCtaLabel(0)).toBe("Get Peakhour Suite");
  });
});

describe("agencyCardPrice: Agency is sold quarterly and yearly, never monthly (D5)", () => {
  it("quotes the year, never the monthly figure", () => {
    const p = agencyCardPrice(AGENCY);
    expect(p).toEqual({ price: "₹249,999", list: null, offer: null, per: "/ year per business, or billed quarterly" });
    expect(JSON.stringify(p)).not.toContain("24,999");
  });

  it("strikes the list price through under a yearly campaign, named by that campaign beside its percent", () => {
    expect(agencyCardPrice(tier("agency", { yearly: 250000, yearlyDiscountPct: 20, yearlyCampaignLabel: "Agency launch" }))).toMatchObject({
      price: "₹200,000",
      list: "₹250,000",
      // The term, because the card also sells quarterly, which this offer does not cover.
      offer: "Agency launch · 20% off yearly",
    });
  });

  it("is null without an Agency row or a yearly price: no invented figure", () => {
    expect(agencyCardPrice(undefined)).toBeNull();
    expect(agencyCardPrice(tier("agency", { yearly: 0 }))).toBeNull();
  });
});

describe("suiteModuleSlugs: what Suite includes, asked of each product", () => {
  it("lists the composed modules in hub order and leaves the rest out", () => {
    expect(suiteModuleSlugs(catalog())).toEqual(["presence", "commerce", "content", "support"]);
  });

  it("is empty when the environment sells no Suite", () => {
    expect(suiteModuleSlugs(catalog(null))).toEqual([]);
    expect(suiteModuleSlugs(null)).toEqual([]);
  });

  it("findBundleTier finds the catalog plan, never a per-product tier", () => {
    expect(findBundleTier(catalog(), "suite")?.key).toBe("suite");
    expect(findBundleTier(catalog(), "agency")?.key).toBe("agency");
    expect(findBundleTier(catalog(), "enterprise")).toBeUndefined();
  });
});

describe("signup copy promises a trial, not a free plan (D19)", () => {
  it("the /auth ticks state the Suite trial's length, and no module count", () => {
    expect(signupTicks(14, false)).toEqual(["14-day free trial · No credit card", "Live the same day"]);
    expect(signupTicks(7, true)).toEqual(["7-day free trial once approved · No credit card", "We’ll email your link"]);
  });

  it("★no Suite trial, no trial ticks: no 14-day stand-in (official review R1)", () => {
    // `suiteTrialDays` is null on purpose here, and /auth passes it through.
    const days = suiteTrialDays(catalog(tier("suite", { trialDays: 0 })));
    expect(days).toBeNull();
    expect(signupTicks(days, false)).toEqual(["Live the same day"]);
    expect(signupTicks(null, true)).toEqual(["We’ll email your link"]);
    expect(signupTicks(0, false)).toEqual(["Live the same day"]);
    for (const d of [days, null, 0]) expect(JSON.stringify(signupTicks(d, false))).not.toMatch(/free|credit card|trial/i);
    expect(hasTrial(1)).toBe(true);
    expect(hasTrial(undefined)).toBe(false);
  });

  it("no tick names a free plan, a module count, or every module", () => {
    for (const d of [14, null]) {
      for (const pre of [true, false]) {
        const text = signupTicks(d, pre).join(" ").toLowerCase();
        expect(text).not.toContain("free plan");
        expect(text).not.toMatch(/five modules|every module|5 modules/);
      }
    }
  });
});
