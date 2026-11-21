/**
 * MR-F2 - the business's ad accounts, as the dashboard words them. The saved choice itself is read in `ad-account-choice.test.ts`.
 */
import { describe, it, expect } from "vitest";
import { metaAdsCardServed } from "./integrations-meta";
import {
  META_MERCHANT_FACING_CODES,
  metaAdAccountStatus,
  metaAdAccountOptionLabel,
  metaAdAccountShortId,
  metaCreatesInLine,
  metaInLine,
} from "./meta-ads-view";

const A = { id: "act_1111", name: "Quests Travel" };

describe("labels", () => {
  it("shortens an id to its last four digits, whichever spelling", () => {
    expect(metaAdAccountShortId("act_1234567890")).toBe("act_…7890");
    expect(metaAdAccountShortId("1234567890")).toBe("act_…7890");
  });
  it("an option reads Name (CURRENCY) · act_…last4", () => {
    expect(metaAdAccountOptionLabel({ id: "act_1234567890", name: "Quests Travel", currency: "INR" })).toBe(
      "Quests Travel (INR) · act_…7890",
    );
    expect(metaAdAccountOptionLabel({ id: "act_1234567890" })).toBe("Ad account · act_…7890");
  });
  it("the dialogs name the account: Creates in, and the read-only In", () => {
    expect(metaCreatesInLine({ id: "act_1234567890", name: "Quests Travel" })).toBe("Creates in Quests Travel (act_…7890)");
    expect(metaInLine({ id: "act_1234567890", name: "Quests Travel" })).toBe("In Quests Travel (act_…7890)");
  });
  it("★one helper for Meta's status words: 2 disabled and 101 closed are blocked; 3, 7 and 9 are tickable with a warning", () => {
    expect(metaAdAccountStatus(2)).toEqual({ blocked: "disabled" });
    expect(metaAdAccountStatus(101)).toEqual({ blocked: "closed" });
    expect(metaAdAccountStatus(3)).toEqual({ warning: "payment issue" });
    expect(metaAdAccountStatus(7)).toEqual({ warning: "under review" });
    expect(metaAdAccountStatus(9)).toEqual({ warning: "grace period" });
    expect(metaAdAccountStatus(1)).toEqual({});
    expect(metaAdAccountStatus(undefined)).toEqual({});
  });
});

describe("the api's refusals are shown as written", () => {
  it("both new codes carry merchant-facing messages", () => {
    expect(META_MERCHANT_FACING_CODES.has("AD_ACCOUNT_NOT_CHOSEN")).toBe(true);
    expect(META_MERCHANT_FACING_CODES.has("AD_ACCOUNT_NOT_IN_BUSINESS")).toBe(true);
  });
});

describe("metaAdsCardServed: the checklist is shown on ONE card", () => {
  const withAds = { account: { extra: { adAccounts: [A] } } };
  it("an ad account, no Ads switch off, no row info: the Ads card is live", () => {
    expect(metaAdsCardServed({ provider: "facebook", ...withAds })).toBe(true);
  });
  it("no ad accounts, or Ads switched off: not live (the Pages card then carries the checklist)", () => {
    expect(metaAdsCardServed({ provider: "facebook", account: { extra: { adAccounts: [] } } })).toBe(false);
    expect(metaAdsCardServed({ provider: "facebook", account: { extra: { adAccounts: [A], capabilities: { ads: { enabled: false } } } } })).toBe(false);
  });
  it("no row serves Ads, or its row is broken: not live", () => {
    expect(metaAdsCardServed({ provider: "facebook", ...withAds, metaConnections: [{ purpose: "content", status: "active" }] })).toBe(false);
    expect(metaAdsCardServed({ provider: "facebook", ...withAds, metaConnections: [{ purpose: "ads", status: "needs_reauth" }] })).toBe(false);
    expect(metaAdsCardServed({ provider: "facebook", ...withAds, metaConnections: [{ purpose: "ads", status: "active" }] })).toBe(true);
    expect(metaAdsCardServed({ provider: "facebook", ...withAds, metaConnections: [{ purpose: null, status: "active" }] })).toBe(true);
  });
});
