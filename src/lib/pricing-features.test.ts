import { describe, it, expect } from "vitest";
import {
  CUSTOMER_FEATURE_LABELS,
  HIDDEN_FEATURE_KEYS,
  comparisonRows,
  customerFeatureLabel,
  isHiddenFeature,
  tierGrants,
} from "./pricing-features";
import { PRICING_PILLARS } from "./pricing-catalog";
import type { PricingEntry, ResolvedProductTier } from "./pricing";

/**
 * The comparison table is generated, so the ways it can go wrong are all
 * generation bugs: a row printed twice under two spellings, a row of plumbing
 * nobody is buying, an internal product name reaching a buyer. These pin each
 * one against the shapes the live catalog actually returns.
 */

const pricing: PricingEntry = {
  currency: "INR",
  monthly: 1499,
  yearly: 14999,
  trialDays: 14,
  foundingDiscountPct: 0,
  billingProviderKey: "razorpay",
  taxIncluded: false,
  gstApplicable: true,
  vatApplicable: false,
  displayPrefix: "₹",
};

function tier(
  key: string,
  features: string[],
  extra: Partial<ResolvedProductTier> = {},
): ResolvedProductTier {
  return {
    key,
    name: key,
    features,
    limits: {},
    highlightAsRecommended: false,
    version: 1,
    pricing,
    ...extra,
  };
}

describe("customerFeatureLabel", () => {
  it("prefers our words over the catalog's", () => {
    expect(customerFeatureLabel("content.supervisor", "Content Ideator Supervisor")).toBe(
      "Automatic content ideas, ranked for you",
    );
  });

  it("★answers the same for a platform-namespaced spelling", () => {
    expect(customerFeatureLabel("commerce.woocommerce.product_descriptions")).toBe(
      CUSTOMER_FEATURE_LABELS["commerce.product_descriptions"],
    );
  });

  it("falls back to the catalog name for a key we have no copy for", () => {
    expect(customerFeatureLabel("enterprise.sso", "SSO & Audit Log")).toBe(
      "SSO & Audit Log",
    );
  });

  it("never renders a raw key when the catalog says nothing either", () => {
    expect(customerFeatureLabel("future.thing_we_shipped")).toBe("Thing We Shipped");
  });
});

describe("isHiddenFeature", () => {
  it("hides the workspace plumbing and the entitlement marker", () => {
    expect(isHiddenFeature("commerce.nav")).toBe(true);
    expect(isHiddenFeature("content.assistant")).toBe(true);
  });

  it("hides nothing a buyer is actually choosing between", () => {
    expect(isHiddenFeature("support.sla")).toBe(false);
    expect(isHiddenFeature("commerce.assistant")).toBe(false);
  });
});

describe("tierGrants", () => {
  const free = tier("commerce.free", [
    "commerce.assistant",
    "commerce.woocommerce.product_descriptions",
  ]);

  it("matches across platform namespaces in both directions", () => {
    expect(tierGrants(free, "commerce.product_descriptions")).toBe(true);
    expect(tierGrants(free, "commerce.woocommerce.product_descriptions")).toBe(true);
  });

  it("★does not match a capability the tier lost", () => {
    expect(tierGrants(free, "commerce.multilingual")).toBe(false);
  });
});

describe("comparisonRows", () => {
  const pro = tier(
    "commerce.paid",
    [
      "commerce.nav",
      "commerce.assistant",
      "commerce.product_descriptions",
      "commerce.multilingual",
    ],
    {
      featureDetails: [
        { key: "commerce.nav", name: "Commerce workspace" },
        { key: "commerce.assistant", name: "AI Commerce Assistant" },
      ],
    },
  );
  const free = tier("commerce.free", [
    "commerce.nav",
    "commerce.assistant",
    "commerce.woocommerce.product_descriptions",
  ]);

  it("keeps the column order it was given", () => {
    const rows = comparisonRows([pro, free]);
    const assistant = rows.find((r) => r.key === "commerce.assistant");
    expect(assistant?.included).toEqual([true, true]);
    const multilingual = rows.find((r) => r.key === "commerce.multilingual");
    expect(multilingual?.included).toEqual([true, false]);
  });

  it("★collapses the two spellings of one capability into a single row", () => {
    const rows = comparisonRows([pro, free]);
    const descriptions = rows.filter(
      (r) => r.label === CUSTOMER_FEATURE_LABELS["commerce.product_descriptions"],
    );
    expect(descriptions).toHaveLength(1);
    // …and the tick lands in BOTH columns, which is the bug a duplicate row hides.
    expect(descriptions[0].included).toEqual([true, true]);
  });

  it("drops plumbing rather than printing a row of ticks that decides nothing", () => {
    const rows = comparisonRows([pro, free]);
    expect(rows.some((r) => r.key === "commerce.nav")).toBe(false);
  });

  it("never repeats a label", () => {
    const rows = comparisonRows([pro, free]);
    expect(new Set(rows.map((r) => r.label)).size).toBe(rows.length);
  });

  it("survives a tier with no featureDetails at all (older API)", () => {
    const rows = comparisonRows([free]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.label.length > 0)).toBe(true);
  });
});

describe("the plan-card copy stays wired to the catalog", () => {
  const pillars = Object.values(PRICING_PILLARS);

  it("★grounds every bullet in a feature key", () => {
    // A keyless bullet renders unconditionally, so nothing can catch it going
    // stale. The type allows one for a billing term; no pillar should be using
    // that escape hatch for a capability claim.
    for (const pillar of pillars) {
      for (const h of [...pillar.proHighlights, ...pillar.freeHighlights]) {
        expect(h.key, `${pillar.slug}: "${h.label}" has no key`).toBeTruthy();
      }
    }
  });

  it("never leads with a capability the table would hide", () => {
    for (const pillar of pillars) {
      for (const h of [...pillar.proHighlights, ...pillar.freeHighlights]) {
        expect(
          isHiddenFeature(h.key!),
          `${pillar.slug}: ${h.key} is hidden plumbing`,
        ).toBe(false);
      }
    }
  });

  it("gives a pillar with a paid tier exactly four upgrade blocks", () => {
    for (const pillar of pillars) {
      const expected = pillar.proHighlights.length > 0 ? 4 : 0;
      expect(pillar.proValueBlocks, pillar.slug).toHaveLength(expected);
    }
  });

  it("keeps figures out of the headline copy, where nothing would refresh them", () => {
    for (const pillar of pillars) {
      const copy = [
        pillar.priceHeadline,
        pillar.priceLede,
        ...pillar.proValueBlocks.flatMap((b) => [b.title, b.body]),
      ].join(" ");
      expect(copy, pillar.slug).not.toMatch(/\d/);
    }
  });

  it("holds the card sizes the design asks for", () => {
    for (const pillar of pillars) {
      if (pillar.proHighlights.length === 0) continue;
      expect(pillar.proHighlights.length, pillar.slug).toBeGreaterThanOrEqual(5);
      expect(pillar.proHighlights.length, pillar.slug).toBeLessThanOrEqual(6);
      expect(pillar.freeHighlights.length, pillar.slug).toBeLessThanOrEqual(4);
    }
  });
});

describe("HIDDEN_FEATURE_KEYS", () => {
  it("stays a short, deliberate list", () => {
    // Not a size rule for its own sake: every entry here removes a row a buyer
    // might have wanted, so growth in this set should be a decision someone
    // makes, not a habit.
    expect(HIDDEN_FEATURE_KEYS.size).toBeLessThanOrEqual(6);
  });
});
