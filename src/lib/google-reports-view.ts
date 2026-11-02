import { ApiError } from "@/lib/api";
import { formatGoogleMoney, googleAdsErrorMessage, googleChannelTypeLabel } from "@/lib/google-ads-view";
import type {
  GoogleAccountReportRow,
  GoogleAdReportRow,
  GoogleBiddingStrategyReportRow,
  GoogleCampaignReportRow,
  GoogleKeywordReportRow,
  GoogleReportKey,
  GoogleReportRange,
  GoogleReportRows,
  GoogleSearchTermReportRow,
} from "@/lib/api/google-ads";

/**
 * ★★G-14d — what the Google panel's reports view SAYS, kept pure so every
 * column and sentence is tested (`google-reports-view.test.ts`).
 *
 * Six tables, one per report in Google's Required Minimum Functionality
 * (peakhour-mongodb `docs/idea/google-ads-rmf-gap-assessment.md` §1.4):
 * R.10 Account, R.20 Campaign, R.40 Ad, R.50 Keyword, R.70 Search term,
 * R.130 Bidding strategy. ★EVERY COLUMN RMF MARKS REQUIRED IS SHOWN BY
 * DEFAULT ("must display all the columns marked required … as default"); the
 * rest of each table is what makes a row recognisable.
 *
 * ★★GOOGLE'S CONVERSIONS ARE LABELLED AS GOOGLE'S (plan §6.4, measurement
 * honesty). Every conversion column says "Google Ads", and no column here
 * carries Peakhour's verified outcomes: those are on Growth → Channels, and
 * the two are never added together or shown in one column.
 */

// ── The tables ───────────────────────────────────────────────────────────

export interface GoogleReportTab {
  key: GoogleReportKey;
  label: string;
  /** The RMF item it implements. */
  rmf: string;
  /** Said under the table, always. */
  note: string;
}

export const GOOGLE_REPORT_TABS: readonly GoogleReportTab[] = [
  { key: "account", label: "Account", rmf: "R.10", note: "This Google Ads account's totals for the dates chosen." },
  { key: "campaigns", label: "Campaigns", rmf: "R.20", note: "Every campaign in this account, paused and removed ones included, costliest first." },
  { key: "ads", label: "Ads", rmf: "R.40", note: "Every ad in this account, paused and removed ones included, costliest first." },
  {
    key: "keywords",
    label: "Keywords",
    rmf: "R.50",
    note: "Every keyword in this account, costliest first. The bid estimates are Google's: what it expects a click to cost to show on the first page, and in the first position.",
  },
  {
    key: "search-terms",
    label: "Search terms",
    rmf: "R.70",
    note: "What people searched when your ads showed, and the match type that triggered them. Google does not include Performance Max campaigns here.",
  },
  {
    key: "bidding-strategies",
    label: "Bidding strategies",
    rmf: "R.130",
    note: "Portfolio bidding strategies: ones shared across campaigns. A campaign's own strategy is in the Campaigns table's Bidding column.",
  },
];

/** The two conversion columns' headers: Google's, said so. */
export const GOOGLE_ADS_CONVERSIONS_LABEL = "Google Ads conversions";
export const GOOGLE_ADS_ALL_CONVERSIONS_LABEL = "Google Ads all conversions";

/** Said above every table. */
export const GOOGLE_REPORTS_MEASUREMENT_NOTE =
  "These numbers come straight from Google Ads. Conversions are Google Ads conversions, counted by Google. Outcomes PeakHour verifies are on Growth → Channels, and are never added to these columns.";

export const GOOGLE_REPORT_DEFAULT_RANGE_LABEL = "Last 30 days";

// ── Words for Google's enums ─────────────────────────────────────────────

/** `RESPONSIVE_SEARCH_AD` → "Responsive search ad". A value this build does not know is still said. */
export function humanizeGoogleEnum(v: string | undefined): string {
  if (!v) return "—";
  const words = v.toLowerCase().split("_").filter(Boolean).join(" ");
  return words ? words[0]!.toUpperCase() + words.slice(1) : "—";
}

/** Google's UI names for the bidding strategy types a merchant meets most. */
const BIDDING_WORDS: Record<string, string> = {
  TARGET_SPEND: "Maximize clicks",
  MAXIMIZE_CONVERSIONS: "Maximize conversions",
  MAXIMIZE_CONVERSION_VALUE: "Maximize conversion value",
  TARGET_CPA: "Target CPA",
  TARGET_ROAS: "Target ROAS",
  MANUAL_CPC: "Manual CPC",
  TARGET_IMPRESSION_SHARE: "Target impression share",
};

