import type {
  ContentLedgerResponse,
  LedgerAnalytics,
  LedgerRow,
  LedgerSearch,
  LedgerSuggestion,
  LedgerSummary,
} from "@/lib/api/growth";

/**
 * What the content ledger SAYS — the phrasing rules, with no React in them.
 *
 * ★★NOTHING HERE DECIDES ANYTHING. Whether a page may be said to have earned a
 * figure, whether a total may be published, whether an absence is assertable:
 * every one of those is settled in the api, and a second decision on this side
 * would differ from it on the same data. What lives here is the SENTENCE —
 * which is its own way of being wrong, and the only one this repo can still get
 * wrong.
 *
 * ── ★★THE ONE SENTENCE THIS SCREEN MUST NEVER PRODUCE ─────────────────────
 *
 * "We published four articles and they brought 0 visitors."
 *
 * It is one missing GA4 row away at all times: the provider stores the TOP 25
 * PAGES per sync and nothing else, so most published pages have no row and
 * their absence is a fact about our storage budget. The api answers
 * `no_page_rows` rather than a zero precisely so this file cannot render one —
 * every `unknown` below therefore becomes WORDS, and a caller that reached past
 * them to a `?? 0` would put the sentence back.
 *
 * ── ★AND A DATE ON THIS SCREEN IS ALWAYS THE DATA'S, NEVER THE PERIOD'S ───
 *
 * `period` filters which PUBLICATIONS are listed. It says nothing about when
 * anything was measured. A row's search window carries its own bounds and its
 * analytics carries the first and last day actually present, and those are what
 * get printed — labelling either with the period would be a claim that the
 * period was measured.
 *
 * @package peakhour-b2c
 */

const NUM = new Intl.NumberFormat("en-US");

/**
 * A date as a shopkeeper writes it.
 *
 * ⚠️FORMATTED IN UTC, AND EXPLICITLY. Every date on this response is an ISO
 * instant at UTC midnight; formatted in the viewer's zone, a merchant west of
 * Greenwich reads every one of them as the day before — so a page published on
 * the 1st says the 31st, and the "days live" beside it disagrees with its own
 * date. The locale is pinned for the same reason the repo pins it elsewhere:
 * an assertion over a formatted date is otherwise green locally and red on CI.
 */
export function ledgerDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A window as one phrase: "1 – 28 Aug 2026". */
export function windowRange(startIso: string, endIso: string): string {
  return `${ledgerDate(startIso)} – ${ledgerDate(endIso)}`;
}

/**
 * Why a page has no search figures.
 *
 * ★★`awaiting_sync` IS NOT "NO CLICKS". The per-URL sync writes nothing for a
 * URL Google did not report, and nothing when it never ran — the api cannot
 * tell those apart, so neither can this. "No search data yet" says exactly that
 * much and no more; "no clicks" would be a statement about the merchant's page
 * drawn from a gap in ours.
 */
const SEARCH_ABSENCE: Record<
  Extract<LedgerSearch, { state: "unknown" }>["reason"],
  string
> = {
  awaiting_sync: "No search data yet",
  window_predates_publish: "Search data predates this page",
};

/**
 * Why a page has no analytics figures.
 *
 * ★★`no_page_rows` IS THE COMMON CASE AND IT IS ABOUT US. Analytics keeps the
 * top 25 pages per sync, so a page outside that has no row — which is a fact
 * about our storage budget, not about whether anyone read the article. The
 * sentence has to carry that, because the alternative a reader supplies for
 * themselves is "nobody visited".
 *
 * ★AND `not_connected` MUST NOT READ LIKE THE OTHERS. It is the one with a fix
 * the merchant can act on, and telling somebody with no analytics that their
 * page is "not in the top pages" sends them looking for a problem they cannot
 * see.
 */
const ANALYTICS_ABSENCE: Record<
  Extract<LedgerAnalytics, { state: "unknown" }>["reason"],
  string
> = {
  not_connected: "Connect Google Analytics",
  no_page_rows: "Not in the top pages we store",
  no_path: "This URL can't be matched in Analytics",
  ambiguous_path: "Two published pages share this address",
};

