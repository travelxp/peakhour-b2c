import { describe, expect, it } from "vitest";

import {
  holdsPaidProduct,
  isConvertedProduct,
  isFreeTier,
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
const suiteTrial = { tier: "peakhour_suite.pro", state: "trial", name: "Peakhour Suite" };
const freeGrant = { tier: "commerce_assistant.free", state: "active", name: "Commerce Assistant" };
const lens = { tier: "content_studio.lens", state: "active", name: "Content Studio Lens" };
/** ⚠️A product whose `name` fell back to the raw tier key server-side. */
const unnamed = { tier: "peakhour_suite.pro", state: "active", name: "peakhour_suite.pro" };

/**
 * ⚠️★★★THE FIXTURE CARRIES `planName`, BECAUSE THE SERVER ALWAYS DOES.
 *
 * `resolvePlanName` ends `return name || key`, so it is **never** absent. 🚫A
 * first version of this file omitted it — and every naming case passed while the
 * shipped function returned "Free" for an org holding the Suite, which is the
 * outcome the module exists to prevent. **A fixture that does not match what the
 * server produces will agree with any implementation you like.**
 */
function summary(over: Partial<PlanSummaryish> = {}): PlanSummaryish {
  return {
    subscription: { plan: "free", planName: "Free", ...(over.subscription ?? {}) },
    products: over.products ?? [],
  };
}

describe("showUpgradeCta — the reported bug", () => {
  it("⚠️★★★an org holding a PAID product is NOT told to upgrade", () => {
    // ⚠️🚫★★THE BUG. `subscription.plan` stays `free` while the org owns a
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

  it("⚠️★★★a TRIALING product does not suppress it — converting is what it is for", () => {
    // ⚠️🚫★A ROUND FOUND `state` DECLARED AND NEVER READ. The endpoint returns
    //  `trial` rows alongside `active` ones, so an org merely trialing the Suite
    //  — having paid nothing — lost the prompt for the whole trial, which is the
    //  one moment it is the right prompt.
    expect(showUpgradeCta(summary({ products: [suiteTrial] }))).toBe(true);
  });

  it("⚠️★★★a paid product does NOT silence the base ladder on starter or growth", () => {
    // ⚠️🚫★A FIRST VERSION ANDed "holds no paid product" onto EVERY upgradable
    //  tier, so an org on `starter` that bought anything permanently lost its
    //  base-ladder prompt — and starter → growth is a real upgrade whatever
    //  products they own. ★The product check disambiguates `free` and nothing
    //  else, because `free` is the only tier that can be lying.
    expect(showUpgradeCta(summary({ subscription: { plan: "starter" }, products: [suite] }))).toBe(true);
    expect(showUpgradeCta(summary({ subscription: { plan: "growth" }, products: [suite] }))).toBe(true);
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


  it("⚠️★★★a `.lens` TIER IS FREE TOO, so it does not suppress the prompt", () => {
    // ⚠️🚫★`credits.ts` STATES IT TWICE: "the free tiers (free, `*.lens`) cost
    //  nothing". A first version counted `.lens` as paid, which would silence a
    //  grandfathered lens-only org's prompt permanently — **the inverted form
    //  of the reported bug, introduced by the fix for it.**
    expect(showUpgradeCta(summary({ products: [lens] }))).toBe(true);
  });

  it("★and a DOTTED free tier is recognised as free", () => {
    // ⚠️★`plan-keys.ts`: "org.subscription.plan holds a TIER key, which since
    //  migration 106 is normally the DOTTED kind". 🚫Comparing the bare string is
    //  the mistake `planToPriority` already made once.
    expect(isFreeTier("commerce_assistant.free")).toBe(true);
    expect(isFreeTier("content_studio.lens")).toBe(true);
    expect(isFreeTier("free")).toBe(true);
    expect(isFreeTier("peakhour_suite.pro")).toBe(false);
    expect(isFreeTier(undefined)).toBe(false);
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

describe("isPaidProduct / isConvertedProduct / holdsPaidProduct", () => {
  it("★a `.free` or `.lens` tier is not paid; anything else is", () => {
    expect(isPaidProduct(suite)).toBe(true);
    expect(isPaidProduct(freeGrant)).toBe(false);
    expect(isPaidProduct(lens)).toBe(false);
    expect(isPaidProduct(undefined)).toBe(false);
  });

  it("★★a trial is PAID by tier and NOT CONVERTED by state", () => {
    // ★The two questions the module keeps apart: what they hold, and what they
    //  have paid for.
    expect(isPaidProduct(suiteTrial)).toBe(true);
    expect(isConvertedProduct(suiteTrial)).toBe(false);
    expect(isConvertedProduct(suite)).toBe(true);
    expect(isConvertedProduct(freeGrant)).toBe(false);
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
  it("⚠️★★★a paid product names a `free` base plan, EVEN THOUGH `planName` is set", () => {
    // ⚠️🚫★★THE ROUND-1 DEFECT: `planName` was checked first and the server
    //  always populates it (`return name || key`), so this returned **"Free"**
    //  for an org holding the Suite — the outcome the module was written to
    //  prevent, shipped inside the fix. ★The fixture carries `planName: "Free"`
    //  precisely because production does.
    expect(planDisplayName(summary({ products: [suite] }))).toBe("Peakhour Suite");
  });

  it("★a TRIALING product names it too — they are not on a free plan", () => {
    // ★The other side of the trial split: naming counts a trial, the CTA does
    //  not.
    expect(planDisplayName(summary({ products: [suiteTrial] }))).toBe("Peakhour Suite");
  });

  it("★several products are COUNTED, not listed", () => {
    expect(planDisplayName(summary({ products: [suite, peaks] }))).toBe("2 products");
  });

  it("⚠️★★a REAL tier is named by `planName`, not by a product it also holds", () => {
    // ★A `growth` org's plan is Growth; the products are additions to it, and a
    //  top-bar chip has room for the primary identity only. ★This is what keeps
    //  the free-tier override from becoming a rule about every tier.
    expect(
      planDisplayName(summary({ subscription: { plan: "growth", planName: "Growth" }, products: [suite] })),
    ).toBe("Growth");
  });

  it("★★and `planName` still wins over a machine tier key", () => {
    // ⚠️🚫★THE SUMMARY'S OWN TYPE SAYS "ALWAYS PREFER planName", and records
    //  what rendering the key did last time: customers were shown
    //  "Commerce_assistant.Free" as their plan name.
    expect(
      planDisplayName(
        summary({ subscription: { plan: "commerce_assistant.free", planName: "Commerce Assistant" } }),
      ),
    ).toBe("Commerce Assistant");
  });

  it("★a free base with nothing bought still reads as its name", () => {
    expect(planDisplayName(summary())).toBe("Free");
  });


  it("⚠️★★★a DOTTED free base is named by what the org holds", () => {
    // ⚠️🚫★★THE ORGS THE REPORT IS ABOUT. Shopify autoprovision writes
    //  `commerce_assistant.free`, and a first version compared the BARE string —
    //  so those orgs would still have read "Peakhour.ai Commerce: Free" while
    //  holding the Suite.
    expect(
      planDisplayName(
        summary({
          subscription: { plan: "commerce_assistant.free", planName: "Peakhour.ai Commerce: Free" },
          products: [suite],
        }),
      ),
    ).toBe("Peakhour Suite");
  });

  it("⚠️★★a product whose NAME is really its tier key is refused", () => {
    // ⚠️🚫★The endpoint falls back to the raw key when no `cfg_plans` row
    //  resolves, so this would print **"Peakhour_suite.pro"** under the badge’s
    //  `capitalize` — the same failure the module exists to prevent. ★Falling
    //  through to `planName` is the honest answer.
    expect(planDisplayName(summary({ products: [unnamed] }))).toBe("Free");
  });
  it("★and an unloaded summary names nothing rather than guessing", () => {
    expect(planDisplayName(undefined)).toBeNull();
    expect(planDisplayName({ subscription: {} })).toBeNull();
  });
});
