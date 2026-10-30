import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ApiError } from "@/lib/api";
import type { GoogleReportKey, GoogleReportRows } from "@/lib/api/google-ads";
import {
  GOOGLE_ADS_ALL_CONVERSIONS_LABEL,
  GOOGLE_ADS_CONVERSIONS_LABEL,
  GOOGLE_REPORT_COLUMNS,
  GOOGLE_REPORT_TABS,
  GOOGLE_REPORTS_MEASUREMENT_NOTE,
  formatGoogleConversions,
  formatGoogleCount,
  formatGoogleMicros,
  googleAccountHasNotServed,
  googleBiddingTypeLabel,
  googleMatchTypeLabel,
  googleReportChannelLabel,
  googleReportEmptySentence,
  googleReportLatestDay,
  googleReportErrorMessage,
  googleReportRangeProblem,
  googleReportRangeSentence,
  googleReportTruncatedNote,
  googleSearchTermStatusLabel,
  humanizeGoogleEnum,
} from "./google-reports-view";

/**
 * ★★G-14d — the reports view's columns and words. The RMF report list is
 * peakhour-mongodb `docs/idea/google-ads-rmf-gap-assessment.md` §1.4; each
 * table's required columns are pinned by the api field they show, so a
 * column dropped from the screen fails here.
 */

const KEYS: GoogleReportKey[] = ["account", "campaigns", "ads", "keywords", "search-terms", "bidding-strategies"];
const keysOf = (k: GoogleReportKey) => GOOGLE_REPORT_COLUMNS[k].map((c) => c.key);
const requiredOf = (k: GoogleReportKey) => GOOGLE_REPORT_COLUMNS[k].filter((c) => c.rmfRequired).map((c) => c.key);

describe("★★six tables, one per RMF report, in the reviewer's order", () => {
  it("the tabs", () => {
    expect(GOOGLE_REPORT_TABS.map((t) => [t.key, t.rmf])).toEqual([
      ["account", "R.10"],
      ["campaigns", "R.20"],
      ["ads", "R.40"],
      ["keywords", "R.50"],
      ["search-terms", "R.70"],
      ["bidding-strategies", "R.130"],
    ]);
  });
});