export function googleBiddingTypeLabel(v: string | undefined): string {
  return v && Object.prototype.hasOwnProperty.call(BIDDING_WORDS, v) ? BIDDING_WORDS[v]! : humanizeGoogleEnum(v);
}

/** A campaign's type: the three PeakHour creates by their own labels; any other as Google names it. */
export function googleReportChannelLabel(v: string | undefined): string {
  if (v === "SEARCH" || v === "PERFORMANCE_MAX" || v === "DEMAND_GEN") return googleChannelTypeLabel(v);
  return humanizeGoogleEnum(v);
}

/** `segments.search_term_match_type` and `keyword.match_type`, with Google's close variants said plainly. */
const MATCH_WORDS: Record<string, string> = {
  NEAR_EXACT: "Exact (close variant)",
  NEAR_PHRASE: "Phrase (close variant)",
  AI_MAX: "AI Max",
  PERFORMANCE_MAX: "Performance Max",
};

export function googleMatchTypeLabel(v: string | undefined): string {
  return v && Object.prototype.hasOwnProperty.call(MATCH_WORDS, v) ? MATCH_WORDS[v]! : humanizeGoogleEnum(v);
}

/** `search_term_view.status`: whether the term is already one of the account's keywords. */
const TERM_WORDS: Record<string, string> = {
  ADDED: "Added as a keyword",
  EXCLUDED: "Excluded",
  ADDED_EXCLUDED: "Added and excluded",
  NONE: "Not added",
};

export function googleSearchTermStatusLabel(v: string | undefined): string {
  return v && Object.prototype.hasOwnProperty.call(TERM_WORDS, v) ? TERM_WORDS[v]! : humanizeGoogleEnum(v);
}

// ── Numbers ──────────────────────────────────────────────────────────────

const COUNT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const CONVERSIONS = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatGoogleCount(n: number | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? COUNT.format(n) : "—";
}

/** Google counts fractional conversions (data-driven attribution), so two decimals. */
export function formatGoogleConversions(n: number | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? CONVERSIONS.format(n) : "—";
}

/** Micros of the account's currency, as money. ★Absent is a dash, never 0. */
export function formatGoogleMicros(micros: number | undefined, currency: string | undefined): string {
  if (typeof micros !== "number" || !Number.isFinite(micros)) return "—";
  return formatGoogleMoney(micros / 1_000_000, currency);
}

// ── Columns ──────────────────────────────────────────────────────────────

export interface GoogleReportColumn<R> {
  key: string;
  header: string;
  /** RMF marks it required: always shown. */
  rmfRequired: boolean;
  numeric: boolean;
  cell: (row: R, currency: string | undefined) => string;
}

type Columns = { [K in GoogleReportKey]: ReadonlyArray<GoogleReportColumn<GoogleReportRows[K]>> };

const col = <R>(key: string, header: string, rmfRequired: boolean, numeric: boolean, cell: GoogleReportColumn<R>["cell"]): GoogleReportColumn<R> => ({
  key,
  header,
  rmfRequired,
  numeric,
  cell,
});

function metricColumns<R extends { clicks: number; impressions: number; costMicros: number }>(): GoogleReportColumn<R>[] {
  return [
    col<R>("clicks", "Clicks", true, true, (r) => formatGoogleCount(r.clicks)),
    col<R>("impressions", "Impressions", true, true, (r) => formatGoogleCount(r.impressions)),
    col<R>("costMicros", "Cost", true, true, (r, cur) => formatGoogleMicros(r.costMicros, cur)),
  ];
}

const conversions = <R extends { conversions: number }>() =>
  col<R>("conversions", GOOGLE_ADS_CONVERSIONS_LABEL, true, true, (r) => formatGoogleConversions(r.conversions));
const allConversions = <R extends { allConversions: number }>() =>
  col<R>("allConversions", GOOGLE_ADS_ALL_CONVERSIONS_LABEL, true, true, (r) => formatGoogleConversions(r.allConversions));
const status = <R extends { status?: string }>() => col<R>("status", "Status", true, false, (r) => humanizeGoogleEnum(r.status));

