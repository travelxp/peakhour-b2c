import { api } from "@/lib/api";
import { metaAdsUrl } from "@/lib/meta-ads-surface";

/**
 * ★★M-16 — the Meta ads client, and the only b2c file that names a Meta ads
 * route.
 *
 * ⚠️EVERY URL IS BUILT BY `metaAdsUrl` FROM A MANAGED TEMPLATE, never written
 * as a path of its own. That is M-13's contract (`lib/meta-ads-surface.ts`):
 * two of the api's Meta routes were a passthrough that created a campaign at
 * Meta and wrote nothing here, so `ad-campaign-monitor`, the spend caps and the
 * kill switch could not see it. `metaAdsUrl`'s parameter is the managed-route
 * union, so a route off that list does not type-check, and it throws at runtime
 * for one smuggled past the type.
 *
 * ⏸CAMPAIGN CREATION IS DELIBERATELY NOT HERE. `POST /campaigns` is managed and
 * exists, but a Meta campaign is three levels (campaign → ad set → ad) plus a
 * special-ad-category declaration and a creative, and no row has designed that
 * flow. A create button that makes an empty campaign shell is worse than none.
 * This panel reads, pauses, activates and chooses the conversions dataset.
 *
 * ★Each list read returns `truncated` (api#1409): the route follows Meta's cursor
 * and says whether it stopped before the end. The panel reads that flag — never
 * a count.
 *
 * Types mirror `peakhour-api/src/v1/helpers/meta-ads.ts`, including its rule
 * that **an insights figure that is absent is one Meta did not report — never
 * zero**.
 */

export interface MetaAdAccount {
  /** Graph id, `act_…` — what every other route takes as `adAccountId`. */
  id: string;
  name: string;
  accountId: string;
  currency: string;
  timezone: string;
  accountStatus: number;
  businessName?: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  /** Minor units of the ad account's currency, as Meta sends them — a STRING. */
  dailyBudget?: string;
  lifetimeBudget?: string;
  startTime?: string;
  stopTime?: string;
  createdTime: string;
  updatedTime: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaignId: string;
  status: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
  billingEvent: string;
  optimizationGoal: string;
  startTime?: string;
  endTime?: string;
}

export interface MetaAd {
  id: string;
  name: string;
  adsetId: string;
  status: string;
  creativeId: string;
  createdTime: string;
}

/** Every figure optional: absent means META DID NOT REPORT IT, never zero. */
export interface MetaAdInsights {
  campaignId: string;
  impressions?: number;
  reach?: number;
  clicks?: number;
  spend?: number;
  cpc?: number;
  cpm?: number;
  ctr?: number;
  dateStart: string;
  dateStop: string;
}

/** A Meta dataset (the node Meta still calls `AdsPixel`) — where conversions go. */
export interface MetaDataset {
  id: string;
  name: string;
  /** Only an explicit `true` means unavailable; absent is "Meta did not say". */
  isUnavailable?: boolean;
  lastFiredTime?: string;
  creationTime?: string;
  ownerBusinessId?: string;
}

/** What this business sends conversions to. `null` is the ordinary unset state. */
export interface MetaDatasetSelection {
  id: string;
  adAccountId: string;
  name?: string;
}

/** The statuses a merchant may set here. `DELETED` is deliberately not offered. */
export type MetaSettableStatus = "ACTIVE" | "PAUSED";

export type MetaAdsLevel = "campaign" | "adSet" | "ad";

/**
 * ★The api caps one insights request at 25 campaign ids
 * (`MAX_ANALYTICS_CAMPAIGNS`), because each id costs two serial Graph calls.
 * Pinned against the api's source in `meta-ads-view.test.ts`.
 */
export const META_ANALYTICS_BATCH = 25;

export const metaAdsApi = {
  listAdAccounts: () =>
    api.get<{ accounts: MetaAdAccount[] }>(metaAdsUrl("/v1/meta/ads/ad-accounts")),

  listCampaigns: (adAccountId: string) =>
    api.get<{ campaigns: MetaCampaign[]; truncated: boolean }>(metaAdsUrl("/v1/meta/ads/campaigns"), {
      adAccountId,
    }),

  listAdSets: (adAccountId: string, campaignId: string) =>
    api.get<{ adSets: MetaAdSet[]; truncated: boolean }>(metaAdsUrl("/v1/meta/ads/ad-sets"), {
      adAccountId,
      campaignId,
    }),

  listAds: (adAccountId: string, adSetId: string) =>
    api.get<{ ads: MetaAd[]; truncated: boolean }>(metaAdsUrl("/v1/meta/ads/ads"), { adAccountId, adSetId }),

  /**
   * One request per 25 ids, merged. ⚠️A failed batch fails the whole read
   * rather than returning the batches that worked: a KPI total over half the
   * campaigns, shown without saying so, is a smaller number that looks true.
   */
  insights: async (campaignIds: readonly string[], startDate: string, endDate: string) => {
    const batches: string[][] = [];
    for (let i = 0; i < campaignIds.length; i += META_ANALYTICS_BATCH) {
      batches.push(campaignIds.slice(i, i + META_ANALYTICS_BATCH));
    }
    const answers = await Promise.all(
      batches.map((ids) =>
        api.get<{ insights: MetaAdInsights[] }>(metaAdsUrl("/v1/meta/ads/analytics"), {
          campaignIds: ids.join(","),
          startDate,
          endDate,
        }),
      ),
    );
    return answers.flatMap((a) => a.insights);
  },

  setStatus: (level: MetaAdsLevel, id: string, status: MetaSettableStatus) => {
    const url =
      level === "campaign"
        ? metaAdsUrl("/v1/meta/ads/campaigns/:campaignId/status", { campaignId: id })
        : level === "adSet"
          ? metaAdsUrl("/v1/meta/ads/ad-sets/:adSetId/status", { adSetId: id })
          : metaAdsUrl("/v1/meta/ads/ads/:adId/status", { adId: id });
    return api.patch<{ status: MetaSettableStatus }>(url, { status });
  },

  listDatasets: (adAccountId: string) =>
    api.get<{ datasets: MetaDataset[]; selected: MetaDatasetSelection | null }>(
      metaAdsUrl("/v1/meta/ads/datasets"),
      { adAccountId },
    ),

  getSelectedDataset: () =>
    api.get<{ selected: MetaDatasetSelection | null }>(
      metaAdsUrl("/v1/meta/ads/datasets/selected"),
    ),

  selectDataset: (adAccountId: string, datasetId: string) =>
    api.put<{ selected: MetaDatasetSelection | null }>(
      metaAdsUrl("/v1/meta/ads/datasets/selected"),
      { adAccountId, datasetId },
    ),
};
