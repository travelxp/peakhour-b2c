import { describe, expect, it } from "vitest";
import { minFreePeaksPerMonth, formatPeaks } from "./pricing";
import type { PricingEntry, PricingResponse, ResolvedProductTier } from "./pricing";

/** Only monthly/yearly matter here — the rest is required-field ballast. */
function price(monthly: number, yearly: number): PricingEntry {
  return {
    currency: "USD",
    monthly,
    yearly,
    trialDays: 0,
    foundingDiscountPct: 0,
    billingProviderKey: "stripe",
    taxIncluded: false,
    gstApplicable: false,
    vatApplicable: false,
  };
}

function tier(over: Partial<ResolvedProductTier> = {}): ResolvedProductTier {
  return {
    key: "x.free",
    name: "Free",
    features: [],
    limits: {},
    highlightAsRecommended: false,
    version: 1,
    pricing: price(0, 0),
    ...over,
  } as ResolvedProductTier;
}

function response(products: PricingResponse["products"]): PricingResponse {
  return { country: "DEFAULT", plans: [], products };
}

function product(key: string, tiers: ResolvedProductTier[]) {
  return { key, name: key, pillar: key, status: "live", tiers };
}

describe("minFreePeaksPerMonth", () => {
  it("reports the floor every free plan clears, not the sum of all of them", () => {
    // Grants stack in the wallet, so five free pillars really is 2,500 — but
    // the marketing claim is what ONE free plan guarantees.
    const res = response(
      ["commerce", "content", "growth", "support", "presence"].map((k) =>
        product(k, [tier({ key: `${k}.free`, peaksIncluded: 500 })]),
      ),
    );
    expect(minFreePeaksPerMonth(res)).toBe(500);
  });

  it("takes the smallest grant when free plans differ", () => {
    const res = response([
      product("commerce", [tier({ peaksIncluded: 500 })]),
      product("content", [tier({ peaksIncluded: 250 })]),
      product("growth", [tier({ peaksIncluded: 1000 })]),
    ]);
    expect(minFreePeaksPerMonth(res)).toBe(250);
  });

  it("ignores Agency/Enterprise, which look free but grant 100k", () => {
    // Bundle tiers carry no matrix price, so a naive zero-price test matches
    // them. They also appear under every product — and the live API returns
    // `enterprise` BEFORE the real free tier under growth and support_inbox,
    // so a `.find()` on price alone silently read the wrong tier.
    const res = response([
      product("growth", [
        tier({ key: "enterprise", peaksIncluded: 100000 }),
        tier({ key: "growth.free", peaksIncluded: 500 }),
        tier({ key: "agency", peaksIncluded: 25000 }),
      ]),
    ]);
    expect(minFreePeaksPerMonth(res)).toBe(500);
  });

  it("is independent of the order tiers arrive in", () => {
    const free = tier({ key: "growth.free", peaksIncluded: 500 });
    const ent = tier({ key: "enterprise", peaksIncluded: 100000 });
    expect(minFreePeaksPerMonth(response([product("growth", [free, ent])]))).toBe(
      minFreePeaksPerMonth(response([product("growth", [ent, free])])),
    );
  });

  it("ignores paid tiers when picking each product's free tier", () => {
    const res = response([
      product("commerce", [
        tier({ key: "commerce.free", peaksIncluded: 500 }),
        tier({
          key: "commerce.paid",
          peaksIncluded: 5000,
          pricing: price(29, 290),
        }),
      ]),
    ]);
    expect(minFreePeaksPerMonth(res)).toBe(500);
  });

  it("treats a yearly-only price as paid", () => {
    const res = response([
      product("commerce", [
        tier({
          key: "commerce.annual",
          peaksIncluded: 5000,
          pricing: price(0, 290),
        }),
      ]),
    ]);
    expect(minFreePeaksPerMonth(res)).toBeNull();
  });

  it("skips a free tier carrying no allowance rather than counting it as zero", () => {
    // An uncapped grant has no number to show; reporting 0 would be a lie, and
    // as a minimum it would swallow every real grant.
    const res = response([
      product("commerce", [tier({ peaksIncluded: undefined })]),
      product("content", [tier({ peaksIncluded: 500 })]),
    ]);
    expect(minFreePeaksPerMonth(res)).toBe(500);
  });

  it("treats a zero grant as nothing to advertise, not as a minimum of zero", () => {
    // `0 ?? FREE_PEAKS_FALLBACK` is 0, so a zero here would reach the page and
    // render "0+ free Peaks/mo" with no way for the caller to catch it.
    expect(
      minFreePeaksPerMonth(response([product("presence", [tier({ peaksIncluded: 0 })])])),
    ).toBeNull();
    const mixed = response([
      product("presence", [tier({ peaksIncluded: 0 })]),
      product("content", [tier({ peaksIncluded: 500 })]),
    ]);
    expect(minFreePeaksPerMonth(mixed)).toBe(500);
  });

  it("returns null when nothing resolves, so callers use the fallback", () => {
    expect(minFreePeaksPerMonth(null)).toBeNull();
    expect(minFreePeaksPerMonth(response([]))).toBeNull();
    expect(minFreePeaksPerMonth(response([product("commerce", [])]))).toBeNull();
  });

  it("formats with grouping separators", () => {
    expect(formatPeaks(2500)).toBe("2,500");
    expect(formatPeaks(500)).toBe("500");
  });
});
