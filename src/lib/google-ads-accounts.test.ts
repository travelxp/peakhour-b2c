/**
 * MR-G2 - Google Ads on the business's own ad accounts, as the dashboard reads them: the ad-account format row, the saved
 * choice, and the Ads panel / signal step limited to the enabled accounts, the default first.
 */
import { describe, it, expect } from "vitest";
import { adAccountFormat, savedAdAccounts } from "./ad-account-choice";
import { enabledGoogleAccounts, googleBareId, googleDashedId, googleIdLine, googleSelectedAccountId } from "./google-ads-accounts";

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

  it("an enabled account the connection can no longer use is listed as not available, so it can be unticked", () => {
    const extra = { adAccounts: [A], blockedAdAccounts: [{ id: "2222222222", code: "customer_status_CANCELED" }, { id: "5555555555", code: "x" }], adAccountChoice: { enabledIds: ["1111111111", "2222222222"], defaultId: "1111111111" } };
    const listed = f.list(extra);
    expect(listed.map((a) => a.id)).toEqual(["1111111111", "2222222222"]);
    expect(f.health(listed[1]!)).toEqual({ blocked: "not available" });
    // a blocked account that was never enabled is not shown
    expect(listed.some((a) => a.id === "5555555555")).toBe(false);
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
  const data = { adAccounts: [A, B, C], enabledIds: ["1111111111", "2222222222"], defaultId: "2222222222" };

  it("an account of the login the business did not enable is not offered", () => {
    expect(enabledGoogleAccounts(data).map((a) => a.id)).toEqual(["2222222222", "1111111111"]);
  });
  it("nothing enabled, an older api answer with no enabledIds, or no answer: nothing is offered", () => {
    expect(enabledGoogleAccounts({ adAccounts: [A, B], enabledIds: [] })).toEqual([]);
    expect(enabledGoogleAccounts({ adAccounts: [A, B] })).toEqual([]);
    expect(enabledGoogleAccounts(undefined)).toEqual([]);
  });
  it("no default keeps the listed order", () => {
    expect(enabledGoogleAccounts({ adAccounts: [A, B], enabledIds: ["1111111111", "2222222222"], defaultId: null }).map((a) => a.id)).toEqual(["1111111111", "2222222222"]);
  });

  describe("?customer= (googleSelectedAccountId)", () => {
    const list = enabledGoogleAccounts(data);
    it("an enabled id is kept, in either spelling", () => {
      expect(googleSelectedAccountId(list, "1111111111")).toBe("1111111111");
      expect(googleSelectedAccountId(list, "111-111-1111")).toBe("1111111111");
    });
    it("an id that is not enabled, or none, falls back to the default", () => {
      expect(googleSelectedAccountId(list, "3333333333")).toBe("2222222222");
      expect(googleSelectedAccountId(list, null)).toBe("2222222222");
    });
    it("nothing enabled: no account", () => {
      expect(googleSelectedAccountId([], "1111111111")).toBeNull();
    });
  });
});