export const GOOGLE_REPORT_COLUMNS: Columns = {
  account: [
    col<GoogleAccountReportRow>("name", "Account", false, false, (r) => r.name ?? r.customerId ?? "—"),
    ...metricColumns<GoogleAccountReportRow>(),
    conversions<GoogleAccountReportRow>(),
    allConversions<GoogleAccountReportRow>(),
  ],
  campaigns: [
    col<GoogleCampaignReportRow>("name", "Campaign", false, false, (r) => r.name ?? r.campaignId ?? "—"),
    col<GoogleCampaignReportRow>("channelType", "Type", false, false, (r) => googleReportChannelLabel(r.channelType)),
    status<GoogleCampaignReportRow>(),
    col<GoogleCampaignReportRow>("biddingStrategyType", "Bidding", false, false, (r) => googleBiddingTypeLabel(r.biddingStrategyType)),
    ...metricColumns<GoogleCampaignReportRow>(),
    conversions<GoogleCampaignReportRow>(),
    allConversions<GoogleCampaignReportRow>(),
  ],
  ads: [
    col<GoogleAdReportRow>("ad", "Ad", false, false, (r) => {
      // ★NO TYPE IS "Ad", never "— #123" (review round 1).
      const type = r.adType ? humanizeGoogleEnum(r.adType) : r.adId ? "Ad" : "—";
      return r.adId ? `${type} #${r.adId}` : type;
    }),
    col<GoogleAdReportRow>("adGroupName", "Ad group", false, false, (r) => r.adGroupName ?? "—"),
    col<GoogleAdReportRow>("campaignName", "Campaign", false, false, (r) => r.campaignName ?? "—"),
    status<GoogleAdReportRow>(),
    ...metricColumns<GoogleAdReportRow>(),
    conversions<GoogleAdReportRow>(),
  ],
  keywords: [
    col<GoogleKeywordReportRow>("text", "Keyword", false, false, (r) => r.text ?? "—"),
    col<GoogleKeywordReportRow>("matchType", "Match type", false, false, (r) => googleMatchTypeLabel(r.matchType)),
    col<GoogleKeywordReportRow>("adGroupName", "Ad group", false, false, (r) => r.adGroupName ?? "—"),
    col<GoogleKeywordReportRow>("campaignName", "Campaign", false, false, (r) => r.campaignName ?? "—"),
    status<GoogleKeywordReportRow>(),
    ...metricColumns<GoogleKeywordReportRow>(),
    conversions<GoogleKeywordReportRow>(),
    col<GoogleKeywordReportRow>("firstPageCpcMicros", "First-page bid estimate", true, true, (r, cur) => formatGoogleMicros(r.firstPageCpcMicros, cur)),
    col<GoogleKeywordReportRow>("firstPositionCpcMicros", "First-position bid estimate", true, true, (r, cur) =>
      formatGoogleMicros(r.firstPositionCpcMicros, cur),
    ),
  ],
  "search-terms": [
    col<GoogleSearchTermReportRow>("searchTerm", "Search term", true, false, (r) => r.searchTerm ?? "—"),
    col<GoogleSearchTermReportRow>("matchType", "Match type", true, false, (r) => googleMatchTypeLabel(r.matchType)),
    col<GoogleSearchTermReportRow>("termStatus", "Keyword", false, false, (r) => googleSearchTermStatusLabel(r.termStatus)),
    col<GoogleSearchTermReportRow>("adGroupName", "Ad group", false, false, (r) => r.adGroupName ?? "—"),
    col<GoogleSearchTermReportRow>("campaignName", "Campaign", false, false, (r) => r.campaignName ?? "—"),
    ...metricColumns<GoogleSearchTermReportRow>(),
  ],
  "bidding-strategies": [
    col<GoogleBiddingStrategyReportRow>("name", "Strategy", false, false, (r) => r.name ?? r.strategyId ?? "—"),
    col<GoogleBiddingStrategyReportRow>("type", "Type", true, false, (r) => googleBiddingTypeLabel(r.type)),
    status<GoogleBiddingStrategyReportRow>(),
    ...metricColumns<GoogleBiddingStrategyReportRow>(),
    // ★NO CLICKS, NO AVERAGE; NO CONVERSIONS, NO COST PER ONE (review round 1):
    //  Google omits both then and the api reads absent as 0, which would print
    //  "$0.00" — free conversions that never happened. A dash says none.
    col<GoogleBiddingStrategyReportRow>("averageCpcMicros", "Average CPC", true, true, (r, cur) =>
      r.clicks > 0 ? formatGoogleMicros(r.averageCpcMicros, cur) : "—",
    ),
    conversions<GoogleBiddingStrategyReportRow>(),
    col<GoogleBiddingStrategyReportRow>("costPerConversionMicros", "Cost per Google Ads conversion", true, true, (r, cur) =>
      r.conversions > 0 ? formatGoogleMicros(r.costPerConversionMicros, cur) : "—",
    ),
  ],
};

