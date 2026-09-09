import { describe, it, expect } from "vitest";
import {
  analyticsAbsenceText,
  analyticsCoverageLine,
  analyticsFiguresLine,
  analyticsTotalLine,
  daysLiveLine,
  ledgerDate,
  LEDGER_WINDOWS,
  nothingInWindowDetail,
  periodPhrase,
  rowHref,
  recordBeganLine,
  rowTitle,
  searchAbsenceText,
  searchFiguresLine,
  searchTotalLine,
  searchTrendLine,
  searchWindowLine,
  suggestionLine,
  summaryHeadline,
  windowRange,
} from "./content-ledger";
import type {
  ContentLedgerResponse,
  LedgerRow,
  LedgerSummary,
} from "@/lib/api/growth";

/**
 * ★★THE ONE SENTENCE THIS SCREEN MUST NEVER PRODUCE is "we published four
 * articles and they brought 0 visitors" — the most expensive sentence in the
 * product, and one missing GA4 row away at all times, because the provider
 * stores the TOP 25 PAGES per sync and nothing else.
 *
 * ★SO MOST OF WHAT FOLLOWS IS ABOUT WORDS WHERE A NUMBER WOULD FIT: every
 * `unknown` becoming a sentence a shopkeeper can act on or dismiss, and the one
 * total that is withheld rather than computed.
 */

const iso = (s: string) => `${s}T00:00:00.000Z`;

const measuredSearch = (over: Record<string, unknown> = {}) =>
  ({
    state: "measured" as const,
    clicks: 143,
    impressions: 2100,
    position: 8.2,
    windowStart: iso("2026-08-01"),
    windowEnd: iso("2026-08-28"),
    coversFromPublish: true,
    ...over,
  }) as never;

const measuredAnalytics = (over: Record<string, unknown> = {}) =>
  ({
    state: "measured" as const,
    views: 380,
    conversions: 4,
    coveredSince: iso("2026-07-02"),
    coveredUntil: iso("2026-08-30"),
    daysCovered: 12,
    ...over,
  }) as never;

const row = (over: Partial<LedgerRow> = {}): LedgerRow =>
  ({
    url: "https://shop.example/blog/winter-boots",
    title: "How to choose winter boots",
    channel: "wordpress",
    sourceType: "idea",
    publishedAt: iso("2026-07-01"),
    daysLive: 38,
    search: measuredSearch(),
    analytics: measuredAnalytics(),
    ...over,
  }) as LedgerRow;

const summary = (over: Partial<LedgerSummary> = {}): LedgerSummary =>
  ({
    pagesInView: 4,
    search: {
      state: "measured",
      clicks: 210,
      impressions: 5400,
      windowStart: iso("2026-08-01"),
      windowEnd: iso("2026-08-28"),
      pagesMeasured: 3,
    },
    analytics: { state: "measured", views: 900, conversions: 11, pagesMeasured: 4 },
    ...over,
  }) as LedgerSummary;

// ── Dates ───────────────────────────────────────────────────────────────────

describe("ledgerDate", () => {
  it("★★formats in UTC, not the viewer's zone", () => {
    // Every date on this response is an ISO instant at UTC midnight. Formatted
    // locally, a merchant west of Greenwich reads every one as the day before —
    // so a page published on the 1st says the 31st and disagrees with the "days
    // live" beside it.
    expect(ledgerDate(iso("2026-07-01"))).toBe("Jul 1, 2026");
  });

  it("★pins the locale, so an assertion is not green locally and red on CI", () => {
    expect(windowRange(iso("2026-08-01"), iso("2026-08-28"))).toBe(
      "Aug 1, 2026 – Aug 28, 2026",
    );
  });

  it("does not render an unparseable date as an epoch", () => {
    expect(ledgerDate("not a date")).toBe("—");
  });
});

// ── Absences: words where a number would fit ────────────────────────────────

