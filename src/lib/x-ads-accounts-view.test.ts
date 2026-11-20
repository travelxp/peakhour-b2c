import { describe, it, expect } from "vitest";
import { AD_ACCOUNT_FORMATS, adAccountFormat, savedAdAccounts } from "./ad-account-choice";
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

describe("xAdsAccountChoice: the Ads page shows only the accounts this business enabled", () => {
  const live = [acct("a1", "One"), acct("a2", "Two"), acct("a3", "Other business")];

  it("limits the live list to the enabled ids and preselects the DEFAULT, not the first listed", () => {
    const extra = { adAccountChoice: { enabledIds: ["a2", "a1"], defaultId: "a2" } };
    const c = xAdsAccountChoice(live, extra, null);
    expect(c.enabled.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(c.defaultId).toBe("a2");
    expect(c.selectedId).toBe("a2");
  });

  it("honours ?account= only for an ENABLED id: a pasted link to another business's account falls back to the default", () => {
    const extra = { adAccountChoice: { enabledIds: ["a1", "a2"], defaultId: "a1" } };
    expect(xAdsAccountChoice(live, extra, "a2").selectedId).toBe("a2");
    expect(xAdsAccountChoice(live, extra, "a3").selectedId).toBe("a1");
    expect(xAdsAccountChoice(live, extra, "nope").selectedId).toBe("a1");
  });

  it("nothing saved and several listed enables nothing: the merchant must choose", () => {
    const c = xAdsAccountChoice(live, {}, "a1");
    expect(c.enabled).toEqual([]);
    expect(c.selectedId).toBeNull();
  });

  it("nothing ever saved and ONE listed account is that account (one is not a choice)", () => {
    const c = xAdsAccountChoice([acct("only")], {}, null);
    expect(c.enabled.map((a) => a.id)).toEqual(["only"]);
    expect(c.selectedId).toBe("only");
  });

  it("a saved choice is never widened: an account the login lost leaves the rest, and a stale default is no default", () => {
    const extra = { adAccountChoice: { enabledIds: ["a1", "gone"], defaultId: "gone" } };
    const c = xAdsAccountChoice(live, extra, null);
    expect(c.enabled.map((a) => a.id)).toEqual(["a1"]);
    // One enabled account is the default even when the stored default went stale (the api's rule).
    expect(c.selectedId).toBe("a1");
  });

  it("reads the same saved ids as the checklist does (savedAdAccounts), fed the live list", () => {
    const extra = { adAccountChoice: { enabledIds: ["a1", "a2"], defaultId: "a2" } };
    expect(savedAdAccounts("x_ads", { ...extra, adAccounts: live })).toEqual({ enabledIds: ["a1", "a2"], defaultId: "a2" });
  });
});
