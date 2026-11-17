import { describe, expect, it } from "vitest";
import { buildConfirmBody, BUSINESS_TYPE_MAX } from "./onboarding-confirm";
import { MARKET_TYPE_CHOICES, MARKET_TYPE_LABEL, isMarketTypeChoice } from "./market-type-labels";

/**
 * PL-5b: the merchant confirms what they sell and who they sell to, and both go in the confirm body.
 * ★WHAT ONLY THESE TESTS CAN GET WRONG: a blank answer is never sent as an empty string, and an untouched page still sends the
 * type it read and the market type that was pre-selected.
 */
const PROFILE = { displayName: "Acme", businessCategory: "retail", description: "Candles", businessType: "Handmade candles" };

describe("buildConfirmBody", () => {
  it("sends the type read and the market type chosen when nothing was edited", () => {
    const b = buildConfirmBody("https://acme.test", PROFILE, null, "b2c");
    expect(b.profile.businessType).toBe("Handmade candles");
    expect(b.marketType).toBe("b2c");
    expect(b.notifyByEmail).toBe(false);
  });
  it("sends the edited type, trimmed", () => {
    const b = buildConfirmBody("u", PROFILE, { displayName: "Acme", businessCategory: "retail", description: "x", businessType: "  Travel news for trade  " }, "b2b");
    expect(b.profile.businessType).toBe("Travel news for trade");
    expect(b.profile.description).toBe("x");
    expect(b.marketType).toBe("b2b");
  });
  it("cuts the type at the api's limit", () => {
    const b = buildConfirmBody("u", PROFILE, { displayName: "A", businessCategory: "retail", description: "x", businessType: "a".repeat(300) }, "");
    expect(b.profile.businessType).toHaveLength(BUSINESS_TYPE_MAX);
  });
  it("leaves the type out when the box is blank, and the market type out when none was chosen", () => {
    const b = buildConfirmBody("u", PROFILE, { displayName: "A", businessCategory: "retail", description: "x", businessType: "   " }, "");
    expect("businessType" in b.profile).toBe(false);
    expect("marketType" in b).toBe(false);
    const none = buildConfirmBody("u", { ...PROFILE, businessType: undefined }, null, "");
    expect("businessType" in none.profile).toBe(false);
  });
});

describe("market type choices", () => {
  it("offers exactly the three the api accepts, each with the words 'Your business' uses", () => {
    expect([...MARKET_TYPE_CHOICES]).toEqual(["b2b", "b2c", "b2b2c"]);
    expect(MARKET_TYPE_CHOICES.map((v) => MARKET_TYPE_LABEL[v])).toEqual(["Businesses (B2B)", "People (B2C)", "Both — you serve people, businesses pay (B2B2C)"]);
    expect(isMarketTypeChoice("unknown")).toBe(false);
    expect(isMarketTypeChoice(undefined)).toBe(false);
  });
});
