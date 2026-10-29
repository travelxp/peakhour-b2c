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
};
