import { describe, it, expect } from "vitest";
import { AD_ACCOUNT_FORMATS, adAccountFormat } from "./ad-account-choice";
import { xAdAccountHealth, xAdAccountIdLine } from "./x-ads-account";
import { xAdsAccountChoice } from "./x-ads-accounts-view";
import type { XAdAccount } from "./api/x-ads";

/**
 * MR-G3: X Ads on the business ad-account model. The api's `x_ads` registry row is the other half
 * (`adapters/ads/account-listing.ts`); these are the dashboard's: how an X account is worded, and which ones the Ads page shows.
 */

const acct = (id: string, name = id, approvalStatus = "ACCEPTED"): XAdAccount => ({ id, name, timezone: "UTC", approvalStatus });

describe("the x_ads format row", () => {
  it("is registered, named X, and compares ids as they are (X ids are case-sensitive)", () => {
    const format = adAccountFormat("x_ads")!;
    expect(format.platformName).toBe("X");
    expect(format.bareId("18ce54d4x5t")).toBe("18ce54d4x5t");
    expect(format.bareId("18ce54d4x5T")).not.toBe(format.bareId("18ce54d4x5t"));
    expect(Object.keys(AD_ACCOUNT_FORMATS)).toContain("x_ads");
  });

  it("the id line is the full number with NO currency (an X ad account has none)", () => {
    expect(xAdAccountIdLine({ id: "18ce54d4x5t" })).toBe("Account ID 18ce54d4x5t");
    expect(adAccountFormat("x_ads")!.idLine({ id: "18ce54d4x5t", currency: "USD" })).toBe("Account ID 18ce54d4x5t");
  });

  it("reads approvalStatus as health: accepted runs, review warns, rejected and suspended cannot run ads", () => {
    expect(xAdAccountHealth({ approvalStatus: "ACCEPTED" })).toEqual({});
    expect(xAdAccountHealth({})).toEqual({});
    expect(xAdAccountHealth({ approvalStatus: "UNDER_REVIEW" })).toEqual({ warning: "under review" });
    expect(xAdAccountHealth({ approvalStatus: "PENDING" })).toEqual({ warning: "under review" });
    expect(xAdAccountHealth({ approvalStatus: "REJECTED" })).toEqual({ blocked: "rejected" });
    expect(xAdAccountHealth({ approvalStatus: "SUSPENDED" })).toEqual({ blocked: "suspended" });
  });

  it("lists the accounts the connection stored, dropping rows without an id", () => {
    const list = adAccountFormat("x_ads")!.list({ adAccounts: [{ id: "a1" }, { name: "no id" }, { id: "" }] });
    expect(list.map((a) => a.id)).toEqual(["a1"]);
  });
});

describe("xAdsAccountChoice: enabled accounts first, every other listed account pause-only, the default from the api", () => {
  const live = [acct("a1", "One"), acct("a2", "Two"), acct("a3", "Other")];

  it("splits the login's accounts into enabled and others, and preselects the DEFAULT, not the first listed", () => {
    const c = xAdsAccountChoice(live, ["a2", "a1"], "a2", null);
    expect(c.enabled.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(c.others.map((a) => a.id)).toEqual(["a3"]);
    expect(c.preselectId).toBe("a2");
    expect(c.selectedId).toBe("a2");
    expect(c.selectedEnabled).toBe(true);
    expect(c.needsDefault).toBe(false);
  });

  it("Q1: ?account= opens ANY listed account; a not-enabled one is the pause-only view", () => {
    expect(xAdsAccountChoice(live, ["a1", "a2"], "a1", "a2")).toMatchObject({ selectedId: "a2", selectedEnabled: true });
    expect(xAdsAccountChoice(live, ["a1", "a2"], "a1", "a3")).toMatchObject({ selectedId: "a3", selectedEnabled: false });
    // an id the login does not list falls back to the default
    expect(xAdsAccountChoice(live, ["a1", "a2"], "a1", "nope").selectedId).toBe("a1");
  });

  it("Q2: with NOTHING enabled the accounts are still shown, pause-only, not hidden", () => {
    const c = xAdsAccountChoice(live, [], undefined, null);
    expect(c.enabled).toEqual([]);
    expect(c.others.map((a) => a.id)).toEqual(["a1", "a2", "a3"]);
    expect(c.selectedId).toBe("a1");
    expect(c.selectedEnabled).toBe(false);
    expect(c.preselectId).toBeNull();
  });

  it("Q3: two or more enabled and no default preselects the first ENABLED account (never saved) and asks for a default", () => {
    const c = xAdsAccountChoice(live, ["a2", "a3"], undefined, null);
    expect(c.preselectId).toBe("a2");
    expect(c.selectedId).toBe("a2");
    expect(c.selectedEnabled).toBe(true);
    expect(c.needsDefault).toBe(true);
    // a default that is not enabled is no default
    expect(xAdsAccountChoice(live, ["a2", "a3"], "a1", null).needsDefault).toBe(true);
  });

  it("one enabled account needs no default", () => {
    const c = xAdsAccountChoice(live, ["a3"], undefined, null);
    expect(c.selectedId).toBe("a3");
    expect(c.needsDefault).toBe(false);
  });

  it("an enabled id the login no longer lists is simply not shown", () => {
    const c = xAdsAccountChoice(live, ["a1", "gone"], "gone", null);
    expect(c.enabled.map((a) => a.id)).toEqual(["a1"]);
    expect(c.selectedId).toBe("a1");
  });
});