export function searchAbsenceText(
  reason: Extract<LedgerSearch, { state: "unknown" }>["reason"],
): string {
  // ★A REASON THIS BUILD HAS NEVER HEARD OF STILL GETS WORDS. A cell with a
  // muted dash and nothing else says less than saying nothing would, and the
  // api's reason set grows independently of this deploy.
  return SEARCH_ABSENCE[reason] ?? "Not available";
}

export function analyticsAbsenceText(
  reason: Extract<LedgerAnalytics, { state: "unknown" }>["reason"],
): string {
  return ANALYTICS_ABSENCE[reason] ?? "Not available";
}

/**
 * The line under a row's search figures, saying what they cover.
 *
 * ★★THE WINDOW'S OWN DATES, AND NOTHING MORE THAN THEY SAY. The range IS the
 * claim; anything added to it has to be true of the range itself.
 *
 * ⚠️🚫★★`coversFromPublish` MEANS "NO DAYS BEFORE PUBLICATION", NOT "THE WHOLE
 * LIFE OF THE PAGE", and a first version wrote the second sentence on the first
 * flag. The api sets it from `windowStart >= publishedAt` — so a page published
 * in January with a stored 28-day window of 1–28 August is `true`, and the row
 * read "Aug 1 – Aug 28 — the whole time this page has been live" directly
 * beside "Live 236 days". Two lines of the same row contradicting each other,
 * with 28 days of clicks presented as a lifetime total.
 *
 * ★SO `true` ADDS NOTHING. The dates already say what was measured; the only
 * fact worth adding is the one a reader would otherwise get wrong, which is a
 * window that reaches back past the page's own existence.
 */
export function searchWindowLine(search: Extract<LedgerSearch, { state: "measured" }>): string {
  const range = windowRange(search.windowStart, search.windowEnd);
  return search.coversFromPublish
    ? range
    : `${range} — includes days before this page went live`;
}

/**
 * The movement between two search windows, or null when there is none.
 *
 * ★NULL IS A REAL ANSWER. The api offers a trend only when it has two windows
 * far enough apart to compare; rendering "0" for a page that simply has no
 * second reading would be a claim that nothing changed.
 */
export function searchTrendLine(
  search: Extract<LedgerSearch, { state: "measured" }>,
): string | null {
  if (!search.trend) return null;
  const { clicksChange } = search.trend;
  const from = ledgerDate(search.trend.fromWindowEnd);
  if (clicksChange === 0) return `No change in clicks since ${from}`;
  const dir = clicksChange > 0 ? "up" : "down";
  return `Clicks ${dir} ${NUM.format(Math.abs(clicksChange))} since ${from}`;
}

/**
 * The line under a row's analytics figures.
 *
 * ★★IT REPORTS DAYS PRESENT, NOT DAYS SPANNED, and says so. Three measured days
 * out of forty is a total that is a FLOOR, and a reader who takes it for the
 * whole period draws the opposite conclusion about a page that was simply not
 * in the top 25 for most of them.
 */
export function analyticsCoverageLine(
  analytics: Extract<LedgerAnalytics, { state: "measured" }>,
): string {
  const range = windowRange(analytics.coveredSince, analytics.coveredUntil);
  const days = analytics.daysCovered;
  return `${range} — ${NUM.format(days)} ${days === 1 ? "day" : "days"} with data`;
}

/**
 * What a page was written for, in one sentence, or null when nothing was
 * recorded.
 *
 * ⚠️★★THE PREDICTION IS QUOTED AS BEING ABOUT THE SEARCH TERM, and the sentence
 * names the term to make that unmissable. The figure beside it in the row is
 * the PAGE's clicks across every query it ranks for, and a sentence that read
 * "we said 120, it brought 143" would invite the comparison the api's own
 * nesting is shaped to prevent — wrong by however much traffic the page draws
 * from other terms.
 */
export function suggestionLine(suggestion: LedgerSuggestion): string {
  const est = NUM.format(Math.round(suggestion.forQuery.estMonthlyClicks));
  return (
    `Written for “${suggestion.query}” — we estimated about ${est} ` +
    `${est === "1" ? "click" : "clicks"} a month from that search`
  );
}

