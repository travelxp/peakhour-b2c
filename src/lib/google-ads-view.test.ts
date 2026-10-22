import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import { formatMoneyOrNumber } from "@/lib/outcome-value";
import {
  GOOGLE_LAUNCH_USE_CASE,
  GOOGLE_MERCHANT_FACING_CODES,
  GOOGLE_RSA,
  formatGoogleMoney,
  googleCreateMayExist,
  googleCreateProblem,
  localIsoDay,
  googleEndDateProblem,
  googleAdsErrorMessage,
  googleAdsNeedsReconnect,
  googleCopyProblem,
  googleCreateNote,
  googleLaunchChargeSentence,
  googleStatusAction,
  googleStatusLabel,
  googleTextWidth,
  linesOf,
} from "./google-ads-view";

/** G-15 — every sentence and decision the Google panel shows. */

const apiError = (code: string, message = `msg for ${code}`, requestId?: string) => {
  const e = new ApiError(code, message, 409);
  if (requestId) (e as { requestId?: string }).requestId = requestId;
  return e;
};

describe("the launch charge", () => {
  it("★names mig 470's seed", () => expect(GOOGLE_LAUNCH_USE_CASE).toBe("google.campaign_launched"));
  it("★says the rate card's price, once, on the first start", () => {
    const s = googleLaunchChargeSentence({ free: false, creditMultiplier: 30 });
    expect(s).toContain("30 Peaks, once, the first time it goes live");
    expect(s).toContain("Pausing and resuming it costs nothing");
  });
  it("PASS: an unloaded card guesses no number; a free row says free", () => {
    expect(googleLaunchChargeSentence(undefined)).not.toMatch(/\d/);
    expect(googleLaunchChargeSentence({ free: true, creditMultiplier: 30 })).toContain("free");
  });
});

describe("errors", () => {
  it("★a merchant-facing code shows the api's message", () => {
    for (const code of ["CURRENCY_MISMATCH", "DECLARATION_REQUIRED", "ASSET_NOT_APPROVED", "CAMPAIGN_FINISHED", "CREATE_UNCONFIRMED", "ADS_HALTED", "VALIDATION_ERROR", "ROW_INSERT_FAILED", "AD_ACCOUNT_FORBIDDEN"]) {
      expect(GOOGLE_MERCHANT_FACING_CODES.has(code), code).toBe(true);
      expect(googleAdsErrorMessage(apiError(code), "fallback")).toBe(`msg for ${code}`);
    }
  });
  it("★★PASS: any other code shows the fallback, with the reference, never the raw message", () => {
    expect(googleAdsErrorMessage(apiError("INTERNAL", "stack trace", "req-1"), "Try again.")).toBe("Try again. (reference req-1)");
    expect(googleAdsErrorMessage(new Error("x"), "Try again.")).toBe("Try again.");
  });
  it("★PASS: the api's zod refusal ('Invalid body') is not shown verbatim (review round 2)", () => {
    expect(googleAdsErrorMessage(apiError("VALIDATION_ERROR", "Invalid body", "req-2"), "Check the form.")).toBe("Check the form. (reference req-2)");
    expect(googleAdsErrorMessage(apiError("VALIDATION_ERROR", "The campaign's end date is in the past"), "x")).toBe("The campaign's end date is in the past");
  });
  it("reconnect is asked for a dead connection only", () => {
    expect(googleAdsNeedsReconnect(apiError("NEEDS_REAUTH"))).toBe(true);
    expect(googleAdsNeedsReconnect(apiError("NOT_CONNECTED"))).toBe(true);
    expect(googleAdsNeedsReconnect(apiError("RATE_LIMITED"))).toBe(false);
  });
});

