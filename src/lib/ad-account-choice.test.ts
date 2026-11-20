/**
 * MR-F2 / MR-G0 - the business's ad accounts, as the dashboard reads them. `savedAdAccounts` mirrors the api's
 * `helpers/business-ad-accounts.ts`: the stored ids still listed; with nothing stored, the only listed account; never the
 * first of several.
 */
import { describe, it, expect } from "vitest";
import { adAccountFormat, savedAdAccounts } from "./ad-account-choice";

const A = { id: "act_1111", name: "Quests Travel" };
const B = { id: "act_2222", name: "CMPL" };
const C = { id: "act_3333", name: "Third" };
const caps = (enabledIds: string[], defaultId?: string) => ({ enabledIds, defaultId });

describe("savedAdAccounts (Meta)", () => {
  it("two or more listed and nothing stored: none, never the first", () => {
    expect(savedAdAccounts("facebook", { adAccounts: [A, B] })).toEqual({ enabledIds: [] });
  });
  it("one listed and nothing stored: it is enabled and the default", () => {
    expect(savedAdAccounts("facebook", { adAccounts: [B] })).toEqual({ enabledIds: ["act_2222"], defaultId: "act_2222" });
  });
  it("no accounts, or no extra: none", () => {
    expect(savedAdAccounts("facebook", { adAccounts: [] })).toEqual({ enabledIds: [] });
    expect(savedAdAccounts("facebook", undefined)).toEqual({ enabledIds: [] });
  });
  it("several enabled with a default, in the list's order, in either spelling", () => {
    expect(savedAdAccounts("facebook", { adAccounts: [A, B, C], adAccountChoice: caps(["act_3333", "1111"], "3333") })).toEqual({
      enabledIds: ["act_1111", "act_3333"],
      defaultId: "act_3333",
    });
  });
  it("stored ids the list no longer has are dropped", () => {
    expect(savedAdAccounts("facebook", { adAccounts: [A, B], adAccountChoice: caps(["act_1111", "act_9"], "act_1111") })).toEqual({
      enabledIds: ["act_1111"],
      defaultId: "act_1111",
    });
  });
  it("a default that is no longer enabled is no default with 2+ enabled", () => {
    expect(savedAdAccounts("facebook", { adAccounts: [A, B, C], adAccountChoice: caps(["act_1111", "act_2222"], "act_3333") })).toEqual({
      enabledIds: ["act_1111", "act_2222"],
    });
  });
  it("★a SAVED choice is never widened: chose A, the list now has only C, so nothing is enabled", () => {
    expect(savedAdAccounts("facebook", { adAccounts: [C], adAccountChoice: caps(["act_1111"], "act_1111") })).toEqual({ enabledIds: [] });
  });
  it("everything stored is gone and 2+ are listed: none", () => {
    expect(savedAdAccounts("facebook", { adAccounts: [A, B], adAccountChoice: caps(["act_9"], "act_9") })).toEqual({ enabledIds: [] });
  });
});


describe("a provider's formatter", () => {
  it("Meta words an id, its status and its platform; a provider with no row has none", () => {
    const f = adAccountFormat("facebook")!;
    expect(f.platformName).toBe("Meta");
    expect(f.idLine({ id: "act_1234567890", currency: "INR" })).toBe("Account ID 1234567890 · INR");
    expect(f.health({ id: "act_1", status: 2 })).toEqual({ blocked: "disabled" });
    expect(f.health({ id: "act_1", status: 9 })).toEqual({ warning: "grace period" });
    expect(adAccountFormat("tiktok_ads")).toBeUndefined();
  });
  it("a provider with no formatter has no choice (its format row owns where its accounts are listed)", () => {
    expect(savedAdAccounts("tiktok_ads", { adAccounts: [A, B], adAccountChoice: caps(["act_2222"], "act_2222") })).toEqual({ enabledIds: [] });
  });
});

describe("LinkedIn (MR-G1)", () => {
  const L1 = { id: "111", name: "Quests", currency: "INR", status: "ACTIVE" };
  const L2 = { id: "222", name: "CMPL", currency: "USD", status: "ACTIVE" };
  const L3 = { id: "333", name: "Third", currency: "USD", status: "DRAFT" };
  const f = adAccountFormat("linkedin_ads")!;

  it("words an id line, a platform and the health of each LinkedIn status", () => {
    expect(f.platformName).toBe("LinkedIn");
    expect(f.idLine({ id: "123456789", currency: "INR" })).toBe("Account ID 123456789 · INR");
    expect(f.idLine({ id: "urn:li:sponsoredAccount:123456789" })).toBe("Account ID 123456789");
    expect(f.health({ id: "1", status: "ACTIVE" })).toEqual({});
    expect(f.health({ id: "1", status: "DRAFT" })).toEqual({ warning: "draft" });
    expect(f.health({ id: "1", status: "PENDING_DELETION" })).toEqual({ warning: "being deleted" });
    expect(f.health({ id: "1", status: "CANCELED" })).toEqual({ blocked: "cancelled" });
    expect(f.health({ id: "1", status: "REMOVED" })).toEqual({ blocked: "removed" });
    expect(f.health({ id: "1" })).toEqual({});
  });

  it("compares ids by the bare number (the urn and the number are one account)", () => {
    expect(f.bareId("urn:li:sponsoredAccount:222")).toBe("222");
    expect(savedAdAccounts("linkedin_ads", { adAccounts: [L1, L2, L3], adAccountChoice: caps(["urn:li:sponsoredAccount:222", "333"], "222") })).toEqual({
      enabledIds: ["222", "333"],
      defaultId: "222",
    });
  });

  it("two or more listed and nothing stored: none, never the first; one listed is the default", () => {
    expect(savedAdAccounts("linkedin_ads", { adAccounts: [L1, L2] })).toEqual({ enabledIds: [] });
    expect(savedAdAccounts("linkedin_ads", { adAccounts: [L2] })).toEqual({ enabledIds: ["222"], defaultId: "222" });
  });

  it("LinkedIn's per-Page capabilities.adAccounts.byPage is not the business choice", () => {
    expect(savedAdAccounts("linkedin_ads", { adAccounts: [L1, L2], capabilities: { adAccounts: { byPage: { p1: "111" } } } })).toEqual({ enabledIds: [] });
  });

  it("a save refreshes LinkedIn's own account-scoped queries, dropping them rather than refetching in place", async () => {
    const { QueryClient } = await import("@tanstack/react-query");
    const client = new QueryClient();
    client.setQueryData(["linkedin-managed-campaigns"], { campaigns: [] });
    client.setQueryData(["linkedin-page-ad-account"], {});
    client.setQueryData(["meta-ads-accounts"], {});
    await f.refresh(client);
    expect(client.getQueryData(["linkedin-managed-campaigns"])).toBeUndefined();
    expect(client.getQueryData(["linkedin-page-ad-account"])).toBeUndefined();
    expect(client.getQueryData(["meta-ads-accounts"])).toEqual({});
  });
});