/** A count with its noun, pluralised. */
function count(n: number, one: string, many = `${one}s`): string {
  return `${NUM.format(n)} ${n === 1 ? one : many}`;
}

/**
 * The publication windows the picker offers, and what each one is CALLED.
 *
 * ★★THE LABEL LIVES HERE BECAUSE THE SENTENCE UNDER IT IS BUILT FROM THE SAME
 * ROW. A quarter is the shortest span over which a published page has had time
 * to earn anything; a year is "everything we have", since the api refuses
 * anything longer.
 */
export const LEDGER_WINDOWS = [
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
] as const;

/** The longest window on offer — and the api's own ceiling. */
export const MAX_LEDGER_DAYS = LEDGER_WINDOWS[LEDGER_WINDOWS.length - 1].days;

/**
 * A window as a phrase the picker button matches: "the last 90 days".
 *
 * ⚠️🚫★★IT READS THE BUTTON'S OWN LABEL, AND A FIRST VERSION RE-DERIVED ONE.
 * That version tried `% 365` then `% 30`, and neither picker value came out
 * saying what its own button says: 365 became "the last 1 year" against a
 * button reading "12 months", and 90 became "the last 3 months" against one
 * reading "90 days". Every headline and empty state on the screen then named a
 * period the merchant had not clicked, and the docstring claiming otherwise
 * was the only place the intent survived. Two derivations of one fact are two
 * chances to disagree; there is now one.
 *
 * ⏸THE FALLBACK IS FOR VALUES THE PICKER DOES NOT OFFER — the api accepts any
 * day count up to its ceiling, and a link or a stale query string can carry
 * one. Months only where they divide cleanly: "the last 11.97 months" is what
 * an unconditional conversion produces.
 */
export function periodPhrase(days: number): string {
  const offered = LEDGER_WINDOWS.find((w) => w.days === days);
  if (offered) return `the last ${offered.label}`;
  if (days % 365 === 0) return `the last ${count(days / 365, "year")}`;
  if (days % 30 === 0) return `the last ${count(days / 30, "month")}`;
  return `the last ${count(days, "day")}`;
}

/**
 * Why nothing is listed, for a business that HAS published before.
 *
 * ⚠️🚫★★IT DOES NOT SAY "TRY A LONGER PERIOD" AT THE LONGEST PERIOD, AND A
 * FIRST VERSION DID. 365 days is both the last button on the picker and the
 * api's own ceiling, so a merchant whose earliest page is eighteen months old
 * was told to do the one thing the screen cannot do — and the instruction is
 * the only sentence on an otherwise empty page, so there is nothing else for
 * them to read instead.
 */
export function nothingInWindowDetail(stampedFrom: string, days: number): string {
  const earliest = `Your earliest recorded page was published on ${ledgerDate(stampedFrom)}.`;
  return days >= MAX_LEDGER_DAYS
    ? `${earliest} The ledger reaches back ${periodPhrase(MAX_LEDGER_DAYS).replace("the last ", "")}, so anything before that isn't listed here.`
    : `${earliest} Try a longer period to see it.`;
}

/**
 * The headline above the table.
 *
 * ★★IT NAMES THE SCOPE OF EVERY FIGURE UNDER IT, AND THERE ARE TWO SCOPES.
 *
 * `pagesInView` counts the rows RETURNED, so on a business with three hundred
 * publications and a page size of fifty it is fifty — a headline reading "50
 * pages" invites "you published fifty things", a statement about the merchant
 * drawn from our page size.
 *
 * ⚠️AND THE WINDOW IS THE OTHER ONE, WHICH A FIRST VERSION STATED ONLY IN THE
 * TRUNCATED BRANCH. Forty pages over a year with the 90-day window selected
 * reads "4 pages published through Peakhour" — the same misreading from the
 * other direction, and `recordBeganLine` is null in exactly that case, so
 * nothing else on the screen says which period it means.
 */
