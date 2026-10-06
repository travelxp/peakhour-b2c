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
import { hasTrial, signupPromises, signupStats, SIGNUP_PROMISES, PRELAUNCH_PROMISES, HERO_TRUST_POINTS } from "./pillar-console";

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
    foundingDiscountPct: 0,
    yearlyDiscountPct: 0,
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

/** Every module served; Suite composes all but Growth. A leftover per-product
 *  tier (until P4.5) rides along and must never be asked for. */
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
    // Commerce's leftover .paid tier is listed first and carries 14 days too;
    // only the Suite row may answer.
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
    expect(p).toEqual({ price: "₹249,999", list: null, per: "/ year per business, or billed quarterly" });
    expect(JSON.stringify(p)).not.toContain("24,999");
  });

  it("strikes the list price through under a yearly campaign", () => {
    expect(agencyCardPrice(tier("agency", { yearly: 250000, yearlyDiscountPct: 20 }))).toMatchObject({
      price: "₹200,000",
      list: "₹250,000",
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
  it("the /auth stats state the Suite trial's length", () => {
    expect(signupStats(14)).toContainEqual({ value: "14", label: "days of Peakhour Suite, free" });
    expect(signupStats(7).map((s) => s.value)).toEqual(["5", "0", "7"]);
  });

  it("★no Suite trial, no trial stats: no 14-day stand-in (official review R1)", () => {
    // `suiteTrialDays` is null on purpose here, and /auth passes it through.
    const days = suiteTrialDays(catalog(tier("suite", { trialDays: 0 })));
    expect(days).toBeNull();
    const stats = signupStats(days);
    expect(stats.map((s) => s.value)).toEqual(["5", "1"]);
    expect(JSON.stringify(stats)).not.toMatch(/free|credit card/i);
    expect(signupStats(0).map((s) => s.value)).toEqual(["5", "1"]);
  });

  it("★no Suite trial, no trial ticks under the /auth form (official review R1)", () => {
    expect(signupPromises(14, false)).toEqual(SIGNUP_PROMISES);
    expect(signupPromises(14, true)).toEqual(PRELAUNCH_PROMISES);
    expect(signupPromises(null, false)).toEqual(["All five modules, one platform", "Live the same day"]);
    expect(signupPromises(null, true)).toEqual(["All five modules, one platform", "We’ll email your link"]);
    expect(signupPromises(0, false)).toEqual(["All five modules, one platform", "Live the same day"]);
    expect(hasTrial(1)).toBe(true);
    expect(hasTrial(undefined)).toBe(false);
  });

  it("no promise names a free plan", () => {
    for (const line of [...SIGNUP_PROMISES, ...PRELAUNCH_PROMISES, ...HERO_TRUST_POINTS]) {
      expect(line.toLowerCase()).not.toContain("free plan");
    }
    expect(SIGNUP_PROMISES).toContain("Free trial of every module");
  });
});
