/**
 * MR-G2 - Google Ads on the business's own ad accounts, as the dashboard reads them: the ad-account format row, the saved
 * choice, and the Ads panel / signal step limited to the enabled accounts, the default first.
 */
import { describe, it, expect } from "vitest";
import { adAccountFormat, bareIdFor, enabledAccounts, savedAdAccounts } from "./ad-account-choice";
import { googleBareId, googleDashedId, googleIdLine, googleSelectedAccountId, otherGoogleAccounts } from "./google-ads-accounts";

const A = { id: "1111111111", name: "India Store", currencyCode: "INR", testAccount: false };
const B = { id: "2222222222", name: "UK Store", currencyCode: "GBP", testAccount: false };
const C = { id: "3333333333", name: "Brand", currencyCode: "INR", testAccount: true };

describe("the google_ads format row", () => {
  const f = adAccountFormat("google_ads")!;

  it("words the platform and the id line as Google Ads shows it", () => {
    expect(f.platformName).toBe("Google Ads");
    expect(f.idLine({ id: "1234567890", currency: "INR" })).toBe("Account ID 123-456-7890 · INR");
    expect(f.idLine({ id: "customers/1234567890" })).toBe("Account ID 123-456-7890");
  });

  it("compares ids with or without dashes and customers/", () => {
    expect(f.bareId("123-456-7890")).toBe("1234567890");
    expect(f.bareId("customers/1234567890")).toBe("1234567890");
    expect(googleBareId("1234567890")).toBe("1234567890");
  });

  it("lists the connection's accounts with currencyCode read as currency; a test account is a warning, never a block", () => {
    const listed = f.list({ adAccounts: [A, C] });
    expect(listed.map((a) => [a.id, a.currency])).toEqual([["1111111111", "INR"], ["3333333333", "INR"]]);
    expect(f.health(listed[0]!)).toEqual({});
    expect(f.health(listed[1]!)).toEqual({ warning: "test account" });
  });

  it("S2: a test account is never auto-enabled (the api\'s autoEnable, mirrored): one listed test account enables nothing until ticked", () => {
    const T = { id: "4444444444", name: "Sandbox", currencyCode: "USD", testAccount: true };
    expect(savedAdAccounts("google_ads", { adAccounts: [T] })).toEqual({ enabledIds: [] });
    expect(savedAdAccounts("google_ads", { adAccounts: [A] })).toEqual({ enabledIds: ["1111111111"], defaultId: "1111111111" });
    expect(savedAdAccounts("google_ads", { adAccounts: [T], adAccountChoice: { enabledIds: ["4444444444"], defaultId: "4444444444" } })).toEqual({ enabledIds: ["4444444444"], defaultId: "4444444444" });
  });

  it("S6: a chosen account that vanished from the login (not listed, not blocked) is counted too", () => {
    const extra = { adAccounts: [A], adAccountChoice: { enabledIds: ["1111111111", "6666666666"], defaultId: "1111111111" } };
    expect(f.unavailable!(extra)).toBe(1);
  });

  it("mirrors the api: a blocked account is NOT listed, and a chosen one that is now blocked is counted, never ticked or default", () => {
    const extra = { adAccounts: [A], blockedAdAccounts: [{ id: "2222222222", code: "customer_status_CANCELED" }, { id: "5555555555", code: "x" }], adAccountChoice: { enabledIds: ["1111111111", "2222222222"], defaultId: "1111111111" } };
    expect(f.list(extra).map((a) => a.id)).toEqual(["1111111111"]);
    expect(savedAdAccounts("google_ads", extra)).toEqual({ enabledIds: ["1111111111"], defaultId: "1111111111" });
    expect(f.unavailable!(extra)).toBe(1);
    // an account that was never chosen is not counted, however it is listed
    expect(f.unavailable!({ ...extra, adAccountChoice: { enabledIds: ["1111111111"] } })).toBe(0);
    expect(f.unavailable!({ adAccounts: [A] })).toBe(0);
  });

  it("the saved choice: several listed and nothing stored is none; stored ids in either spelling; one listed is the default", () => {
    expect(savedAdAccounts("google_ads", { adAccounts: [A, B] })).toEqual({ enabledIds: [] });
    expect(savedAdAccounts("google_ads", { adAccounts: [A] })).toEqual({ enabledIds: ["1111111111"], defaultId: "1111111111" });
    expect(savedAdAccounts("google_ads", { adAccounts: [A, B, C], adAccountChoice: { enabledIds: ["222-222-2222", "3333333333"], defaultId: "222-222-2222" } })).toEqual({
      enabledIds: ["2222222222", "3333333333"],
      defaultId: "2222222222",
    });
  });
});

