import { describe, it, expect } from "vitest";
import {
  hasMonthlyOffer,
  hasYearlyOffer,
  offerBadge,
  offerLabels,
  yearlyPrice,
  offerMonthly,
  offerYearly,
  formatOfferMonthly,
  formatOfferYearly,
  type PricingEntry,
} from "./pricing";

/**
 * A campaign offer is the one number on the pricing page that is COMPUTED
 * rather than quoted. These pin the arithmetic, and in particular the
 * direction of the rounding — a page that advertises less than the gateway
 * will charge is the failure mode worth a test.
 *
 * ★AND WHAT THE OFFER IS CALLED IS THE CAMPAIGN'S (owner, 2026-10-06: offers
 * come from campaigns and are never hard-coded). The page names it by the
 * label `/v1/platform/pricing` carries per term, never by copy of its own.
 */

const FOUNDING = "Founding price: Peakhour Suite";

/** The dev catalog: Suite at ₹4,999 with the founding campaign on both terms. */
function entry(over: Partial<PricingEntry> = {}): PricingEntry {
  return {
    currency: "INR",
    monthly: 4999,
    yearly: 49999,
    trialDays: 14,
    monthlyDiscountPct: 50,
    yearlyDiscountPct: 50,
    monthlyCampaignLabel: FOUNDING,
    yearlyCampaignLabel: FOUNDING,
    billingProviderKey: "razorpay",
    taxIncluded: true,
    gstApplicable: true,
    vatApplicable: false,
    displayPrefix: "₹",
    ...over,
  };
}

describe("hasMonthlyOffer", () => {
  it("is on for the seeded Suite row", () => {
    expect(hasMonthlyOffer(entry())).toBe(true);
  });

  it("is off when no discount is set — the state of every other plan today", () => {
    expect(hasMonthlyOffer(entry({ monthlyDiscountPct: 0 }))).toBe(false);
  });

  it("★is off on an unpriced plan, whatever the percentage says", () => {
    // 100% off nothing is still nothing, and a "was ₹0, now ₹0" badge on a
    // contact-sales card (Enterprise) would be absurd. Guarding on `monthly > 0` rather than trusting
    // the catalog never to set both.
    expect(hasMonthlyOffer(entry({ monthly: 0, yearly: 0 }))).toBe(false);
  });

  it("is off at 100% — nothing is discounted to zero", () => {
    expect(hasMonthlyOffer(entry({ monthlyDiscountPct: 100 }))).toBe(false);
  });

  it("★an api that sends no monthly percent (one deployed before the rename) is no offer, never NaN", () => {
    const old = entry();
    delete (old as Partial<PricingEntry>).monthlyDiscountPct;
    expect(hasMonthlyOffer(old)).toBe(false);
    expect(offerBadge({ ...old, yearlyDiscountPct: 0 })).toBeNull();
  });
});

describe("the offer price", () => {
  it("★halves the Suite list price exactly", () => {
    const p = entry();
    expect(offerMonthly(p)).toBe(2499); // ₹4,999 → ₹2,499
    expect(offerYearly(p)).toBe(24999); // ₹49,999 → ₹24,999
  });

  it("★rounds DOWN, never up", () => {
    // ₹4,999 at 50% is 2499.5. Rounding to nearest would print ₹2,500 —
    // a rupee more than the customer is charged, on every page view.
    expect(offerMonthly(entry({ monthly: 4999, monthlyDiscountPct: 50 }))).toBe(2499);
    expect(offerMonthly(entry({ monthly: 100, monthlyDiscountPct: 33 }))).toBe(67);
    expect(offerMonthly(entry({ monthly: 59, monthlyDiscountPct: 50 }))).toBe(29);
  });

  it("keeps the currency prefix the catalog resolved", () => {
    expect(formatOfferMonthly(entry())).toBe("₹2,499");
    expect(formatOfferYearly(entry())).toBe("₹24,999");
    expect(
      formatOfferMonthly(entry({ monthly: 59, displayPrefix: "$", currency: "USD" })),
    ).toBe("$29");
  });

  it("groups thousands the same way every other price on the page does", () => {
    expect(formatOfferYearly(entry({ yearly: 249999, yearlyDiscountPct: 50 }))).toBe(
      "₹124,999",
    );
  });

  it("is a no-op at zero, so an un-discounted plan formats as itself", () => {
    const p = entry({ monthlyDiscountPct: 0, yearlyDiscountPct: 0 });
    expect(offerMonthly(p)).toBe(p.monthly);
    expect(offerYearly(p)).toBe(p.yearly);
  });
});

