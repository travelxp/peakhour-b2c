import { describe, it, expect } from "vitest";
import type { GoogleCampaignSettings } from "@/lib/api/google-ads";
import {
  GOOGLE_REMOVE_WARNING,
  googleAdActions,
  googleAdGroupNameOf,
  googleAdGroupNameProblem,
  googleAdStatusLabel,
  googleAdSummary,
  googleNetworkSentence,
  googleRemoveConfirmed,
  googleSettingsChangeOf,
  googleSettingsDraftOf,
  googleSettingsOnlyLowers,
  googleSettingsProblem,
  googleSettingsSentence,
} from "./google-management-view";
import { googleStatusAction, googleStatusLabel } from "./google-ads-view";

/** G14c — a Google campaign's management: settings, the typed-name remove, the ad group name and the ads (RMF M.10, M.110, M.130, C.190). */

const S: GoogleCampaignSettings = {
  name: "Autumn linen",
  status: "PAUSED",
  channelType: "SEARCH",
  budget: { amount: 2500, currencyCode: "INR", shared: false },
  endDate: "2026-12-31",
  timeZone: "Asia/Kolkata",
  network: { googleSearch: true, searchPartners: false, displayNetwork: false },
};
const TODAY = "2026-10-30";

describe("the settings form", () => {
  it("starts from what Google holds", () => {
    expect(googleSettingsDraftOf(S)).toEqual({ name: "Autumn linen", budget: "2500", endDate: "2026-12-31", searchPartners: false, displayNetwork: false });
    expect(googleSettingsDraftOf({ ...S, endDate: null, network: undefined })).toMatchObject({ endDate: "", searchPartners: false, displayNetwork: false });
  });
  it("★sends only what changed, and nothing when nothing did", () => {
    const d = googleSettingsDraftOf(S);
    expect(googleSettingsChangeOf(S, d)).toBeNull();
    expect(googleSettingsChangeOf(S, { ...d, name: " Autumn linen " })).toBeNull();
    expect(googleSettingsChangeOf(S, { ...d, name: "Winter linen" })).toEqual({ name: "Winter linen" });
    expect(googleSettingsChangeOf(S, { ...d, budget: "1999.5" })).toEqual({ dailyBudget: { amount: 1999.5 } });
    expect(googleSettingsChangeOf(S, { ...d, endDate: "" })).toEqual({ endDate: null });
    expect(googleSettingsChangeOf(S, { ...d, endDate: "2027-01-15" })).toEqual({ endDate: "2027-01-15" });
    expect(googleSettingsChangeOf(S, { ...d, displayNetwork: true })).toEqual({ network: { searchPartners: false, displayNetwork: true } });
  });
  it("★networks are never sent for a campaign Google reports none for (Performance Max, YouTube video)", () => {
    const pmax = { ...S, channelType: "PERFORMANCE_MAX", network: undefined };
    expect(googleSettingsChangeOf(pmax, { ...googleSettingsDraftOf(pmax), searchPartners: true })).toBeNull();
  });
  it.each([
    [{ name: "  " }, /name/],
    [{ name: "a\nb" }, /one line/],
    [{ budget: "" }, /budget/],
    [{ budget: "0" }, /budget/],
    [{ budget: "abc" }, /budget/],
    [{ endDate: "2026-10-29" }, /past/],
  ])("%j stops the save", (over, msg) => {
    expect(googleSettingsProblem({ ...googleSettingsDraftOf(S), ...over }, TODAY)).toMatch(msg);
  });
  it("PASS: today and no end date are fine", () => {
    expect(googleSettingsProblem({ ...googleSettingsDraftOf(S), endDate: TODAY }, TODAY)).toBeNull();
    expect(googleSettingsProblem({ ...googleSettingsDraftOf(S), endDate: "" }, TODAY)).toBeNull();
  });
  it.each([
    [{ dailyBudget: { amount: 2000 } }, true],
    [{ dailyBudget: { amount: 3000 } }, false],
    [{ endDate: "2026-11-30" }, true],
    [{ endDate: "2027-02-01" }, false],
    [{ endDate: null }, false],
    [{ network: { searchPartners: true, displayNetwork: false } }, false],
    [{ name: "x" }, true],
  ])("%j only lowers spend: %s (the api's own kill-switch rule)", (change, lowers) => {
    expect(googleSettingsOnlyLowers(S, change)).toBe(lowers);
  });
  it("says the settings and the networks in words", () => {
    expect(googleSettingsSentence(S)).toMatch(/2,500.*\/day, ends 2026-12-31\./);
    expect(googleSettingsSentence({ ...S, endDate: null })).toMatch(/runs until you stop it/);
    expect(googleSettingsSentence({ ...S, budget: { ...S.budget, shared: true } })).toMatch(/shared with other campaigns/);
    expect(googleNetworkSentence({ googleSearch: true, searchPartners: true, displayNetwork: true })).toBe(
      "Shows on Google Search, search partner sites, the Google Display Network.",
    );
    expect(googleNetworkSentence(undefined)).toBeNull();
  });
});

