import { api } from "@/lib/api";

/**
 * LinkedIn Ads Manager client (G1) — the MANAGED campaign surface.
 *
 * These endpoints operate on Peakhour's own `ad_campaigns` rows (the
 * execution-loop spine), not raw LinkedIn ids: /boost creates the real
 * LinkedIn campaign group + campaign + creative via the api-side ads
 * adapter — always in LinkedIn's NON-SERVING draft state. The only
 * spend-enabling action anywhere is `setStatus(id, "active")`, which
 * the UI gates behind an explicit confirm.
 */

export type ManagedCampaignStatus =
  | "draft"
  | "review"
  | "active"
  | "paused"
  | "completed"
  | "archived";

export type BoostObjective =
  | "engagement"
  | "brand_awareness"
  | "website_traffic"
  | "lead_generation";

export interface ManagedCampaignPerformance {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpc?: number;
  cpa?: number;
  lastUpdated?: string;
}

export interface ManagedCampaign {
  _id: string;
  platform: string;
  platformCampaignId?: string;
  platformCampaignGroupId?: string;
  adAccountId?: string;
  /** Organic post this campaign sponsors (Boost-to-Campaign). */
  sourcePostUrn?: string;
  name: string;
  objective?: BoostObjective;
  status: ManagedCampaignStatus;
  /** ISO-4217 — matches the ad account's billing currency. */
  currency?: string;
  budget?: { daily?: number; total?: number; spent: number };
  schedule?: {
    launchedAt?: string;
    activatedAt?: string;
    endsAt?: string;
    durationDays?: number;
  };
  performance?: ManagedCampaignPerformance;
  createdAt: string;
  updatedAt?: string;
}

export interface BoostCampaignInput {
  /** LinkedIn share/ugcPost URN of the organic post to sponsor. */
  postUrn: string;
  name: string;
  objective: BoostObjective;
  dailyBudget: number;
  /** Must match the ad account's billing currency — the server rejects
   *  a mismatch with code CURRENCY_MISMATCH naming the expected code. */
  currencyCode: string;
  durationDays: number;
}

export const linkedInAdsApi = {
  /** Local managed campaigns for the active business (newest first). */
  managedCampaigns: () =>
    api.get<{ campaigns: ManagedCampaign[] }>(
      "/v1/linkedin/ads/managed-campaigns",
    ),

  /**
   * Boost-to-Campaign: sponsor an existing organic post. Creates the
   * REAL LinkedIn artefacts as a non-serving draft (group PAUSED +
   * campaign DRAFT + creative PAUSED) and persists the managed row.
   * Nothing spends until the campaign is explicitly activated.
   */
  boost: (body: BoostCampaignInput) =>
    api.post<{ campaign: ManagedCampaign }>("/v1/linkedin/ads/boost", body),

  /** Pull live analytics into the row; returns fresh performance. */
  syncCampaign: (id: string) =>
    api.post<{ performance: ManagedCampaignPerformance }>(
      `/v1/linkedin/ads/managed-campaigns/${id}/sync`,
    ),

  /**
   * Activate / pause / archive — platform first, then locally.
   * "active" is the ONLY call that can start spend; callers must gate
   * it behind an explicit user confirm. Invalid transitions 409 with
   * code INVALID_TRANSITION.
   */
  setStatus: (id: string, status: "active" | "paused" | "archived") =>
    api.patch<{ campaignId: string; status: string }>(
      `/v1/linkedin/ads/managed-campaigns/${id}/status`,
      { status },
    ),
};
