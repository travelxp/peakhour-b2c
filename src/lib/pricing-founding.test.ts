import { describe, it, expect } from "vitest";
import {
  hasFoundingOffer,
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
    const p = entry({ foundingDiscountPct: 0 });
    expect(foundingMonthly(p)).toBe(p.monthly);
    expect(foundingYearly(p)).toBe(p.yearly);
  });
});
