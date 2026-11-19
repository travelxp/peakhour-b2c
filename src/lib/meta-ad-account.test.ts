/**
 * MR-F2 - the business's ad accounts, as the dashboard reads them. `savedMetaAdAccounts` mirrors the api's
 * `helpers/meta-saved-ad-account.ts`: the stored ids still listed; with nothing stored, the only listed account; never the
 * first of several.
 */
import { describe, it, expect } from "vitest";
import { metaAdsCardServed, savedMetaAdAccounts } from "./integrations-meta";
import {
  META_MERCHANT_FACING_CODES,
  metaAdAccountStatus,
  metaAdAccountOptionLabel,
  metaAdAccountShortId,
  metaCreatesInLine,
  metaInLine,
} from "./meta-ads-view";

const A = { id: "act_1111", name: "Quests Travel" };
const B = { id: "act_2222", name: "CMPL" };
const C = { id: "act_3333", name: "Third" };
const caps = (enabledIds: string[], defaultId?: string) => ({ enabledIds, defaultId });

describe("savedMetaAdAccounts", () => {
  it("two or more listed and nothing stored: none, never the first", () => {
    expect(savedMetaAdAccounts({ adAccounts: [A, B] })).toEqual({ enabledIds: [] });
  });
  it("one listed and nothing stored: it is enabled and the default", () => {
    expect(savedMetaAdAccounts({ adAccounts: [B] })).toEqual({ enabledIds: ["act_2222"], defaultId: "act_2222" });
  });
  it("no accounts, or no extra: none", () => {
    expect(savedMetaAdAccounts({ adAccounts: [] })).toEqual({ enabledIds: [] });
    expect(savedMetaAdAccounts(undefined)).toEqual({ enabledIds: [] });
  });
  it("several enabled with a default, in the list's order, in either spelling", () => {
    expect(savedMetaAdAccounts({ adAccounts: [A, B, C], metaAdAccounts: caps(["act_3333", "1111"], "3333") })).toEqual({
      enabledIds: ["act_1111", "act_3333"],
      defaultId: "act_3333",
    });
  });
  it("stored ids the list no longer has are dropped", () => {
    expect(savedMetaAdAccounts({ adAccounts: [A, B], metaAdAccounts: caps(["act_1111", "act_9"], "act_1111") })).toEqual({
      enabledIds: ["act_1111"],
      defaultId: "act_1111",
    });
  });
  it("a default that is no longer enabled is no default with 2+ enabled", () => {
    expect(savedMetaAdAccounts({ adAccounts: [A, B, C], metaAdAccounts: caps(["act_1111", "act_2222"], "act_3333") })).toEqual({
      enabledIds: ["act_1111", "act_2222"],
    });
  });
  it("★a SAVED choice is never widened: chose A, the list now has only C, so nothing is enabled", () => {
    expect(savedMetaAdAccounts({ adAccounts: [C], metaAdAccounts: caps(["act_1111"], "act_1111") })).toEqual({ enabledIds: [] });
  });
  it("everything stored is gone and 2+ are listed: none", () => {
    expect(savedMetaAdAccounts({ adAccounts: [A, B], metaAdAccounts: caps(["act_9"], "act_9") })).toEqual({ enabledIds: [] });
  });
});

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
