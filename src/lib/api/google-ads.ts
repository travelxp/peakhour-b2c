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
 *   - it is created PAUSED, and activation is the launch (charged once,
 *     `google.campaign_launched`);
 *   - a create Google did not confirm answers 202 `pending` — "don't create
 *     it again" — and is read back by the hourly re-drive.
 *
 * ⏸SEARCH ONLY: the api creates Responsive Search Ad campaigns and nothing
 * else, so nothing here offers another campaign type.
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
  /** Always `SEARCH`: the only shape the api creates. */
  channelType?: "SEARCH";
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

export interface GoogleCreateCampaignInput {
  adAccountId: string;
  name: string;
  dailyBudget: { amount: number; currencyCode: string };
  searchAd: GoogleSearchAdInput;
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
  /** With an id: choose that action. Without: find or CREATE "Peakhour offline purchases" (a write to the merchant's Google Ads account). */
  setConversionAction: (adAccountId: string, conversionActionId?: string) =>
    api.put<GoogleConversionActionChosen>(googleAdsUrl("/v1/google/ads/conversion-action"), {
      adAccountId,
      ...(conversionActionId !== undefined ? { conversionActionId } : {}),
    }),
};
