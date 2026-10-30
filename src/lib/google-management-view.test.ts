import { describe, it, expect } from "vitest";
import type { GoogleCampaignSettings } from "@/lib/api/google-ads";
import {
  GOOGLE_REMOVE_WARNING,
  googleAccountToday,
  googleAdActions,
  googleAdGroupNameOf,
  googleAdGroupNameProblem,
  googleAdStatusLabel,
  googleAdSummary,
  googleNetworkSentence,
  googleRemoveConfirmed,
  googleSettingsChangeOf,
  googleSettingsDraftOf,
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
    expect(googleSettingsProblem(S, { ...googleSettingsDraftOf(S), ...over }, TODAY)).toMatch(msg);
  });
  it("PASS: today and no end date are fine", () => {
    expect(googleSettingsProblem(S, { ...googleSettingsDraftOf(S), endDate: TODAY }, TODAY)).toBeNull();
    expect(googleSettingsProblem(S, { ...googleSettingsDraftOf(S), endDate: "" }, TODAY)).toBeNull();
  });
  it("★an end date Google holds that has passed does not block a rename or a lower budget (review round 1)", () => {
    const ended = { ...S, endDate: "2026-10-01" };
    expect(googleSettingsProblem(ended, { ...googleSettingsDraftOf(ended), name: "Renamed", budget: "100" }, TODAY)).toBeNull();
    // A NEW past date still does.
    expect(googleSettingsProblem(ended, { ...googleSettingsDraftOf(ended), endDate: "2026-10-02" }, TODAY)).toMatch(/past/);
  });
  it("★a new end date before a start still to come stops the save (review round 2)", () => {
    const later = { ...S, startDate: "2026-11-15", endDate: null };
    expect(googleSettingsProblem(later, { ...googleSettingsDraftOf(later), endDate: "2026-11-10" }, TODAY)).toMatch(/before the campaign's start, 2026-11-15/);
    expect(googleSettingsProblem(later, { ...googleSettingsDraftOf(later), endDate: "2026-11-15" }, TODAY)).toBeNull();
  });
  it("★a read with no endDate key is 'no end': a name-only save sends no endDate (review round 2)", () => {
    const { endDate: _e, ...noKey } = S;
    const s = noKey as unknown as typeof S;
    expect(googleSettingsChangeOf(s, { ...googleSettingsDraftOf(s), name: "Renamed" })).toEqual({ name: "Renamed" });
  });
  it("★today is the ACCOUNT's day: 2026-10-30 20:00 UTC is 31 October in Kolkata and 30 October in Los Angeles", () => {
    const at = new Date("2026-10-30T20:00:00Z");
    expect(googleAccountToday("Asia/Kolkata", at)).toBe("2026-10-31");
    expect(googleAccountToday("America/Los_Angeles", at)).toBe("2026-10-30");
    expect(googleAccountToday("Not/AZone", at)).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
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
