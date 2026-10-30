import { api } from "@/lib/api";
import { googleAdsUrl } from "@/lib/google-ads-surface";

/**
 * ★★G-15 — the Google Ads client, and the only b2c file that names a Google
 * ads route. Every URL is built by `googleAdsUrl` from a managed template
 * (`lib/google-ads-surface.ts`).
 *
 * Types mirror peakhour-api `src/v1/routes/google-ads/index.ts` (G-09):
 *   - a campaign is OUR row (`id` is `ad_campaigns._id`), listed locally like
 *     LinkedIn's, not read live from Google;
 *   - it is created PAUSED, and activation is the launch (nothing is charged
 *     for it: the engine bills a verified outcome);
 *   - a create Google did not confirm answers 202 `pending` — "don't create
 *     it again" — and is read back by the hourly re-drive.
 *
 * ★SEARCH, PERFORMANCE MAX AND YOUTUBE VIDEO (DEMAND GEN) ONLY (G19, G20):
 * the three types the api creates; nothing here offers another. YouTube video
 * ads are Demand Gen campaigns: Google's API cannot create the older type.
 */

export interface GoogleAdAccount {
  /** The 10-digit customer id, dashes removed. */
  id: string;
  name: string;
  /** The account's billing currency, when the connection recorded it. */
  currencyCode?: string;
  testAccount: boolean;
}

/** `ad_campaigns.platformCreate.state` — whether Google has confirmed the create. */
export type GoogleCreateState = "sending" | "outcome_unknown" | "created" | "adopted" | "not_created";

export interface GoogleCampaign {
  /** Our row's id — what the status route takes. */
  id: string;
  name: string;
  /** `draft` (created PAUSED, never activated), `active`, `paused`, `completed`, `archived`. */
  status: string;
  /** The campaign type the api created: Search (G-04), Performance Max (G19) or YouTube video, Demand Gen (G20). */
  channelType?: GoogleChannelType;
  /** G20, Demand Gen only: where its ads may show, and whether Google confirmed it (mongodb mig 643). */
  channelControls?: GoogleChannelControls;
  platformCampaignId?: string;
  adAccountId?: string;
  currency?: string;
  budget?: { daily?: number; total?: number; spent?: number };
  schedule?: { launchedAt?: string; activatedAt?: string; endsAt?: string };
  createState?: GoogleCreateState;
  /** A create a guardrail refused before anything was sent (e.g. `ASSET_NOT_APPROVED`). */
  refusedCode?: string;
  createdAt: string;
}

export interface GoogleSearchAdInput {
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
}

/** The Google campaign types the api creates (peakhour-api `routes/google-ads`, G19, G20). */
export type GoogleChannelType = "SEARCH" | "PERFORMANCE_MAX" | "DEMAND_GEN";

/** G20 — the YouTube placements a YouTube video ad may use (Google's `selected_channels` names). */
export type GoogleYoutubeChannel = "youtube_in_stream" | "youtube_in_feed" | "youtube_shorts";

/** G20 — a Demand Gen ad group's channels as the api stored them; `targetingApplied` is Google's confirmation. */
export interface GoogleChannelControls {
  /**
   * Google's channel ids. Typed loosely on purpose: Google may report a channel Peakhour never asks for, and
   * `googleChannelControlsSentence` says those as "other Google placements", never by id.
   */
  selected: string[];
  targetingApplied: boolean;
}

/**
 * G20 — a YouTube video ad (Demand Gen). Videos are YouTube links or ids the
 * merchant already has on YouTube; Peakhour never uploads one. Logos are
 * public https URLs.
 */
export interface GoogleDemandGenInput {
  videos: string[];
  headlines: string[];
  longHeadlines: string[];
  descriptions: string[];
  businessName: string;
  finalUrl: string;
  logos: string[];
  channels: GoogleYoutubeChannel[];
}

/**
 * G19 — a Performance Max campaign's assets: Google assembles its ads from
 * these. Images are public https URLs, one per line in the form.
 */
