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
    expect(adAccountFormat("linkedin_ads")).toBeUndefined();
  });
  it("a provider with no formatter has no choice (its format row owns where its accounts are listed)", () => {
    expect(savedAdAccounts("linkedin_ads", { adAccounts: [A, B], adAccountChoice: caps(["act_2222"], "act_2222") })).toEqual({ enabledIds: [] });
  });
});