describe("googleDashedId / googleIdLine", () => {
  it("dashes a ten-digit id and leaves anything else alone", () => {
    expect(googleDashedId("1234567890")).toBe("123-456-7890");
    expect(googleDashedId("customers/1234567890")).toBe("123-456-7890");
    expect(googleDashedId("12")).toBe("12");
    expect(googleIdLine({ id: "1234567890", currencyCode: "USD" })).toBe("Account ID 123-456-7890 · USD");
  });
});

describe("the Ads panel and the signal step list only the enabled accounts, the default first", () => {
  const data = { accounts: [A, B, C], enabledIds: ["1111111111", "2222222222"], defaultId: "2222222222" };
  const bare = bareIdFor("google_ads");

  it("an account of the login the business did not enable is not offered; the default is first", () => {
    expect(enabledAccounts(data, bare).map((a) => a.id)).toEqual(["2222222222", "1111111111"]);
  });
  it("nothing enabled, an older api answer with no enabledIds, or no answer: nothing is offered", () => {
    expect(enabledAccounts({ accounts: [A, B], enabledIds: [] }, bare)).toEqual([]);
    expect(enabledAccounts({ accounts: [A, B] }, bare)).toEqual([]);
    expect(enabledAccounts(undefined, bare)).toEqual([]);
  });
  it("no default keeps the listed order; the same helper serves Meta (act_ in either spelling)", () => {
    expect(enabledAccounts({ accounts: [A, B], enabledIds: ["1111111111", "2222222222"], defaultId: null }, bare).map((a) => a.id)).toEqual(["1111111111", "2222222222"]);
    const meta = { accounts: [{ id: "act_1" }, { id: "act_2" }], enabledIds: ["2", "act_1"], defaultId: "act_2" };
    expect(enabledAccounts(meta, bareIdFor("facebook")).map((a) => a.id)).toEqual(["act_2", "act_1"]);
  });

  it("otherGoogleAccounts: the login's accounts that are not enabled", () => {
    expect(otherGoogleAccounts({ adAccounts: [A, B, C], enabledIds: ["111-111-1111"] }).map((a) => a.id)).toEqual(["2222222222", "3333333333"]);
    expect(otherGoogleAccounts(undefined)).toEqual([]);
  });

  describe("?customer= (googleSelectedAccountId)", () => {
    const enabled = enabledAccounts(data, bare);
    const others = otherGoogleAccounts({ adAccounts: data.accounts, enabledIds: data.enabledIds });
    it("an enabled id is kept, in either spelling", () => {
      expect(googleSelectedAccountId(enabled, others, "1111111111")).toBe("1111111111");
      expect(googleSelectedAccountId(enabled, others, "111-111-1111")).toBe("1111111111");
    });
    it("one of the login's other accounts is kept too (the pause-only view)", () => {
      expect(googleSelectedAccountId(enabled, others, "3333333333")).toBe("3333333333");
    });
    it("an unknown id, or none, falls back to the default", () => {
      expect(googleSelectedAccountId(enabled, others, "9999999999")).toBe("2222222222");
      expect(googleSelectedAccountId(enabled, others, null)).toBe("2222222222");
    });
    it("nothing enabled: the asked other account, else the first other (pause-only); with no account at all, none", () => {
      expect(googleSelectedAccountId([], others, "3333333333")).toBe("3333333333");
      expect(googleSelectedAccountId([], others, null)).toBe(others[0]!.id);
      expect(googleSelectedAccountId([], [], "1111111111")).toBeNull();
    });
  });
});