export function summaryHeadline(
  summary: LedgerSummary,
  truncated: boolean,
  days: number,
): string {
  const n = summary.pagesInView;
  const period = periodPhrase(days);
  if (n === 0) return `Nothing published through Peakhour in ${period}`;
  // ⚠️BOTH BRANCHES NAME THE WINDOW, AND A FIRST FIX ONLY CLAIMED THEY DID. The
  // truncated one omitted it, so a business with three hundred publications got
  // the same fifty rows and the identical headline from either picker button —
  // and `recordBeganLine` is null in exactly that case, so nothing on the
  // screen said which period was being shown or that the button had done
  // anything at all.
  return truncated
    ? `Your ${NUM.format(n)} most recent ${n === 1 ? "page" : "pages"} in ${period}`
    : `${count(n, "page")} published in ${period}`;
}

/**
 * A row's search figures.
 *
 * ★★PLURALISED HERE RATHER THAN IN THE COMPONENT, and that is the point of
 * moving it. A first version built this string in the table with hard-coded
 * plurals — "1 clicks · 1 impressions" — directly beneath summary lines that
 * pluralised correctly, and being in a `.tsx` put it beyond both the spec and
 * the mutation harness.
 */
export function searchFiguresLine(
  search: Extract<LedgerSearch, { state: "measured" }>,
): string {
  return `${count(search.clicks, "click")} · ${count(search.impressions, "impression")}`;
}

/** A row's analytics figures, pluralised for the same reason. */
export function analyticsFiguresLine(
  analytics: Extract<LedgerAnalytics, { state: "measured" }>,
): string {
  return `${count(analytics.views, "view")} · ${count(analytics.conversions, "conversion")}`;
}

/**
 * The search total, or the reason there isn't one.
 *
 * ★★`mixed_windows` IS WITHHELD, NOT ESTIMATED. Each page carries the window
 * its LAST sync gave it, and a page Google stopped reporting keeps an older
 * one — so two rows can hold clicks for two different months. The api refuses
 * to add those, exactly as it refuses to add two currencies, and this states
 * the refusal rather than quietly summing the rows itself. Doing that here is
 * trivially possible and is the whole reason the rule is not on this side.
 */
export function searchTotalLine(summary: LedgerSummary): string {
  const s = summary.search;
  if (s.state === "measured") {
    // ⚠️🚫★★EVERY PLURAL HERE GOES THROUGH `count`, AND ONE DID NOT. This line
    // built its own strings by hand and hard-coded "impressions", so a summary
    // of one click and one impression read "1 search click and 1 impressions"
    // — directly above a row that `searchFiguresLine` had rendered correctly as
    // "1 click · 1 impression". That is the exact defect this module was
    // extracted to remove, reproduced inside it, and neither the spec's
    // `toContain` nor the `count` mutant could see it because the sentence
    // never called the helper they were guarding.
    return (
      `${count(s.clicks, "search click")} and ${count(s.impressions, "impression")} ` +
      `across ${count(s.pagesMeasured, "page")}, ${windowRange(s.windowStart, s.windowEnd)}`
    );
  }
  // ★★KEYED ON WHAT WAS MEASURED, NOT ON THE REASON WE KNOW ABOUT. A first
  // version denied search data for every reason except `mixed_windows`, so a
  // third reason arriving from the api with pages already measured would print
  // "No search data for these pages yet" above rows showing clicks. Nothing
  // measured is the only state that sentence is true of.
  if (s.pagesMeasured === 0) return "No search data for these pages yet";
  if (s.reason === "mixed_windows") {
    return (
      `${count(s.pagesMeasured, "page has", "pages have")} search data, but over ` +
      `different periods — so there is no total to show`
    );
  }
  return `${count(s.pagesMeasured, "page has", "pages have")} search data, but we can't total it`;
}

/**
 * The analytics total, or the reason there isn't one.
 *
 * ⏸THIS ONE ADDS UP UNCONDITIONALLY, and the sentence says why: each page's
 * figures are its own series since ITS publish date, so the sum is "what
 * everything we published earned, each over its own life". Different lengths,
 * one honest total — which is exactly what the search half cannot do.
 */