describe("★★remove, behind the typed name", () => {
  it.each([
    ["Autumn linen", true],
    ["  Autumn linen ", true],
    ["autumn linen", false],
    ["Autumn", false],
    ["", false],
  ])("%j confirms it: %s", (typed, ok) => {
    expect(googleRemoveConfirmed("Autumn linen", typed)).toBe(ok);
  });
  it("the warning says it cannot be undone, and offers pause instead", () => {
    expect(GOOGLE_REMOVE_WARNING).toMatch(/can't be undone/);
    expect(GOOGLE_REMOVE_WARNING).toMatch(/pause it instead/);
  });
  it("★a removed campaign is said as Removed and offers nothing; an archived one never removed is not", () => {
    const removed = { status: "archived", platformCampaignId: "222", removedAt: "2026-10-30T09:00:00Z" };
    expect(googleStatusLabel(removed)).toBe("Removed");
    expect(googleStatusAction(removed)).toEqual({ status: null, reason: "Removed" });
    expect(googleStatusLabel({ status: "archived", platformCampaignId: "222" })).toBe("Not running");
    expect(googleStatusAction({ status: "archived", platformCampaignId: "222" })).toEqual({ status: null, reason: "Finished" });
  });
});

describe("the ad group's name at create", () => {
  it("empty sends nothing (the campaign's name is used); Performance Max never sends one", () => {
    expect(googleAdGroupNameOf("SEARCH", "  ")).toEqual({});
    expect(googleAdGroupNameOf("SEARCH", " Linen shirts ")).toEqual({ adGroupName: "Linen shirts" });
    expect(googleAdGroupNameOf("DEMAND_GEN", "Videos")).toEqual({ adGroupName: "Videos" });
    expect(googleAdGroupNameOf("PERFORMANCE_MAX", "x")).toEqual({});
  });
  it("past 255 bytes, or on two lines, it stops the create; 255 bytes do not", () => {
    expect(googleAdGroupNameProblem("a".repeat(255))).toBeNull();
    expect(googleAdGroupNameProblem("a".repeat(256))).toMatch(/too long/);
    expect(googleAdGroupNameProblem("é".repeat(128))).toMatch(/too long/);
    expect(googleAdGroupNameProblem("a\nb")).toMatch(/one line/);
    expect(googleAdGroupNameProblem("")).toBeNull();
  });
});

describe("ads (RMF M.130)", () => {
  it.each([
    ["ENABLED", true, ["PAUSED", "REMOVED"]],
    ["PAUSED", true, ["ENABLED", "REMOVED"]],
    ["REMOVED", true, []],
    ["UNKNOWN", true, []],
    ["ENABLED", false, []],
  ])("an ad %s (campaign open: %s) offers %j", (status, open, actions) => {
    expect(googleAdActions(status, open).map((a) => a.status)).toEqual(actions);
  });
  it("labels and summaries", () => {
    expect(googleAdStatusLabel("ENABLED")).toBe("Running");
    expect(googleAdStatusLabel("REMOVED")).toBe("Removed");
    expect(googleAdSummary({ headlines: ["A", "B", "C", "D"], type: "RESPONSIVE_SEARCH_AD" })).toBe("A | B | C");
    expect(googleAdSummary({ headlines: [], type: "DEMAND_GEN_VIDEO_RESPONSIVE_AD" })).toBe("Video ad");
  });
});
