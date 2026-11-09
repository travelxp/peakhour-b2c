import { describe, it, expect } from "vitest";
import { blockedCopy, cardBlockedCopy, cardReason, packReason, packRefusalShownAsIs } from "./peaks-pack-copy";
import type { PackBlockedReason, PeaksPack } from "@/hooks/use-peaks-packs";

/**
 * D18 revised (2026-10-06, P4.10b): every org buys Peaks on this page,
 * Shopify-connected or not. Nothing the page says may send a buyer to the
 * Shopify admin to buy, and the api's retired `shopify_billed` marker, which an
 * api without P4.10a still sends, must read as a sentence, never as its code.
 */

const pack = (over: Partial<PeaksPack>): PeaksPack =>
  ({ key: "addon.peaks.small", purchasable: false, blockedReason: null, ...over }) as PeaksPack;

// `satisfies` makes tsc (which this repo runs over tests) fail when the union
// gains a member this list lacks, or when this list names one the union lost.
const EVERY_REASON = Object.keys({
  plan_required: true,
  unlimited: true,
  no_wallet: true,
  not_priced_here: true,
} satisfies Record<PackBlockedReason, true>) as PackBlockedReason[];

// The D18 marker, cast because it is no longer a member: the wire can still
// carry it until the api's P4.10a deploys.
const RETIRED_SHOPIFY = "shopify_billed" as PackBlockedReason;

const SOON = "Peaks packs are coming soon in your country.";

describe("Peaks pack copy", () => {
  it("no reason the api lists sends the buyer to Shopify, and each has a sentence", () => {
    for (const r of EVERY_REASON) {
      const c = blockedCopy(r);
      expect(c, r).toBeTruthy();
      expect(c, r).not.toBe(r);
      expect(c, r).not.toMatch(/shopify/i);
    }
  });

  it("the retired shopify_billed marker reads as a sentence, not its code or the Shopify admin", () => {
    expect(blockedCopy(RETIRED_SHOPIFY)).toBe("This pack isn't available on your account right now.");
  });

  it("a card of packs all carrying the retired marker says the same sentence once", () => {
    const c = cardBlockedCopy([pack({ blockedReason: RETIRED_SHOPIFY }), pack({ key: "addon.peaks.large", blockedReason: RETIRED_SHOPIFY })]);
    expect(c).toBe(blockedCopy(RETIRED_SHOPIFY));
  });

  it("keeps the existing reasons' sentences", () => {
    expect(blockedCopy("unlimited")).toBe("Your plan already includes unlimited Peaks.");
    expect(blockedCopy("plan_required")).toBe("Peaks packs need an active paid plan.");
    expect(blockedCopy(null)).toBeNull();
  });

  it("says nothing at card level while any pack is buyable", () => {
    expect(cardBlockedCopy([pack({ purchasable: true }), pack({ blockedReason: "plan_required" })])).toBeNull();
  });
});

describe("the country notice comes first, for every org", () => {
  it("a pack yields its reason to the country notice, whatever the reason", () => {
    for (const r of EVERY_REASON) expect(packReason(SOON, r), r).toBe(SOON);
  });

  it("a pack carrying the retired Shopify marker yields to the country notice too", () => {
    expect(packReason(SOON, RETIRED_SHOPIFY)).toBe(SOON);
  });

  it("the card yields to the country notice even when a pack carries the retired Shopify marker", () => {
    expect(cardReason(SOON, [pack({ blockedReason: RETIRED_SHOPIFY }), pack({ key: "addon.peaks.large", blockedReason: "plan_required" })])).toBe(SOON);
  });

  it("with the country live, the pack's own reason shows", () => {
    expect(packReason(null, "plan_required")).toBe(blockedCopy("plan_required"));
    expect(cardReason(null, [pack({ blockedReason: "plan_required" })])).toBe(blockedCopy("plan_required"));
  });
});

describe("pack-checkout refusals shown as written", () => {
  it("a refusal written for the buyer is shown as is", () => {
    for (const code of ["COUNTRY_COMING_SOON", "PLAN_REQUIRED", "WALLET_UNLIMITED", "PACK_NOT_PURCHASABLE"]) {
      expect(packRefusalShownAsIs(code), code).toBe(true);
    }
  });

  it("SHOPIFY_BILLED is not shown as is: its message pointed at the Shopify admin", () => {
    expect(packRefusalShownAsIs("SHOPIFY_BILLED")).toBe(false);
  });

  it("an unknown code falls through to the shared handler", () => {
    expect(packRefusalShownAsIs("UNKNOWN")).toBe(false);
  });
});
