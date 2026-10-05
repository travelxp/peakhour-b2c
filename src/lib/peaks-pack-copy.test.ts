import { describe, it, expect } from "vitest";
import { blockedCopy, cardBlockedCopy, cardReason, packReason } from "./peaks-pack-copy";
import type { PeaksPack } from "@/hooks/use-peaks-packs";

/**
 * D18 (api#1484): an org with a Shopify store buys Peaks only in its Shopify
 * admin. The web page must say where they ARE sold, not show "shopify_billed"
 * or a row of greyed buttons with no reason.
 */

const pack = (over: Partial<PeaksPack>): PeaksPack =>
  ({ key: "addon.peaks.small", purchasable: false, blockedReason: null, ...over }) as PeaksPack;

describe("Peaks pack copy", () => {
  it("a Shopify-billed org is pointed at its Shopify admin, and told what it can still see here", () => {
    const c = blockedCopy("shopify_billed")!;
    expect(c).toContain("Shopify admin");
    expect(c).toContain("balance, usage and purchases");
    expect(c).not.toContain("shopify_billed");
  });

  it("the card says it once when every pack is Shopify-billed", () => {
    const c = cardBlockedCopy([pack({ blockedReason: "shopify_billed" }), pack({ key: "addon.peaks.large", blockedReason: "shopify_billed" })]);
    expect(c).toBe(blockedCopy("shopify_billed"));
  });

  it("keeps the existing reasons' sentences", () => {
    expect(blockedCopy("unlimited")).toBe("Your plan already includes unlimited Peaks.");
    expect(blockedCopy("plan_required")).toBe("Peaks packs need an active paid plan.");
    expect(blockedCopy(null)).toBeNull();
  });

  it("says nothing at card level while any pack is buyable", () => {
    expect(cardBlockedCopy([pack({ purchasable: true }), pack({ blockedReason: "shopify_billed" })])).toBeNull();
  });
});

describe("Shopify before country (review R1)", () => {
  const SOON = "Peaks packs are coming soon in your country.";

  it("a Shopify-billed pack says Shopify even where the country is not live", () => {
    expect(packReason(SOON, "shopify_billed")).toBe(blockedCopy("shopify_billed"));
  });

  it("the card says Shopify even where the country is not live", () => {
    expect(cardReason(SOON, [pack({ blockedReason: "shopify_billed" })])).toBe(blockedCopy("shopify_billed"));
  });

  it("every other reason still yields to the country", () => {
    expect(packReason(SOON, "plan_required")).toBe(SOON);
    expect(cardReason(SOON, [pack({ blockedReason: "plan_required" })])).toBe(SOON);
    expect(packReason(null, "plan_required")).toBe(blockedCopy("plan_required"));
  });
});