// ── Empty, and not served ────────────────────────────────────────────────

/**
 * What an empty table means. ★IT DEPENDS ON THE TABLE (api review round 1):
 * Google returns zero-metric rows when a report is not segmented ("filtering
 * on a core date segment in WHERE without selecting it in SELECT does not
 * segment the report"), so the account, campaign, ad, keyword and bidding
 * tables list what EXISTS, idle or not — empty means there is none. The
 * search-term table is segmented by match type, and "rows whose selected
 * metrics are all zero won't be returned when segmenting": empty there means
 * nothing served. Never "no data", and never an error.
 */
export function googleReportEmptySentence(report: GoogleReportKey, account: { testAccount: boolean }): string {
  // ★THE TEST-ACCOUNT REASON ONLY FOR A TEST ACCOUNT (review round 2): it is
  //  the reason there, and no reason at all for a live one.
  const test = account.testAccount ? " This is a test account, and a test account never serves ads." : "";
  switch (report) {
    case "account":
      // ★NOT THE DATES (round 2): an unsegmented customer query answers its row
      //  for any range, so no row is a fault to retry, not a range to change.
      return "Google Ads returned no row for this account. Try again in a moment; if it keeps happening, check the account in Google Ads.";
    case "campaigns":
      return "This Google Ads account has no campaigns yet.";
    case "ads":
      return "This Google Ads account has no ads yet.";
    case "keywords":
      return "This Google Ads account has no keywords yet. Keywords belong to Search campaigns.";
    case "search-terms":
      return `No searches showed your ads in these dates. Search terms appear once a Search campaign has served.${test}`;
    case "bidding-strategies":
      return "This account has no portfolio bidding strategies. Campaigns using their own strategy are in the Campaigns table.";
  }
}

/** The account row is there but shows no activity at all: it has not served in these dates. */
export function googleAccountHasNotServed(rows: ReadonlyArray<Pick<GoogleAccountReportRow, "impressions" | "clicks" | "costMicros">>): boolean {
  return rows.every((r) => r.impressions === 0 && r.clicks === 0 && r.costMicros === 0);
}

export function googleAccountNotServedNote(account: { testAccount: boolean }): string {
  return account.testAccount
    ? "This is a test account, and a test account never serves ads, so every figure is zero."
    : "This account has not served an ad in these dates, so every figure is zero.";
}

/**
 * More rows existed than the api returns. ★THE COUNT IS THE ROWS SHOWN, not a
 * copy of the api's limit, and it promises no way to page (review round 1):
 * narrowing the dates re-ranks, it does not reveal the rest.
 */
export function googleReportTruncatedNote(shown: number): string {
  return `Showing the ${formatGoogleCount(shown)} costliest rows. There are more: Google Ads has the full list.`;
}

// ── Dates ────────────────────────────────────────────────────────────────

/**
 * A custom range's problem, or null. Days are the account's (Google reads a
 * range in the account's time zone), which b2c does not know. The last day
 * allowed is `googleReportLatestDay`'s. Google's 37-month lookback is the
 * api's sentence.
 */
export function googleReportRangeProblem(from: string, to: string, latestDay: string): string | null {
  if (!from || !to) return "Choose a start and an end date.";
  if (from > to) return "The start date is after the end date.";
  if (to > latestDay) return "The end date is in the future.";
  return null;
}

/**
 * The last day a range may end on: ★UTC'S TOMORROW, THE API'S OWN BOUND
 * (review round 2). Round 1 used the browser's tomorrow, which ran a day past
 * the api's every night east of UTC (IST, 00:00–05:30), so the form offered a
 * day the api refused. An account at most a day ahead of UTC is on that day.
 */
export function googleReportLatestDay(now: Date): string {
  return new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
}

/** Which days a table covers, said from the api's answer — never from the inputs, which may hold days not yet shown. */
export function googleReportRangeSentence(range: GoogleReportRange): string {
  if ("preset" in range) return "Showing the last 30 days, not including today.";
  return range.from === range.to ? `Showing ${range.from}.` : `Showing ${range.from} to ${range.to}.`;
}

// ── Errors ───────────────────────────────────────────────────────────────

/** The report's failure, as a sentence: the panel's own rule, plus the account-not-shared case. */
export function googleReportErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.code === "AD_ACCOUNT_NOT_ALLOWED") {
    return "This Google Ads account isn't on your PeakHour connection. Reconnect Google Ads and share this account, then try again.";
  }
  return googleAdsErrorMessage(err, "Google Ads didn't return this report. Try again in a moment.");
}
