import { describe, it, expect } from "vitest";
import {
  BUNDLE_PLAN_KEYS,
  isBundleTier,
  productTiers,
  freeTier,
  proTier,
  type PricingEntry,
  type ResolvedProduct,
  type ResolvedProductTier,
} from "./pricing";

/**
 * A cross-product plan appears as a tier under EVERY product it lists — that
 * is how the resolver surfaces Agency and Enterprise, and how it will surface
 * Suite. So the per-pillar pages have to reject them by key, and these pin
 * what happens when they don't: `proTier()` prefers whichever tier carries
 * `highlightAsRecommended`, so an unfiltered recommended Suite row silently
 * becomes the "Pro" card on all five pillar pages, at the Suite price.
 */

function entry(monthly: number, yearly: number): PricingEntry {
  return {
    currency: "INR",
    monthly,
    yearly,
    trialDays: monthly > 0 ? 14 : 0,
    foundingDiscountPct: 0,
    billingProviderKey: "razorpay",
    taxIncluded: false,
    gstApplicable: true,
    vatApplicable: false,
    displayPrefix: "₹",
  };
}

function tier(
  key: string,
  monthly: number,
  yearly: number,
  recommended = false,
): ResolvedProductTier {
  return {
    key,
    name: key,
    features: [],
    limits: {},
    highlightAsRecommended: recommended,
    version: 1,
    pricing: entry(monthly, yearly),
  };
}

/** Commerce as the resolver returns it once a recommended Suite row exists. */
const product: ResolvedProduct = {
  key: "commerce_assistant",
  name: "Commerce",
  pillar: "commerce",
  status: "live",
  tiers: [
    tier("commerce_assistant.free", 0, 0),
    tier("commerce_assistant.paid", 1499, 14999, true),
    tier("suite", 4999, 49999, true),
    tier("agency", 24999, 249999),
    tier("enterprise", 0, 0),
  ],
};

describe("BUNDLE_PLAN_KEYS", () => {
  it("★carries suite alongside agency and enterprise", () => {
    expect(BUNDLE_PLAN_KEYS.has("suite")).toBe(true);
    expect(BUNDLE_PLAN_KEYS.has("agency")).toBe(true);
    expect(BUNDLE_PLAN_KEYS.has("enterprise")).toBe(true);
  });

  it("does not swallow a product's own tiers", () => {
    expect(isBundleTier(tier("commerce_assistant.paid", 1499, 14999))).toBe(false);
    expect(isBundleTier(tier("commerce_assistant.free", 0, 0))).toBe(false);
  });
});

describe("a pillar page's tier list, with Suite in the catalog", () => {
  it("shows exactly the product's own Free and Paid", () => {
    expect(productTiers(product).map((t) => t.key)).toEqual([
      "commerce_assistant.free",
      "commerce_assistant.paid",
    ]);
  });

  it("keeps the pillar's own price on the Pro card", () => {
    const pro = proTier(product);
    expect(pro?.key).toBe("commerce_assistant.paid");
    expect(pro?.pricing.monthly).toBe(1499);
  });

  it("★keeps it once the product's own tier stops being the recommended one", () => {
    // This is the case that actually bites, and the one the filter exists for.
    // While `commerce_assistant.paid` carries highlightAsRecommended it wins on
    // sort order alone — cheapest-first, and ₹1,499 < ₹4,999 — so an unfiltered
    // list looks fine and the guard looks unnecessary.
    //
    // It stops looking fine the moment the per-module tiers are retired in
    // favour of Suite, which is the whole direction of travel: drop the flag on
    // the module tier and proTier() hands the Commerce page a ₹4,999 Suite row
    // as "Commerce Pro". A pricing change by deploy order is not a pricing
    // decision, which is why `suite` is filtered BEFORE any Suite plan exists.
    const suiteLeads: ResolvedProduct = {
      ...product,
      tiers: product.tiers.map((t) =>
        t.key === "commerce_assistant.paid"
          ? { ...t, highlightAsRecommended: false }
          : t,
      ),
    };
    const pro = proTier(suiteLeads);
    expect(pro?.key).toBe("commerce_assistant.paid");
    expect(pro?.pricing.monthly).toBe(1499);
  });

  it("still finds the product's own free tier", () => {
    expect(freeTier(product)?.key).toBe("commerce_assistant.free");
  });

  it("falls back to the cheapest paid tier when nothing is recommended", () => {
    const unmarked: ResolvedProduct = {
      ...product,
      tiers: product.tiers.map((t) => ({ ...t, highlightAsRecommended: false })),
    };
    expect(proTier(unmarked)?.key).toBe("commerce_assistant.paid");
  });

  it("★never returns Agency as a product's paid tier", () => {
    // Enterprise is priced 0/0 and Agency is genuinely priced, so a naive
    // "cheapest tier above zero" search lands on Agency for a product with no
    // paid tier of its own.
    const freeOnly: ResolvedProduct = {
      key: "presence",
      name: "Presence",
      pillar: "presence",
      status: "live",
      tiers: [
        tier("presence.free", 0, 0),
        tier("agency", 24999, 249999),
        tier("enterprise", 0, 0),
      ],
    };
    expect(proTier(freeOnly)).toBeUndefined();
    expect(freeTier(freeOnly)?.key).toBe("presence.free");
  });
});
