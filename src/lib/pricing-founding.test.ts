import { describe, it, expect } from "vitest";
import {
  hasFoundingOffer,
  hasYearlyOffer,
  launchOfferBadge,
  yearlyPrice,
  foundingMonthly,
  foundingYearly,
  formatFoundingMonthly,
  formatFoundingYearly,
  type PricingEntry,
} from "./pricing";

/**
 * The founding offer is the launch price, and it is the one number on the
 * pricing page that is COMPUTED rather than quoted. These pin the arithmetic,
 * and in particular the direction of the rounding — a page that advertises
 * less than the gateway will charge is the failure mode worth a test.
 */

function entry(over: Partial<PricingEntry> = {}): PricingEntry {
  return {
    currency: "INR",
    monthly: 4999,
    yearly: 49999,
    trialDays: 14,
    foundingDiscountPct: 50,
    yearlyDiscountPct: 50,
    billingProviderKey: "razorpay",
    taxIncluded: true,
    gstApplicable: true,
    vatApplicable: false,
    displayPrefix: "₹",
    ...over,
  };
}

describe("hasFoundingOffer", () => {
  it("is on for the seeded Suite row", () => {
    expect(hasFoundingOffer(entry())).toBe(true);
  });

  it("is off when no discount is set — the state of every other plan today", () => {
    expect(hasFoundingOffer(entry({ foundingDiscountPct: 0 }))).toBe(false);
  });

  it("★is off on a free tier, whatever the percentage says", () => {
    // 100% off nothing is still nothing, and a "was ₹0, now ₹0" badge on the
    // Free card would be absurd. Guarding on `monthly > 0` rather than trusting
    // the catalog never to set both.
    expect(hasFoundingOffer(entry({ monthly: 0, yearly: 0 }))).toBe(false);
  });

  it("is off at 100% — a free plan is priced free, not discounted to zero", () => {
    expect(hasFoundingOffer(entry({ foundingDiscountPct: 100 }))).toBe(false);
  });
});

describe("the founding price", () => {
  it("★halves the Suite list price exactly", () => {
    const p = entry();
    expect(foundingMonthly(p)).toBe(2499); // ₹4,999 → ₹2,499
    expect(foundingYearly(p)).toBe(24999); // ₹49,999 → ₹24,999
  });

  it("★rounds DOWN, never up", () => {
    // ₹4,999 at 50% is 2499.5. Rounding to nearest would print ₹2,500 —
    // a rupee more than the customer is charged, on every page view.
    expect(foundingMonthly(entry({ monthly: 4999, foundingDiscountPct: 50 }))).toBe(2499);
    expect(foundingMonthly(entry({ monthly: 100, foundingDiscountPct: 33 }))).toBe(67);
    expect(foundingMonthly(entry({ monthly: 59, foundingDiscountPct: 50 }))).toBe(29);
  });

  it("keeps the currency prefix the catalog resolved", () => {
    expect(formatFoundingMonthly(entry())).toBe("₹2,499");
    expect(formatFoundingYearly(entry())).toBe("₹24,999");
    expect(
      formatFoundingMonthly(entry({ monthly: 59, displayPrefix: "$", currency: "USD" })),
    ).toBe("$29");
  });

  it("groups thousands the same way every other price on the page does", () => {
    expect(formatFoundingYearly(entry({ yearly: 249999, foundingDiscountPct: 50 }))).toBe(
      "₹124,999",
    );
  });

  it("is a no-op at zero, so an un-discounted plan formats as itself", () => {
    const p = entry({ foundingDiscountPct: 0, yearlyDiscountPct: 0 });
    expect(foundingMonthly(p)).toBe(p.monthly);
    expect(foundingYearly(p)).toBe(p.yearly);
  });
});

describe("each billing term carries its own offer (api yearlyDiscountPct)", () => {
  it("the yearly price takes the YEARLY percent, never the monthly one", () => {
    const p = entry({ foundingDiscountPct: 50, yearlyDiscountPct: 20 });
    expect(foundingMonthly(p)).toBe(2499);
    expect(foundingYearly(p)).toBe(39999); // floor(49,999 × 80%), not ₹24,999
  });

  it("a monthly-only campaign: the monthly price is discounted, the yearly is not on offer", () => {
    const p = entry({ foundingDiscountPct: 50, yearlyDiscountPct: 0 });
    expect([hasFoundingOffer(p), hasYearlyOffer(p)]).toEqual([true, false]);
  });

  it("a yearly-only campaign: no monthly offer, a yearly one", () => {
    const p = entry({ foundingDiscountPct: 0, yearlyDiscountPct: 20 });
    expect([hasFoundingOffer(p), hasYearlyOffer(p)]).toEqual([false, true]);
  });

  it("no yearly offer without a yearly price, nor at 100%", () => {
    expect(hasYearlyOffer(entry({ yearly: 0 }))).toBe(false);
    expect(hasYearlyOffer(entry({ yearlyDiscountPct: 100 }))).toBe(false);
  });
});

describe("yearlyPrice: the line every card renders", () => {
  it("the yearly price with the list struck through when the yearly term has an offer", () => {
    expect(yearlyPrice(entry({ yearlyDiscountPct: 50 }))).toEqual({ price: "₹24,999", list: "₹49,999" });
  });
  it("the list price alone under a MONTHLY-only campaign", () => {
    expect(yearlyPrice(entry({ foundingDiscountPct: 50, yearlyDiscountPct: 0 }))).toEqual({ price: "₹49,999", list: null });
  });
  it("nothing without a yearly price", () => {
    expect(yearlyPrice(entry({ yearly: 0 }))).toBeNull();
  });
});

describe("launchOfferBadge: each term's own percent (review R1)", () => {
  it("one percent when both terms carry the same", () => {
    expect(launchOfferBadge(entry())).toBe("Launch offer · 50% off");
  });
  it("names the terms when they differ", () => {
    expect(launchOfferBadge(entry({ foundingDiscountPct: 50, yearlyDiscountPct: 20 }))).toBe("Launch offer · 50% off monthly, 20% yearly");
  });
  it("a monthly-only and a yearly-only offer each say which term", () => {
    expect(launchOfferBadge(entry({ yearlyDiscountPct: 0 }))).toBe("Launch offer · 50% off monthly");
    expect(launchOfferBadge(entry({ foundingDiscountPct: 0, yearlyDiscountPct: 20 }))).toBe("Launch offer · 20% off yearly");
  });
  it("no badge without an offer", () => {
    expect(launchOfferBadge(entry({ foundingDiscountPct: 0, yearlyDiscountPct: 0 }))).toBeNull();
  });
});