describe("searchAbsenceText", () => {
  it("★★★says there is no DATA, never that there were no clicks", () => {
    // The per-URL sync writes nothing for a URL Google did not report, and
    // nothing when it never ran. The api cannot tell those apart, so neither
    // can this — "no clicks" would be a statement about the merchant's page
    // drawn from a gap in ours.
    const t = searchAbsenceText("awaiting_sync");
    expect(t).toBe("No search data yet");
    expect(t).not.toMatch(/\b0\b|no clicks|zero/i);
  });

  it("names the reused-URL case separately", () => {
    expect(searchAbsenceText("window_predates_publish")).toBe(
      "Search data predates this page",
    );
  });

  it("★a reason this build has never heard of still gets words", () => {
    // The api's reason set grows independently of this deploy, and a cell with
    // a muted dash says less than saying nothing would.
    expect(searchAbsenceText("something_new" as never)).toBe("Not available");
  });
});

describe("analyticsAbsenceText", () => {
  it("★★★says the page is not in what we STORE, never that nobody visited", () => {
    // Analytics keeps the top 25 pages per sync, so a page outside that has no
    // row — a fact about our storage budget. The alternative a reader supplies
    // for themselves is "nobody read it".
    const t = analyticsAbsenceText("no_page_rows");
    expect(t).toBe("Not in the top pages we store");
    expect(t).not.toMatch(/\b0\b|no visitors|nobody|zero/i);
  });

  it("★★gives the connect case its own instruction", () => {
    // It is the one absence with a fix the merchant can act on. Telling
    // somebody with no analytics that their page is "not in the top pages"
    // sends them looking for a problem they cannot see.
    expect(analyticsAbsenceText("not_connected")).toBe("Connect Google Analytics");
    expect(analyticsAbsenceText("not_connected")).not.toBe(
      analyticsAbsenceText("no_page_rows"),
    );
  });

  it("names the two addressing refusals distinctly", () => {
    expect(analyticsAbsenceText("no_path")).not.toBe(analyticsAbsenceText("ambiguous_path"));
  });

  it("★an ANALYTICS reason this build has never heard of still gets words", () => {
    expect(analyticsAbsenceText("something_new" as never)).toBe("Not available");
  });
});

// ── A row's own dates ───────────────────────────────────────────────────────

describe("searchWindowLine", () => {
  it("prints the window's OWN bounds", () => {
    expect(searchWindowLine(measuredSearch())).toContain("Aug 1, 2026 – Aug 28, 2026");
  });

  it("★★★claims nothing beyond the dates when the window starts after publication", () => {
    // ⚠️`coversFromPublish` MEANS "NO DAYS BEFORE PUBLICATION", NOT "THE WHOLE
    // LIFE OF THE PAGE" — the api sets it from `windowStart >= publishedAt`.
    // A page published in January with a 28-day August window is `true`, and a
    // first version wrote "the whole time this page has been live" over it,
    // directly beside "Live 236 days". Two lines of one row contradicting each
    // other, with 28 days of clicks read as a lifetime total.
    const line = searchWindowLine(measuredSearch());
    expect(line).toBe("Aug 1, 2026 – Aug 28, 2026");
    expect(line).not.toMatch(/whole time|life|since you published/i);
  });

  it("★★marks a window that reaches back past the page's own existence", () => {
    // The only fact worth adding to the dates is the one a reader would
    // otherwise get wrong.
    const line = searchWindowLine(measuredSearch({ coversFromPublish: false }));
    expect(line).toContain("includes days before this page went live");
  });
});