describe("★★every RMF-required column is a column, shown by default", () => {
  // The api row field each RMF column lands in (peakhour-api `services/ads/google-reports.ts`).
  it.each([
    ["account", ["clicks", "costMicros", "impressions", "conversions", "allConversions"]],
    ["campaigns", ["clicks", "costMicros", "impressions", "conversions", "allConversions", "status"]],
    ["ads", ["clicks", "costMicros", "impressions", "conversions", "status"]],
    ["keywords", ["clicks", "costMicros", "impressions", "conversions", "firstPageCpcMicros", "firstPositionCpcMicros", "status"]],
    ["search-terms", ["searchTerm", "matchType", "clicks", "costMicros", "impressions"]],
    ["bidding-strategies", ["type", "clicks", "costMicros", "costPerConversionMicros", "impressions", "averageCpcMicros", "conversions", "status"]],
  ] as const)("%s", (report, rmf) => {
    expect([...requiredOf(report)].sort()).toEqual([...rmf].sort());
    for (const k of rmf) expect(keysOf(report)).toContain(k);
  });
  it("★a table waits on `isPending`, so a query paused offline is not shown as an empty report", () => {
    const section = readFileSync(fileURLToPath(new URL("../app/(site)/dashboard/ads/_components/google-reports-section.tsx", import.meta.url)), "utf8");
    expect(section).toContain("if (query.isPending) {");
    expect(section).not.toMatch(/query\.isLoading/);
  });
  it("★a refocus reads nothing new (each read is a Google Ads operation); a stale remount does", () => {
    const section = readFileSync(fileURLToPath(new URL("../app/(site)/dashboard/ads/_components/google-reports-section.tsx", import.meta.url)), "utf8");
    expect(section).toContain("refetchOnWindowFocus: false,");
    // ★A remount past the stale time DOES re-read (round 2): figures older than five minutes are not shown.
    expect(section).not.toContain("refetchOnMount");
  });
  it("★there is no hidden-column state: every column is rendered (the section maps the whole list)", () => {
    const section = readFileSync(fileURLToPath(new URL("../app/(site)/dashboard/ads/_components/google-reports-section.tsx", import.meta.url)), "utf8");
    expect(section).toContain("const columns = GOOGLE_REPORT_COLUMNS[report]");
    expect(section).not.toMatch(/columns\.filter\(/);
  });
});

describe("★★Google's conversions are labelled Google's, and never share a column with ours (§6.4)", () => {
  it("every conversion column says Google Ads", () => {
    for (const k of KEYS) {
      for (const c of GOOGLE_REPORT_COLUMNS[k]) {
        if (/conversion/i.test(c.key) || /conversion/i.test(c.header)) expect(c.header, `${k}.${c.key}`).toMatch(/Google Ads/);
      }
    }
    expect(GOOGLE_ADS_CONVERSIONS_LABEL).toBe("Google Ads conversions");
    expect(GOOGLE_ADS_ALL_CONVERSIONS_LABEL).toBe("Google Ads all conversions");
  });
  it("★no column header or field is one of Peakhour's outcomes", () => {
    for (const k of KEYS) {
      for (const c of GOOGLE_REPORT_COLUMNS[k]) {
        expect(`${c.key} ${c.header}`, `${k}.${c.key}`).not.toMatch(/outcome|verified|credited|peak|attributed/i);
      }
    }
  });
  it("and the check SAYS SO when there is something to find", () => {
    expect("creditedOutcomes Credited outcomes").toMatch(/outcome|verified|credited|peak|attributed/i);
  });
  it("the note says whose numbers they are, and where ours are", () => {
    expect(GOOGLE_REPORTS_MEASUREMENT_NOTE).toMatch(/Google Ads conversions, counted by Google/);
    expect(GOOGLE_REPORTS_MEASUREMENT_NOTE).toMatch(/never added to these columns/);
  });
});

describe("cells", () => {
  const row = <K extends GoogleReportKey>(_k: K, r: GoogleReportRows[K]) => r;
  const cell = <K extends GoogleReportKey>(k: K, key: string, r: GoogleReportRows[K], cur = "USD") =>
    GOOGLE_REPORT_COLUMNS[k].find((c) => c.key === key)!.cell(r as never, cur);
  it("money is micros of the account's currency", () => {
    expect(formatGoogleMicros(3_450_000, "USD")).toMatch(/3\.45/);
    expect(cell("account", "costMicros", row("account", { clicks: 1, impressions: 2, costMicros: 12_340_000, conversions: 0, allConversions: 0 }))).toMatch(/12\.34/);
  });
  it("★an absent bid estimate is a dash, never $0.00", () => {
    const r = row("keywords", { clicks: 0, impressions: 0, costMicros: 0, conversions: 0 });
    expect(cell("keywords", "firstPageCpcMicros", r)).toBe("—");
    expect(cell("keywords", "firstPositionCpcMicros", r)).toBe("—");
    expect(cell("keywords", "firstPageCpcMicros", { ...r, firstPageCpcMicros: 450_000 })).toMatch(/0\.45/);
  });
  it("★no conversions (or a retraction below zero) is no cost per conversion, and no clicks is no average CPC: a dash, never $0.00", () => {
    const r = row("bidding-strategies", { clicks: 0, impressions: 10, costMicros: 50_000_000, conversions: 0, costPerConversionMicros: 0, averageCpcMicros: 0 });
    expect(cell("bidding-strategies", "costPerConversionMicros", r)).toBe("—");
    expect(cell("bidding-strategies", "averageCpcMicros", r)).toBe("—");
    expect(cell("bidding-strategies", "costPerConversionMicros", { ...r, conversions: -1, costPerConversionMicros: -50_000_000 })).toBe("—");
    const served = { ...r, clicks: 10, conversions: 2, costPerConversionMicros: 25_000_000, averageCpcMicros: 5_000_000 };
    expect(cell("bidding-strategies", "costPerConversionMicros", served)).toMatch(/25\.00/);
    expect(cell("bidding-strategies", "averageCpcMicros", served)).toMatch(/5\.00/);
  });
  it("★an ad with an id and no type reads \"Ad #123\", never \"— #123\"", () => {
    const base = { clicks: 0, impressions: 0, costMicros: 0, conversions: 0 };
    expect(cell("ads", "ad", row("ads", { ...base, adId: "123" }))).toBe("Ad #123");
    expect(cell("ads", "ad", row("ads", { ...base, adId: "123", adType: "RESPONSIVE_SEARCH_AD" }))).toBe("Responsive search ad #123");
    expect(cell("ads", "ad", row("ads", base))).toBe("—");
  });
  it("counts are whole; Google's conversions keep two decimals (data-driven attribution is fractional)", () => {
    expect(formatGoogleCount(12345)).toBe("12,345");
    expect(formatGoogleConversions(2.5)).toBe("2.5");
    expect(formatGoogleConversions(1 / 3)).toBe("0.33");
    expect(formatGoogleCount(undefined)).toBe("—");
  });
  it("statuses, REMOVED included, in words", () => {
    expect(cell("campaigns", "status", row("campaigns", { status: "REMOVED", clicks: 0, impressions: 0, costMicros: 0, conversions: 0, allConversions: 0 }))).toBe("Removed");
    expect(humanizeGoogleEnum("ENABLED")).toBe("Enabled");
    expect(humanizeGoogleEnum(undefined)).toBe("—");
  });
  it("bidding types by Google's UI name; an unknown one still said", () => {
    expect(googleBiddingTypeLabel("TARGET_SPEND")).toBe("Maximize clicks");
    expect(googleBiddingTypeLabel("TARGET_ROAS")).toBe("Target ROAS");
    expect(googleBiddingTypeLabel("FIXED_SHARE_OF_VOICE")).toBe("Fixed share of voice");
    // A prototype key is not a type (an `in` lookup would answer "function Object()…").
    expect(googleBiddingTypeLabel("constructor")).toBe("Constructor");
  });
  it("match types, Google's close variants said plainly", () => {
    expect(googleMatchTypeLabel("NEAR_PHRASE")).toBe("Phrase (close variant)");
    expect(googleMatchTypeLabel("NEAR_EXACT")).toBe("Exact (close variant)");
    expect(googleMatchTypeLabel("BROAD")).toBe("Broad");
    expect(googleSearchTermStatusLabel("ADDED")).toBe("Added as a keyword");
  });
  it("★a campaign type: PeakHour's three by their own labels, any other as Google names it (not called Search)", () => {
    expect(googleReportChannelLabel("DEMAND_GEN")).toBe("YouTube video (Demand Gen)");
    expect(googleReportChannelLabel("PERFORMANCE_MAX")).toBe("Performance Max");
    expect(googleReportChannelLabel("SEARCH")).toBe("Search");
    expect(googleReportChannelLabel("LOCAL_SERVICES")).toBe("Local services");
    expect(googleReportChannelLabel(undefined)).toBe("—");
  });
});

describe("★★empty, and not served", () => {
  it.each(KEYS)("%s has its own empty sentence, never an error's", (k) => {
    const s = googleReportEmptySentence(k);
    expect(s.length).toBeGreaterThan(30);
    expect(s).not.toMatch(/couldn't|error|failed/i);
  });
  it("the account's and the search terms' empty sentences say a test account never serves", () => {
    expect(googleReportEmptySentence("account")).toMatch(/test account never serves/);
    expect(googleReportEmptySentence("search-terms")).toMatch(/test account never serves/);
  });
  it("★an unsegmented table lists idle entities too, so its empty sentence claims none exist, not that none served", () => {
    for (const k of ["campaigns", "ads", "keywords", "bidding-strategies"] as const) {
      expect(googleReportEmptySentence(k), k).not.toMatch(/activity|served|in these dates/);
    }
  });
  it("★an account row of zeros has not served; one impression has", () => {
    const zero = { clicks: 0, impressions: 0, costMicros: 0 };
    expect(googleAccountHasNotServed([zero])).toBe(true);
    expect(googleAccountHasNotServed([{ ...zero, impressions: 1 }])).toBe(false);
    expect(googleAccountHasNotServed([{ ...zero, costMicros: 10 }])).toBe(false);
  });
});

describe("★the truncation note (review round 1)", () => {
  it("counts the rows shown, and promises no paging", () => {
    expect(googleReportTruncatedNote(1000)).toBe("Showing the 1,000 costliest rows. There are more: Google Ads has the full list.");
    expect(googleReportTruncatedNote(1000)).not.toMatch(/narrow/i);
  });
});

describe("★★the date range", () => {
  it.each([
    ["", "2026-10-01", /start and an end/],
    ["2026-10-01", "", /start and an end/],
    ["2026-10-10", "2026-10-01", /after the end/],
    ["2026-10-01", "2026-10-31", /future/],
  ])("refuses %s → %s", (from, to, msg) => {
    expect(googleReportRangeProblem(from, to, "2026-10-30")).toMatch(msg);
  });
  it("★the last day allowed is UTC's tomorrow, the api's own bound — whatever the browser's zone", () => {
    // 02:00 in IST on the 30th is 20:30 UTC on the 29th: the api allows up to the 30th, so must the form.
    expect(googleReportLatestDay(new Date("2026-10-29T20:30:00Z"))).toBe("2026-10-30");
    expect(googleReportLatestDay(new Date("2026-12-31T09:00:00Z"))).toBe("2027-01-01");
    expect(googleReportRangeProblem("2026-10-01", "2026-10-31", googleReportLatestDay(new Date("2026-10-29T20:30:00Z")))).toMatch(/future/);
    expect(googleReportRangeProblem("2026-10-01", "2026-10-30", googleReportLatestDay(new Date("2026-10-29T20:30:00Z")))).toBeNull();
  });
  it("PASS: a range ending today, and a single day", () => {
    expect(googleReportRangeProblem("2026-10-01", "2026-10-30", "2026-10-30")).toBeNull();
    expect(googleReportRangeProblem("2026-10-05", "2026-10-05", "2026-10-30")).toBeNull();
  });
  it("★the default is last 30 days: the section starts with no range applied and asks the api for none", () => {
    const section = readFileSync(fileURLToPath(new URL("../app/(site)/dashboard/ads/_components/google-reports-section.tsx", import.meta.url)), "utf8");
    expect(section).toMatch(/useState<AppliedRange>\(null\)/);
    expect(section).toMatch(/useState<"last30" \| "custom">\("last30"\)/);
  });
});

describe("★which days a table covers (review round 1)", () => {
  it("is said from the api's range, the default included", () => {
    expect(googleReportRangeSentence({ preset: "LAST_30_DAYS" })).toBe("Showing the last 30 days, not including today.");
    expect(googleReportRangeSentence({ from: "2026-09-01", to: "2026-09-30" })).toBe("Showing 2026-09-01 to 2026-09-30.");
    expect(googleReportRangeSentence({ from: "2026-09-05", to: "2026-09-05" })).toBe("Showing 2026-09-05.");
  });
  it("★the section says it from the answer (data.range), and going back to the default clears the typed days", () => {
    const section = readFileSync(fileURLToPath(new URL("../app/(site)/dashboard/ads/_components/google-reports-section.tsx", import.meta.url)), "utf8");
    expect(section).toContain("googleReportRangeSentence(data.range)");
    expect(section).toMatch(/setApplied\(null\);\s*setFrom\(""\);\s*setTo\(""\);/);
  });
});

describe("errors", () => {
  it("an account not on the connection says what to do", () => {
    expect(googleReportErrorMessage(new ApiError("AD_ACCOUNT_NOT_ALLOWED", "x", 403))).toMatch(/Reconnect Google Ads and share this account/);
  });
  it("the api's own sentences show (a range refusal, a rate limit)", () => {
    expect(googleReportErrorMessage(new ApiError("VALIDATION_ERROR", "The start date is after the end date.", 400))).toBe("The start date is after the end date.");
    expect(googleReportErrorMessage(new ApiError("RATE_LIMITED", "Google Ads is rate-limiting us — try again shortly.", 429))).toMatch(/rate-limiting/);
  });
  it("★anything else is the fallback, never a raw message", () => {
    expect(googleReportErrorMessage(new ApiError("INTERNAL", "stack trace", 500))).toBe("Google Ads didn't return this report. Try again in a moment.");
    expect(googleReportErrorMessage(new Error("boom"))).toBe("Google Ads didn't return this report. Try again in a moment.");
  });
});