describe("★★only a create that may EXIST on Google closes the form — the api's own marker (review round 2)", () => {
  const withDetails = (code: string, details: unknown) => new ApiError(code, "m", 502, undefined, details);
  it("★CREATE_UNCONFIRMED carries the row's id: it may exist, the form closes", () => {
    expect(googleCreateMayExist(withDetails("CREATE_UNCONFIRMED", { managedCampaignId: "6731f0aa" }))).toBe(true);
  });
  it.each(["CREATE_FAILED", "CAMPAIGN_REFUSED", "PLATFORM_FAILED", "ASSET_NOT_APPROVED", "CHANNEL_DENIED", "VALIDATION_ERROR"])(
    "PASS: %s without the marker keeps the form — nothing exists on Google, fix and retry",
    (code) => expect(googleCreateMayExist(withDetails(code, undefined))).toBe(false),
  );
  it("PASS: an empty or non-string id is not the marker; a network failure is not either", () => {
    expect(googleCreateMayExist(withDetails("CREATE_UNCONFIRMED", { managedCampaignId: "" }))).toBe(false);
    expect(googleCreateMayExist(withDetails("CREATE_UNCONFIRMED", { managedCampaignId: 7 }))).toBe(false);
    expect(googleCreateMayExist(new Error("x"))).toBe(false);
  });
});

describe("★the create form's whole decision (review round 2)", () => {
  const ad = { headlines: ["Linen shirts", "Free returns", "Made in Porto"], descriptions: ["Breathable linen.", "Next-day dispatch."], finalUrl: "https://linen.example" };
  const ok = { name: "Autumn", budget: "25", currency: "USD", endDate: "", searchAd: ad };
  const T = "2026-10-23";
  it("PASS: a complete form has no problem", () => expect(googleCreateProblem(ok, T)).toBeNull());
  it.each([
    ["no name", { ...ok, name: "  " }, "Name the campaign"],
    ["a zero budget", { ...ok, budget: "0" }, "above zero"],
    ["★an INFINITE budget (1e309 is sent as null)", { ...ok, budget: "1e309" }, "above zero"],
    ["a non-number budget", { ...ok, budget: "abc" }, "above zero"],
    ["no currency", { ...ok, currency: "" }, "three-letter currency"],
    ["a past end date", { ...ok, endDate: "2026-10-22" }, "in the past"],
    ["bad copy", { ...ok, searchAd: { ...ad, headlines: ["a"] } }, "3 to 15 headlines"],
  ])("refuses %s", (_l, form, text) => expect(googleCreateProblem(form, T)).toContain(text));
});

describe("★today is the BROWSER's day (review round 2)", () => {
  it("is built from local date parts, not the UTC string", () => {
    const d = new Date(2026, 9, 24, 3, 0, 0);
    expect(localIsoDay(d)).toBe("2026-10-24");
  });
});

describe("the end date (review round 1)", () => {
  it("★a past end date is said before sending; today and later are fine; none is fine", () => {
    expect(googleEndDateProblem("2026-10-22", "2026-10-23")).toContain("in the past");
    expect(googleEndDateProblem("2026-10-23", "2026-10-23")).toBeNull();
    expect(googleEndDateProblem("", "2026-10-23")).toBeNull();
  });
});

describe("a campaign's state, in words", () => {
  it("★draft is 'paused, not started' — Google has no draft", () => {
    expect(googleStatusLabel({ status: "draft" })).toBe("Paused — not started yet");
    expect(googleStatusLabel({ status: "completed" })).toBe("Finished");
  });
  it.each([
    [{ status: "archived", refusedCode: "ASSET_NOT_APPROVED" }, "refused before anything was sent (ASSET_NOT_APPROVED)"],
    [{ status: "draft", createState: "outcome_unknown" as const }, "don't create it again"],
    [{ status: "draft", createState: "sending" as const }, "don't create it again"],
    [{ status: "archived", createState: "not_created" as const }, "no record of this campaign"],
  ])("★%o → %s", (c, text) => {
    expect(googleCreateNote(c)).toContain(text);
  });
  it("PASS: a campaign Google has says nothing extra", () => {
    expect(googleCreateNote({ status: "draft", platformCampaignId: "222", createState: "created" })).toBeNull();
  });
});

