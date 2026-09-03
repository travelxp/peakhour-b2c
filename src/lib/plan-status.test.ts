import { describe, expect, it } from "vitest";

import {
  holdsPaidProduct,
  isPaidProduct,
  planDisplayName,
  showUpgradeCta,
  type PlanSummaryish,
} from "./plan-status";

/**
 * The reported bug: an org holding Peakhour Suite and Peaks was told to
 * "Upgrade" on every dashboard page, while the billing page that CTA links to
 * showed the Suite as current and offered nothing to buy.
 */

const suite = { tier: "peakhour_suite.pro", state: "active", name: "Peakhour Suite" };
const peaks = { tier: "peaks.pro", state: "active", name: "Peaks" };
const freeGrant = { tier: "commerce_assistant.free", state: "active", name: "Commerce Assistant" };

function summary(over: Partial<PlanSummaryish> = {}): PlanSummaryish {
  return { subscription: { plan: "free" }, products: [], ...over };
}

describe("showUpgradeCta — the reported bug", () => {
  it("⚠️★★★an org holding a PAID product is NOT told to upgrade", () => {
    // ⚠️🚫★★THE BUG. `subscription.plan` can stay `free` while the org owns a
    //  purchased product — the billing page's own comment says so and guards
    //  against it; the top-bar badge did not, so the CTA showed forever on
    //  every dashboard page.
    expect(showUpgradeCta(summary({ products: [suite, peaks] }))).toBe(false);
  });

  it("★★but an org on a free base with NOTHING bought still is", () => {
    // ★THE PAIR THE FIX NEEDS: suppressing the CTA unconditionally would be the
    //  opposite bug, and it is the one nobody would report.
    expect(showUpgradeCta(summary())).toBe(true);
  });

  it("⚠️★a FREE-tier product is a grant, not a purchase", () => {
    // ★The Shopify claim hands an org a free floor product. Counting it as paid
    //  would silence the CTA for exactly the orgs it is meant for.
    expect(showUpgradeCta(summary({ products: [freeGrant] }))).toBe(true);
  });

  it("★an org already at the top of the base ladder is not nagged", () => {
    expect(showUpgradeCta(summary({ subscription: { plan: "enterprise" } }))).toBe(false);
    expect(showUpgradeCta(summary({ subscription: { plan: "agency" } }))).toBe(false);
  });

  it("★starter and growth are upgradable; an unknown tier is not", () => {
    expect(showUpgradeCta(summary({ subscription: { plan: "starter" } }))).toBe(true);
    expect(showUpgradeCta(summary({ subscription: { plan: "growth" } }))).toBe(true);
    // 🚫★AN UNRECOGNISED TIER IS NOT AN INVITATION. A new plan key nobody has
    //  added here should show NO cta rather than a wrong one — the badge is not
    //  the place to guess what a plan means.
    expect(showUpgradeCta(summary({ subscription: { plan: "peakhour_suite" } }))).toBe(false);
  });

  it("★and a summary that has not loaded shows nothing", () => {
    // ★NO FLASH. A CTA that appears for one frame before the products arrive is
    //  the same wrong claim, briefly.
    expect(showUpgradeCta(undefined)).toBe(false);
    expect(showUpgradeCta({})).toBe(false);
  });

  it("⚠️★a malformed products entry does not throw in a top-bar component", () => {
    const bad = { products: [undefined, { state: "active" }] } as unknown as PlanSummaryish;
    expect(() => showUpgradeCta({ ...summary(), ...bad })).not.toThrow();
  });
});

describe("isPaidProduct / holdsPaidProduct", () => {
  it("★a `.free` tier is not paid; anything else is", () => {
    expect(isPaidProduct(suite)).toBe(true);
    expect(isPaidProduct(freeGrant)).toBe(false);
    expect(isPaidProduct(undefined)).toBe(false);
  });

  it("★one paid product among free ones is enough", () => {
    expect(holdsPaidProduct(summary({ products: [freeGrant, suite] }))).toBe(true);
  });

  it("★and no products at all is not a purchase", () => {
    expect(holdsPaidProduct(summary())).toBe(false);
    expect(holdsPaidProduct(undefined)).toBe(false);
  });
});

describe("planDisplayName — the second half of the same report", () => {
  it("⚠️★★the server's `planName` wins, because a tier key is not a name", () => {
    // ⚠️🚫★THE SUMMARY'S OWN TYPE SAYS "ALWAYS PREFER planName", and records
    //  what rendering the key did last time: customers were shown
    //  "Commerce_assistant.Free" as their plan name.
    expect(
      planDisplayName(summary({ subscription: { plan: "commerce_assistant.free", planName: "Commerce Assistant" } })),
    ).toBe("Commerce Assistant");
  });

  it("★★a paid product names a `free` base plan, because the customer is not on one", () => {
    // ★An org whose base tier is `free` and who has bought the Suite is not on
    //  a free plan in any sense they would recognise.
    expect(planDisplayName(summary({ products: [suite] }))).toBe("Peakhour Suite");
  });

  it("★several paid products are COUNTED, not listed", () => {
    // ★A top-bar chip has room for one phrase, and naming only the first hides
    //  the rest behind a label that looks complete.
    expect(planDisplayName(summary({ products: [suite, peaks] }))).toBe("2 products");
  });

  it("★a free base with nothing bought still reads as its tier", () => {
    expect(planDisplayName(summary())).toBe("Free");
  });

  it("★and an unloaded summary names nothing rather than guessing", () => {
    expect(planDisplayName(undefined)).toBeNull();
    expect(planDisplayName({ subscription: {} })).toBeNull();
  });
});