export interface GooglePmaxInput {
  headlines: string[];
  longHeadlines: string[];
  descriptions: string[];
  businessName: string;
  finalUrl: string;
  images: { marketing: string[]; square: string[]; logos: string[] };
}

export interface GoogleCreateCampaignInput {
  adAccountId: string;
  name: string;
  dailyBudget: { amount: number; currencyCode: string };
  /** Absent is Search. */
  channelType?: GoogleChannelType;
  /** A Search campaign's ad. */
  searchAd?: GoogleSearchAdInput;
  /** A Performance Max campaign's assets. */
  performanceMax?: GooglePmaxInput;
  /** A YouTube video ad (Demand Gen). */
  demandGen?: GoogleDemandGenInput;
  /** ISO datetime; the monitor completes the campaign there. */
  endsAt?: string;
  /** The merchant's "not political" tick (EU political-advertising declaration). */
  notPolitical?: boolean;
}

/** 200: created PAUSED. 202: `pending` — Google did not confirm; don't create it again. */
export interface GoogleCreateCampaignResult {
  managedCampaignId: string;
  platformCampaignId?: string;
  status?: "PAUSED";
  pending?: boolean;
  message?: string;
}

/** One enabled import-from-clicks conversion action the account's conversion customer owns. */
export interface GoogleConversionActionOption {
  id: string;
  name: string;
  category?: string;
}

/** What was chosen for one advertiser account (api `googleConversionAction`). */
export interface GoogleConversionActionSelection {
  adAccountId: string;
  conversionActionId: string;
  conversionCustomerId: string;
  name?: string;
}

/** GET /conversion-action. `selectedIsLive` is null when nothing is selected. */
export interface GoogleConversionActionState {
  conversionCustomerId: string;
  actions: GoogleConversionActionOption[];
  selected: GoogleConversionActionSelection | null;
  selectedIsLive: boolean | null;
}

/** PUT /conversion-action: `created` is true when Peakhour made the action in the merchant's Google Ads account. */
export interface GoogleConversionActionChosen {
  created: boolean;
  selected: GoogleConversionActionSelection | null;
  /** Whether the action can carry the bidding signal. `primaryForGoal: false` only for an action the merchant chose that is not a primary goal. */
  setup: { primaryForGoal: boolean; hasValueSettings: boolean };
}

/** What the conversion action is for (C3): a value mandate uses the uploaded value; a count mandate counts. */
export interface GoogleConversionSignal {
  /** ISO 4217. */
  currency: string;
  optimizeFor: "count" | "value";
  defaultValue?: number;
}

export type GoogleSettableStatus = "ACTIVE" | "PAUSED";

// ── G-14d: Google's own reports (RMF R.10, R.20, R.40, R.50, R.70, R.130) ──

/** The six reports, as the api names them (peakhour-api `services/ads/google-reports.ts`). */
export type GoogleReportKey = "account" | "campaigns" | "ads" | "keywords" | "search-terms" | "bidding-strategies";

/** No range is Google's own last 30 days (not including today, in the account's zone); a custom range is inclusive. */
export type GoogleReportRange = { preset: "LAST_30_DAYS" } | { from: string; to: string };