describe("each billing term carries its own offer (api yearlyDiscountPct)", () => {
  it("the yearly price takes the YEARLY percent, never the monthly one", () => {
    const p = entry({ monthlyDiscountPct: 50, yearlyDiscountPct: 20 });
    expect(offerMonthly(p)).toBe(2499);
    expect(offerYearly(p)).toBe(39999); // floor(49,999 × 80%), not ₹24,999
  });

  it("a monthly-only campaign: the monthly price is discounted, the yearly is not on offer", () => {
    const p = entry({ monthlyDiscountPct: 50, yearlyDiscountPct: 0 });
    expect([hasMonthlyOffer(p), hasYearlyOffer(p)]).toEqual([true, false]);
  });

  it("a yearly-only campaign: no monthly offer, a yearly one", () => {
    const p = entry({ monthlyDiscountPct: 0, yearlyDiscountPct: 20 });
    expect([hasMonthlyOffer(p), hasYearlyOffer(p)]).toEqual([false, true]);
  });

  it("no yearly offer without a yearly price, nor at 100%", () => {
    expect(hasYearlyOffer(entry({ yearly: 0 }))).toBe(false);
    expect(hasYearlyOffer(entry({ yearlyDiscountPct: 100 }))).toBe(false);
  });
});

describe("offerLabels: a term's label is said only beside its own offer", () => {
  it("each term's own campaign label", () => {
    expect(offerLabels(entry({ yearlyCampaignLabel: "Annual saver" }))).toEqual({ monthly: FOUNDING, yearly: "Annual saver" });
  });
  it("★a label on a term with no offer is not said: no name without the percent it explains", () => {
    expect(offerLabels(entry({ monthlyDiscountPct: 0 }))).toEqual({ monthly: null, yearly: FOUNDING });
    expect(offerLabels(entry({ yearly: 0 }))).toEqual({ monthly: FOUNDING, yearly: null });
  });
  it("a blank label is no label, and a padded one is trimmed", () => {
    expect(offerLabels(entry({ monthlyCampaignLabel: "   ", yearlyCampaignLabel: "  Annual saver " }))).toEqual({
      monthly: null,
      yearly: "Annual saver",
    });
  });
});

describe("yearlyPrice: the line every card renders", () => {
  it("the yearly price with the list struck through and its campaign named beside its percent when the yearly term has an offer", () => {
    expect(yearlyPrice(entry({ yearlyDiscountPct: 50 }))).toEqual({ price: "₹24,999", list: "₹49,999", offer: `${FOUNDING} · 50% off` });
  });
  it("the list price alone, unnamed, under a MONTHLY-only campaign", () => {
    expect(yearlyPrice(entry({ monthlyDiscountPct: 50, yearlyDiscountPct: 0 }))).toEqual({ price: "₹49,999", list: null, offer: null });
  });
  it("a yearly offer whose campaign has no label still strikes the list through, and says its percent alone", () => {
    expect(yearlyPrice(entry({ yearlyCampaignLabel: null }))).toEqual({ price: "₹24,999", list: "₹49,999", offer: "50% off" });
  });
  it("nothing without a yearly price", () => {
    expect(yearlyPrice(entry({ yearly: 0 }))).toBeNull();
  });
});

describe("offerBadge: the campaign's own label and each term's percent", () => {
  it("★the founding campaign on both terms: its label, one percent", () => {
    expect(offerBadge(entry())).toBe("Founding price: Peakhour Suite · 50% off");
  });
  it("★no hard-coded name: any campaign is called what it calls itself", () => {
    const spring = entry({ monthlyCampaignLabel: "Spring sale", yearlyCampaignLabel: "Spring sale" });
    expect(offerBadge(spring)).toBe("Spring sale · 50% off");
    expect(offerBadge(entry())).not.toMatch(/launch offer/i);
  });
  it("one campaign, two percents: names the terms", () => {
    expect(offerBadge(entry({ monthlyDiscountPct: 50, yearlyDiscountPct: 20 }))).toBe(
      "Founding price: Peakhour Suite · 50% off monthly, 20% yearly",
    );
  });
  it("★two campaigns, one per term: each named by its own label", () => {
    expect(offerBadge(entry({ yearlyDiscountPct: 20, yearlyCampaignLabel: "Annual saver" }))).toBe(
      "Founding price: Peakhour Suite · 50% off monthly; Annual saver · 20% off yearly",
    );
  });
  it("a monthly-only and a yearly-only offer each say which term", () => {
    expect(offerBadge(entry({ yearlyDiscountPct: 0 }))).toBe("Founding price: Peakhour Suite · 50% off monthly");
    expect(offerBadge(entry({ monthlyDiscountPct: 0, yearlyDiscountPct: 20 }))).toBe("Founding price: Peakhour Suite · 20% off yearly");
  });
  it("★a yearly-only offer never borrows the monthly term's label", () => {
    expect(offerBadge(entry({ monthlyDiscountPct: 0, yearlyDiscountPct: 20, yearlyCampaignLabel: "Annual saver" }))).toBe(
      "Annual saver · 20% off yearly",
    );
  });
  it("★a campaign with no label says its percent alone, inventing no name", () => {
    expect(offerBadge(entry({ monthlyCampaignLabel: null, yearlyCampaignLabel: null }))).toBe("50% off");
    expect(offerBadge(entry({ monthlyCampaignLabel: null, yearlyCampaignLabel: null, yearlyDiscountPct: 0 }))).toBe("50% off monthly");
  });
  it("no badge without an offer", () => {
    expect(offerBadge(entry({ monthlyDiscountPct: 0, yearlyDiscountPct: 0 }))).toBeNull();
  });
});