export function analyticsTotalLine(summary: LedgerSummary): string {
  const a = summary.analytics;
  if (a.state === "measured") {
    // Through `count` for the same reason as its search counterpart above: a
    // hand-built plural beside a helper-built one is the pair that drifts.
    return (
      `${count(a.views, "view")} and ${count(a.conversions, "conversion")} ` +
      `across ${count(a.pagesMeasured, "page")}, each since it was published`
    );
  }
  // Keyed on what was measured, not on the reason we know about — the same
  // guard as its search counterpart, and for the same future.
  if (a.pagesMeasured === 0) return "No analytics for these pages yet";
  return `${count(a.pagesMeasured, "page has", "pages have")} analytics, but we can't total it`;
}

/**
 * The address a row's title should link to, or null when there isn't one.
 *
 * ⚠️🚫★★`row.url` IS STORED, NOT VALIDATED, AND A FIRST VERSION PUT IT
 * STRAIGHT INTO AN `href`. `rowTitle` two functions down already models a url
 * that will not parse — the api enumerates it as the `no_path` reason — and
 * this side then handed the same string to a `<Link>`: a scheme-less
 * `example.com/page` is a RELATIVE href, so "open in a new tab" opened the
 * dashboard's own 404, on the row whose whole job is to show the merchant the
 * page they published.
 *
 * ★AND THE SCHEME IS CHECKED, NOT JUST THE PARSE. `new URL` accepts
 * `javascript:` and `data:` happily; neither is a page anybody published.
 */
export function rowHref(row: LedgerRow): string | null {
  try {
    const url = new URL(row.url);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Where THIS BUSINESS's record begins, when that is later than the period asked
 * for.
 *
 * ★★THE GAP EXPLAINS A SHORT LIST. Nothing linked a page to its publish before
 * the ledger shipped and the link cannot be reconstructed, so a business with a
 * year of articles may see only the ones published since. Without this line the
 * list reads as "you have published four things" — a statement about the
 * merchant drawn from the date their record starts.
 *
 * ⚠️🚫★★IT SAYS "YOUR EARLIEST", NOT "PEAKHOUR BEGAN". `stampedFrom` is the
 * oldest stamp THIS BUSINESS carries, and a first version phrased it as the
 * product's own start date — so a merchant who first published three weeks ago
 * was told Peakhour only began recording three weeks ago, which is a claim
 * about us that this field cannot support. It also cannot distinguish "we did
 * not record before then" from "you did not publish before then", so the
 * sentence states only what the field IS.
 *
 * ★NULL WHEN THERE IS NOTHING TO SAY: nothing stamped at all (the empty state
 * carries that), or a record that already begins before the window.
 */
export function recordBeganLine(ledger: ContentLedgerResponse): string | null {
  if (!ledger.stampedFrom) return null;
  const began = new Date(ledger.stampedFrom).getTime();
  const since = new Date(ledger.period.since).getTime();
  if (Number.isNaN(began) || Number.isNaN(since)) return null;
  if (began <= since) return null;
  return `Your earliest recorded page was published on ${ledgerDate(ledger.stampedFrom)}.`;
}

/** How long a page has been live, as a phrase. */
export function daysLiveLine(row: LedgerRow): string {
  if (row.daysLive === 0) return "Published today";
  return `Live ${NUM.format(row.daysLive)} ${row.daysLive === 1 ? "day" : "days"}`;
}

/**
 * The page's own name, falling back to its address.
 *
 * ⚠️AND THE ROOT PATH IS NOT AN ADDRESS A MERCHANT CAN READ. `new URL(u).pathname`
 * is `"/"` for a site root, which is truthy — so a first version labelled a
 * title-less root row `/`. The case is reachable: the api's own `no_path` reason
 * enumerates a URL that IS `/`. The full URL is longer and says which page it
 * is, which is the whole job of this string.
 */
export function rowTitle(row: LedgerRow): string {
  const t = row.title?.trim();
  if (t) return t;
  try {
    const path = new URL(row.url).pathname;
    return path && path !== "/" ? path : row.url;
  } catch {
    return row.url;
  }
}