describe("searchTrendLine", () => {
  it("★★offers nothing when there is no second reading", () => {
    // The api gives a trend only when it holds two windows far enough apart.
    // Rendering "0" for a page with one reading would claim nothing changed.
    expect(searchTrendLine(measuredSearch())).toBeNull();
  });

  it("names the window the movement is measured FROM", () => {
    const line = searchTrendLine(
      measuredSearch({
        trend: { clicksChange: 21, impressionsChange: 300, fromWindowEnd: iso("2026-07-14") },
      }),
    );
    expect(line).toBe("Clicks up 21 since Jul 14, 2026");
  });

  it("says a real zero is a real zero, once there ARE two readings", () => {
    const line = searchTrendLine(
      measuredSearch({
        trend: { clicksChange: 0, impressionsChange: 0, fromWindowEnd: iso("2026-07-14") },
      }),
    );
    expect(line).toBe("No change in clicks since Jul 14, 2026");
  });

  it("phrases a fall as a fall, not as a negative number", () => {
    const line = searchTrendLine(
      measuredSearch({
        trend: { clicksChange: -8, impressionsChange: -90, fromWindowEnd: iso("2026-07-14") },
      }),
    );
    expect(line).toBe("Clicks down 8 since Jul 14, 2026");
    expect(line).not.toContain("-8");
  });
});

describe("analyticsCoverageLine", () => {
  it("★★★reports days PRESENT, and says so, because the total is a floor", () => {
    // Twelve measured days across a two-month span is a total a reader must not
    // take for the whole period — the gap is how they know it is a floor.
    const line = analyticsCoverageLine(measuredAnalytics());
    expect(line).toContain("Jul 2, 2026 – Aug 30, 2026");
    expect(line).toContain("12 days with data");
  });

  it("counts one day in the singular", () => {
    expect(analyticsCoverageLine(measuredAnalytics({ daysCovered: 1 }))).toContain(
      "1 day with data",
    );
  });
});

// ── The figures on a row ────────────────────────────────────────────────────

describe("searchFiguresLine / analyticsFiguresLine", () => {
  it("★★pluralises, because a first version built these in the component", () => {
    // Hard-coded plurals there produced "1 clicks · 1 impressions" directly
    // beneath summary lines that pluralised correctly — and being in a `.tsx`
    // put it beyond both the spec and the mutation harness. That is why the
    // strings moved here.
    expect(searchFiguresLine(measuredSearch({ clicks: 1, impressions: 1 }))).toBe(
      "1 click · 1 impression",
    );
    expect(analyticsFiguresLine(measuredAnalytics({ views: 1, conversions: 1 }))).toBe(
      "1 view · 1 conversion",
    );
  });

  it("prints the plural for every other count, including zero", () => {
    // ⏸A ZERO HERE IS A REAL ZERO. These lines are only reached on `measured`,
    // where the api HAS the figure — "0 clicks" from a page Google reported and
    // nobody clicked is a fact, and the refusals live in the absence text.
    expect(searchFiguresLine(measuredSearch({ clicks: 0, impressions: 12 }))).toBe(
      "0 clicks · 12 impressions",
    );
    expect(analyticsFiguresLine(measuredAnalytics())).toBe("380 views · 4 conversions");
  });
});

describe("periodPhrase", () => {
  it("★★★says exactly what the button the merchant pressed says", () => {
    // A first version re-derived the phrase from the day count, and NEITHER
    // picker value came out matching its own button: 365 became "the last 1
    // year" beside a button reading "12 months", and 90 became "the last 3
    // months" beside one reading "90 days". Every headline and empty state on
    // the screen then named a period nobody had clicked.
    for (const w of LEDGER_WINDOWS) {
      expect(periodPhrase(w.days)).toBe(`the last ${w.label}`);
    }
    expect(periodPhrase(90)).toBe("the last 90 days");
    expect(periodPhrase(365)).toBe("the last 12 months");
  });

  it("says months and years where they divide cleanly, for windows not offered", () => {
    expect(periodPhrase(30)).toBe("the last 1 month");
    expect(periodPhrase(60)).toBe("the last 2 months");
    expect(periodPhrase(730)).toBe("the last 2 years");
  });

  it("★falls back to days rather than inventing a fraction of a month", () => {
    // The api accepts anything from 7 to 365, and "the last 1.57 months" is
    // what an unconditional conversion produces for the values the picker does
    // not offer.
    expect(periodPhrase(7)).toBe("the last 7 days");
    expect(periodPhrase(47)).toBe("the last 47 days");
  });
});