describe("★★the one action a row offers", () => {
  const NOW = new Date("2026-10-23T09:00:00Z");
  it("★a confirmed draft is Started; a paused one Resumed; an active one Paused", () => {
    expect(googleStatusAction({ status: "draft", platformCampaignId: "1" }, NOW)).toEqual({ status: "ACTIVE", label: "Start" });
    expect(googleStatusAction({ status: "paused", platformCampaignId: "1" }, NOW)).toEqual({ status: "ACTIVE", label: "Resume" });
    expect(googleStatusAction({ status: "active", platformCampaignId: "1" }, NOW)).toEqual({ status: "PAUSED", label: "Pause" });
  });
  it("★nothing to start before Google confirms it, after it finished, or past its end date", () => {
    expect(googleStatusAction({ status: "draft" }, NOW)).toEqual({ status: null, reason: "Waiting for Google Ads" });
    expect(googleStatusAction({ status: "completed", platformCampaignId: "1" }, NOW)).toEqual({ status: null, reason: "Finished" });
    expect(googleStatusAction({ status: "archived", platformCampaignId: "1" }, NOW)).toEqual({ status: null, reason: "Finished" });
    expect(googleStatusAction({ status: "paused", platformCampaignId: "1", schedule: { endsAt: "2026-10-22T00:00:00Z" } }, NOW)).toEqual({
      status: null,
      reason: "Its end date has passed",
    });
  });
  it("★★a status it does not name offers NOTHING — never a charged start by default (review round 2)", () => {
    expect(googleStatusAction({ status: "review", platformCampaignId: "1" }, NOW)).toEqual({ status: null, reason: "In review" });
    expect(googleStatusAction({ status: "something_new", platformCampaignId: "1" }, NOW).status).toBeNull();
  });
  it("PASS: an end date ahead still starts; an active campaign past its end can still be paused", () => {
    expect(googleStatusAction({ status: "draft", platformCampaignId: "1", schedule: { endsAt: "2026-11-01T00:00:00Z" } }, NOW).status).toBe("ACTIVE");
    expect(googleStatusAction({ status: "active", platformCampaignId: "1", schedule: { endsAt: "2026-10-22T00:00:00Z" } }, NOW).status).toBe("PAUSED");
  });
});

describe("money", () => {
  it("★the shared formatter (review round 1), and an absent figure is a dash", () => {
    expect(formatGoogleMoney(25, "USD")).toBe(formatMoneyOrNumber(25, "USD"));
    expect(formatGoogleMoney(25, undefined)).toBe(formatMoneyOrNumber(25, undefined));
    expect(formatGoogleMoney(undefined, "USD")).toBe("—");
  });
});

describe("★★the ad's copy — the api's own rule, before sending", () => {
  const ok = { headlines: ["Linen shirts", "Free returns", "Made in Porto"], descriptions: ["Breathable linen.", "Next-day dispatch."], finalUrl: "https://linen.example/autumn" };
  it("PASS: a valid ad has no problem", () => expect(googleCopyProblem(ok)).toBeNull());
  it("mirrors the api's bounds", () => expect(GOOGLE_RSA).toEqual({ headlines: { min: 3, max: 15, chars: 30 }, descriptions: { min: 2, max: 4, chars: 90 } }));
  it.each([
    ["two headlines", { ...ok, headlines: ["a", "b"] }, "3 to 15 headlines, not 2"],
    ["sixteen headlines", { ...ok, headlines: Array.from({ length: 16 }, (_, i) => `h${i}`) }, "not 16"],
    ["one description", { ...ok, descriptions: ["d"] }, "2 to 4 descriptions"],
    ["a 31-character headline", { ...ok, headlines: ["x".repeat(31), "b", "c"] }, "at most 30"],
    ["a 91-character description", { ...ok, descriptions: ["y".repeat(91), "d"] }, "at most 90"],
    ["an http landing page", { ...ok, finalUrl: "http://linen.example" }, "https://"],
    ["no landing page", { ...ok, finalUrl: "" }, "https://"],
  ])("★refuses %s", (_l, ad, text) => {
    expect(googleCopyProblem(ad)).toContain(text);
  });
  it("★counts double-width characters as two, as Google does", () => {
    expect(googleTextWidth("夏の麻")).toBe(6);
    expect(googleCopyProblem({ ...ok, headlines: ["夏の麻シャツ夏の麻シャツ夏の麻シャツ", "b", "c"] })).toContain("is 36");
    expect(googleCopyProblem({ ...ok, headlines: ["x".repeat(30), "b", "c"] })).toBeNull();
  });
  it("lines are trimmed and blanks dropped", () => {
    expect(linesOf(" a \n\n b\r\nc ")).toEqual(["a", "b", "c"]);
  });
});