/** Every table's metrics. Money is in MICROS of the account's currency, as Google answers it. */
interface GoogleReportBaseRow {
  clicks: number;
  impressions: number;
  costMicros: number;
}
export interface GoogleAccountReportRow extends GoogleReportBaseRow {
  customerId?: string;
  name?: string;
  currencyCode?: string;
  conversions: number;
  allConversions: number;
}
export interface GoogleCampaignReportRow extends GoogleReportBaseRow {
  campaignId?: string;
  name?: string;
  /** Google's `campaign.status`: ENABLED, PAUSED or REMOVED. */
  status?: string;
  channelType?: string;
  biddingStrategyType?: string;
  conversions: number;
  allConversions: number;
}
export interface GoogleAdReportRow extends GoogleReportBaseRow {
  adId?: string;
  adType?: string;
  status?: string;
  adGroupId?: string;
  adGroupName?: string;
  campaignName?: string;
  conversions: number;
}
export interface GoogleKeywordReportRow extends GoogleReportBaseRow {
  criterionId?: string;
  text?: string;
  matchType?: string;
  status?: string;
  adGroupId?: string;
  adGroupName?: string;
  campaignName?: string;
  conversions: number;
  /** Absent when Google gave no estimate — never read as 0. */
  firstPageCpcMicros?: number;
  firstPositionCpcMicros?: number;
}
export interface GoogleSearchTermReportRow extends GoogleReportBaseRow {
  searchTerm?: string;
  /** `segments.search_term_match_type`, Google's near variants included. */
  matchType?: string;
  termStatus?: string;
  adGroupId?: string;
  adGroupName?: string;
  campaignName?: string;
}
export interface GoogleBiddingStrategyReportRow extends GoogleReportBaseRow {
  strategyId?: string;
  name?: string;
  type?: string;
  /** ENABLED or REMOVED: a portfolio strategy has no paused state. */
  status?: string;
  conversions: number;
  costPerConversionMicros: number;
  averageCpcMicros: number;
}

export interface GoogleReportRows {
  account: GoogleAccountReportRow;
  campaigns: GoogleCampaignReportRow;
  ads: GoogleAdReportRow;
  keywords: GoogleKeywordReportRow;
  "search-terms": GoogleSearchTermReportRow;
  "bidding-strategies": GoogleBiddingStrategyReportRow;
}

/** GET /reports/:report. `truncated`: more rows exist than shown (the costliest are shown). */
export interface GoogleReport<K extends GoogleReportKey = GoogleReportKey> {
  adAccountId: string;
  report: K;
  rmf: string;
  range: GoogleReportRange;
  rows: Array<GoogleReportRows[K]>;
  truncated: boolean;
}

export const googleAdsApi = {
  listAdAccounts: () => api.get<{ adAccounts: GoogleAdAccount[] }>(googleAdsUrl("/v1/google/ads/ad-accounts")),
  listCampaigns: () => api.get<{ campaigns: GoogleCampaign[] }>(googleAdsUrl("/v1/google/ads/campaigns")),
  createCampaign: (input: GoogleCreateCampaignInput) =>
    api.post<GoogleCreateCampaignResult>(googleAdsUrl("/v1/google/ads/campaigns"), input),
  setStatus: (id: string, status: GoogleSettableStatus) =>
    api.patch<{ managedCampaignId: string; status: GoogleSettableStatus }>(
      googleAdsUrl("/v1/google/ads/campaigns/:id/status", { id }),
      { status },
    ),
  getConversionAction: (adAccountId: string) =>
    api.get<GoogleConversionActionState>(googleAdsUrl("/v1/google/ads/conversion-action") + `?adAccountId=${encodeURIComponent(adAccountId)}`),
  /**
   * With an id: choose that action (read, never changed; no signal needed). Without: find or CREATE "Peakhour offline
   * purchases" as a primary goal with value settings (a write to the merchant's Google Ads account; the signal is required).
   */
  setConversionAction: (adAccountId: string, choice: { signal: GoogleConversionSignal } | { conversionActionId: string }) =>
    api.put<GoogleConversionActionChosen>(googleAdsUrl("/v1/google/ads/conversion-action"), { adAccountId, ...choice }),
  /** G-14d: one report, read live from Google (one operation). No `from`/`to` is the last 30 days. */
  getReport: (report: GoogleReportKey, adAccountId: string, range?: { from: string; to: string }) =>
    api.get<GoogleReport>(googleAdsUrl("/v1/google/ads/reports/:report", { report }) + "?" + googleReportQuery(adAccountId, range)),
};

/** The report's query string: the account, and a custom range when there is one. */
export function googleReportQuery(adAccountId: string, range?: { from: string; to: string }): string {
  const q = new URLSearchParams({ adAccountId });
  if (range) {
    q.set("from", range.from);
    q.set("to", range.to);
  }
  return q.toString();
}