// ── The suggestion, and the comparison that must not be invited ─────────────

describe("suggestionLine", () => {
  it("★★★names the SEARCH TERM the estimate was about", () => {
    // The figure beside it in the row is the page's clicks across every query
    // it ranks for. A sentence reading "we said 120, it brought 143" would
    // invite a comparison wrong by however much traffic the page draws from
    // other terms.
    const line = suggestionLine({
      actionKey: "k",
      type: "win_the_click",
      query: "winter boots",
      forQuery: { estMonthlyClicks: 120, clicksAtAdoption: 4, positionAtAdoption: 4.1 },
    });
    expect(line).toContain("winter boots");
    expect(line).toContain("from that search");
    expect(line).toContain("about 120 clicks a month");
  });

  it("rounds the estimate rather than printing a fraction of a click", () => {
    const line = suggestionLine({
      actionKey: "k",
      type: "create_content",
      query: "boots",
      forQuery: { estMonthlyClicks: 3.7, clicksAtAdoption: 0, positionAtAdoption: 22 },
    });
    expect(line).toContain("about 4 clicks");
  });
});

// ── The totals above the table ──────────────────────────────────────────────

describe("summaryHeadline", () => {
  it("★★★names the page size rather than claiming a business total", () => {
    // `pagesInView` counts the rows RETURNED. "50 pages published" above a
    // truncated table is a statement about the merchant drawn from our limit.
    expect(summaryHeadline(summary({ pagesInView: 50 }), true, 90)).toBe(
      "Your 50 most recent pages in the last 90 days",
    );
  });

  it("★★★names the window in the TRUNCATED branch too", () => {
    // A first fix claimed both branches named it and only one did. With three
    // hundred publications both picker buttons return the same fifty rows, so
    // an unnamed window made them produce the identical headline — and
    // `recordBeganLine` is null in exactly that case, so nothing on the screen
    // said the button had done anything at all.
    const ninety = summaryHeadline(summary({ pagesInView: 50 }), true, 90);
    const year = summaryHeadline(summary({ pagesInView: 50 }), true, 365);
    expect(ninety).not.toBe(year);
    expect(year).toContain("the last 12 months");
  });

  it("★★★names the WINDOW too, so 40 pages over a year is not read as 4", () => {
    // A first version stated the scope only in the truncated branch, so forty
    // pages over a year with the 90-day window selected read "4 pages published
    // through Peakhour" — the same misreading from the other direction. And
    // `recordBeganLine` is null in exactly that case, so nothing else on the
    // screen said which period it meant.
    expect(summaryHeadline(summary({ pagesInView: 4 }), false, 90)).toBe(
      "4 pages published in the last 90 days",
    );
    expect(summaryHeadline(summary({ pagesInView: 4 }), false, 365)).toBe(
      "4 pages published in the last 12 months",
    );
  });

  it("has an empty state that is not a zero, and still names the window", () => {
    expect(summaryHeadline(summary({ pagesInView: 0 }), false, 90)).toBe(
      "Nothing published through Peakhour in the last 90 days",
    );
  });

  it("counts one page in the singular", () => {
    expect(summaryHeadline(summary({ pagesInView: 1 }), false, 90)).toBe(
      "1 page published in the last 90 days",
    );
  });
});

