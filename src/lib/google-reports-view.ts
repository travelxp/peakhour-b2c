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
    col<GoogleAdReportRow>("ad", "Ad", false, false, (r) => `${humanizeGoogleEnum(r.adType)}${r.adId ? ` #${r.adId}` : ""}`),
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
    col<GoogleBiddingStrategyReportRow>("averageCpcMicros", "Average CPC", true, true, (r, cur) => formatGoogleMicros(r.averageCpcMicros, cur)),
    conversions<GoogleBiddingStrategyReportRow>(),
    col<GoogleBiddingStrategyReportRow>("costPerConversionMicros", "Cost per Google Ads conversion", true, true, (r, cur) =>
      formatGoogleMicros(r.costPerConversionMicros, cur),
    ),
  ],
};

/** A stable React key for a row: the ids Google answered, else its position. */
export function googleReportRowKey(report: GoogleReportKey, row: GoogleReportRows[GoogleReportKey], index: number): string {
  const r = row as unknown as Record<string, unknown>;
  const parts =
    report === "account"
      ? [r.customerId]
      : report === "campaigns"
        ? [r.campaignId]
        : report === "ads"
          ? [r.adGroupId, r.adId]
          : report === "keywords"
            ? [r.adGroupId, r.criterionId]
            : report === "search-terms"
              ? [r.adGroupId, r.searchTerm, r.matchType]
              : [r.strategyId];
  // ★THE POSITION TOO: a search term can repeat in an ad group under another
  //  match type, and a row missing an id must not collide with another.
  return `${parts.map((p) => (p === undefined ? "" : String(p))).join("~")}#${index}`;
}

// ── Empty, and not served ────────────────────────────────────────────────

/**
 * ★A TABLE WITH NO ROWS IS AN ACCOUNT THAT HAS NOT SERVED (in these dates),
 * said so — not "no data" and not an error. Google answers a row only for
 * what served, or for an entity that exists; a test account never serves.
 */
export function googleReportEmptySentence(report: GoogleReportKey): string {
  switch (report) {
    case "account":
      return "Google Ads has nothing for this account in these dates. An account shows numbers once its ads have served; a test account never serves.";
    case "campaigns":
      return "This Google Ads account has no campaigns with activity in these dates.";
    case "ads":
      return "No ads in this account served in these dates.";
    case "keywords":
      return "No keywords in this account have activity in these dates. Keywords belong to Search campaigns.";
    case "search-terms":
      return "No searches showed your ads in these dates. Search terms appear once a Search campaign has served.";
    case "bidding-strategies":
      return "This account has no portfolio bidding strategies with activity in these dates. Campaigns using their own strategy are in the Campaigns table.";
  }
}

/** The account row is there but shows no activity at all: it has not served in these dates. */
export function googleAccountHasNotServed(rows: ReadonlyArray<Pick<GoogleAccountReportRow, "impressions" | "clicks" | "costMicros">>): boolean {
  return rows.every((r) => r.impressions === 0 && r.clicks === 0 && r.costMicros === 0);
}

export const GOOGLE_ACCOUNT_NOT_SERVED_NOTE =
  "This account has not served an ad in these dates, so every figure is zero. A test account never serves.";

/** More rows existed than the api returns. */
export const GOOGLE_REPORT_TRUNCATED_NOTE = "Showing the first 1,000 rows, costliest first. Narrow the dates to see the rest.";

// ── Dates ────────────────────────────────────────────────────────────────

/**
 * A custom range's problem, or null. Days are the account's (Google reads a
 * range in the account's time zone); `today` is the browser's day, the
 * closest b2c knows. Google's 37-month lookback is the api's sentence.
 */
export function googleReportRangeProblem(from: string, to: string, today: string): string | null {
  if (!from || !to) return "Choose a start and an end date.";
  if (from > to) return "The start date is after the end date.";
  if (to > today) return "The end date is in the future.";
  return null;
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