describe("searchTotalLine", () => {
  it("prints the window the total covers", () => {
    expect(searchTotalLine(summary())).toContain("Aug 1, 2026 – Aug 28, 2026");
  });

  it("★★★states the refusal when the pages carry DIFFERENT windows", () => {
    // A page Google stopped reporting keeps the window its last sync gave it,
    // so two rows can hold clicks for two different months. The api withholds
    // the sum exactly as it withholds two currencies — and adding them here
    // instead is trivially possible, which is why the rule is not on this side.
    const line = searchTotalLine(
      summary({ search: { state: "unavailable", reason: "mixed_windows", pagesMeasured: 3 } }),
    );
    expect(line).toContain("over different periods");
    expect(line).toContain("no total to show");
    expect(line).toContain("3 pages");
  });

  it("says there is no data rather than reporting zero clicks", () => {
    const line = searchTotalLine(
      summary({
        search: { state: "unavailable", reason: "no_measured_pages", pagesMeasured: 0 },
      }),
    );
    expect(line).toBe("No search data for these pages yet");
    expect(line).not.toMatch(/\b0\b/);
  });

  it("★★★pluralises the TOTAL the same way the rows under it do", () => {
    // This line built its own strings and hard-coded "impressions", so one
    // click and one impression read "1 search click and 1 impressions" —
    // directly above a row `searchFiguresLine` had rendered correctly as "1
    // click · 1 impression". That is the exact defect this module was extracted
    // to remove, reproduced inside it, and a `toContain` assertion cannot see
    // it because the number is right and only the noun is wrong.
    const line = searchTotalLine(
      summary({
        search: {
          state: "measured",
          clicks: 1,
          impressions: 1,
          windowStart: iso("2026-08-01"),
          windowEnd: iso("2026-08-28"),
          pagesMeasured: 1,
        },
      }),
    );
    expect(line).toContain("1 search click and 1 impression across 1 page");
    expect(line).not.toMatch(/\b1 (impressions|pages|search clicks)\b/);
  });

  it("★★★never denies search data over pages it just measured", () => {
    // A first version asserted "No search data for these pages yet" for every
    // reason but `mixed_windows`, so a third reason arriving from the api with
    // pages already measured printed that denial above rows showing clicks.
    // Nothing measured is the only state that sentence is true of.
    const line = searchTotalLine(
      summary({
        search: { state: "unavailable", reason: "something_new" as never, pagesMeasured: 3 },
      }),
    );
    expect(line).not.toBe("No search data for these pages yet");
    expect(line).toContain("3 pages have search data");
  });
});

describe("nothingInWindowDetail", () => {
  it("★points a merchant at the longer window when there is one", () => {
    const d = nothingInWindowDetail(iso("2026-01-15"), 90);
    expect(d).toContain("Jan 15, 2026");
    expect(d).toContain("Try a longer period");
  });

  it("★★★does NOT ask for a longer period at the longest period", () => {
    // 365 days is both the last button on the picker and the api's own ceiling,
    // so a merchant whose earliest page is eighteen months old was told to do
    // the one thing the screen cannot do — and it is the only sentence on an
    // otherwise empty page, so there is nothing else for them to read.
    const d = nothingInWindowDetail(iso("2025-01-15"), 365);
    expect(d).not.toMatch(/longer period/i);
    expect(d).toContain("reaches back 12 months");
  });
});

describe("rowHref", () => {
  it("links a page we can actually open", () => {
    expect(rowHref(row())).toBe("https://shop.example/blog/winter-boots");
  });

  it("★★★refuses a stored url with no scheme, which is a RELATIVE href", () => {
    // `rowTitle` already models a url that will not parse — the api enumerates
    // it as `no_path` — and this side then handed the same string to a `Link`.
    // "Open in a new tab" opened the dashboard's own 404, on the row whose
    // whole job is to show the merchant the page they published.
    expect(rowHref(row({ url: "shop.example/blog/winter-boots" }))).toBeNull();
    expect(rowHref(row({ url: "not a url at all" }))).toBeNull();
  });

  it("★★refuses a scheme that is not the web", () => {
    // `new URL` accepts these happily; neither is a page anybody published.
    expect(rowHref(row({ url: "javascript:alert(1)" }))).toBeNull();
    expect(rowHref(row({ url: "data:text/html,hi" }))).toBeNull();
  });
});

describe("analyticsTotalLine", () => {
  it("★says the total is each page over its OWN life", () => {
    // Different lengths, one honest total — which is exactly what the search
    // half cannot do, and the sentence is where the difference shows.
    const line = analyticsTotalLine(summary());
    expect(line).toContain("900 views");
    expect(line).toContain("each since it was published");
  });

  it("says there is no data rather than reporting zero views", () => {
    const line = analyticsTotalLine(
      summary({
        analytics: { state: "unavailable", reason: "no_measured_pages", pagesMeasured: 0 },
      }),
    );
    expect(line).toBe("No analytics for these pages yet");
    expect(line).not.toMatch(/\b0\b/);
  });
});

// ── Where the record begins ─────────────────────────────────────────────────

const ledger = (over: Partial<ContentLedgerResponse> = {}): ContentLedgerResponse =>
  ({
    period: { days: 90, since: iso("2026-06-11"), until: iso("2026-09-09") },
    stampedFrom: iso("2026-07-01"),
    rows: [row()],
    summary: summary(),
    truncated: false,
    ...over,
  }) as ContentLedgerResponse;

describe("recordBeganLine", () => {
  it("★★★says when the record begins, so a short list is not read as a short year", () => {
    // Nothing linked a page to its publish before the ledger shipped and the
    // link cannot be reconstructed. Without this the list reads as "you have
    // published four things" — a statement about the merchant drawn from the
    // date we started keeping records.
    // ⚠️AND IT SAYS "YOUR EARLIEST", NOT "PEAKHOUR BEGAN". `stampedFrom` is
    // the oldest stamp THIS BUSINESS carries; phrasing it as the product's own
    // start date told a merchant who first published three weeks ago that
    // Peakhour only began recording three weeks ago — a claim about us this
    // field cannot support.
    const line = recordBeganLine(ledger());
    expect(line).toBe("Your earliest recorded page was published on Jul 1, 2026.");
    expect(line).not.toMatch(/Peakhour began/i);
  });

  it("★says nothing when the record already begins before the window", () => {
    // There is no gap to explain, and a line explaining one would imply a limit
    // that is not there.
    expect(recordBeganLine(ledger({ stampedFrom: iso("2026-01-04") }))).toBeNull();
  });

  it("says nothing when nothing has ever been stamped", () => {
    // The empty state carries that; a "we began recording on…" line above no
    // rows would name a date nothing happened on.
    expect(recordBeganLine(ledger({ stampedFrom: null }))).toBeNull();
  });
});

// ── Row identity ────────────────────────────────────────────────────────────

describe("rowTitle", () => {
  it("prefers the page's own name", () => {
    expect(rowTitle(row())).toBe("How to choose winter boots");
  });

  it("★falls back to the PATH, not to a bare empty string", () => {
    // A row with no title is an adapter that did not send one, and a blank cell
    // is a row a merchant cannot identify.
    expect(rowTitle(row({ title: "   " }))).toBe("/blog/winter-boots");
    expect(rowTitle(row({ title: undefined }))).toBe("/blog/winter-boots");
  });

  it("falls back to the raw string when the URL does not parse", () => {
    expect(rowTitle(row({ title: undefined, url: "not a url" }))).toBe("not a url");
  });

  it("★★does not label a title-less ROOT row “/”", () => {
    // `new URL(u).pathname` is "/" for a site root, which is truthy — so a
    // first version labelled the row with a single slash. The case is
    // reachable: the api's own `no_path` reason enumerates a URL that IS "/".
    expect(rowTitle(row({ title: undefined, url: "https://shop.example/" }))).toBe(
      "https://shop.example/",
    );
  });
});

describe("daysLiveLine", () => {
  it("counts days", () => {
    expect(daysLiveLine(row())).toBe("Live 38 days");
    expect(daysLiveLine(row({ daysLive: 1 }))).toBe("Live 1 day");
  });

  it("★says “today” rather than “live 0 days”", () => {
    // Zero here is a real zero and still the wrong words: a page published this
    // morning has not been live for no days.
    expect(daysLiveLine(row({ daysLive: 0 }))).toBe("Published today");
  });
});
