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
 * ★CAMPAIGN CREATION IS HERE (MR-F1) AS THE WHOLE THREE-LEVEL FLOW, not as a
 * campaign shell: `createCampaign` → `createAdSet` → `createAd`, always PAUSED,
 * with `launchCampaign` below owning the order and the clean-up. A create that
 * stops after level one would leave exactly the empty shell this note used to
 * refuse to build.
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

/** An ad account the business has enabled, as the api stores it. `missing`: the live Meta list no longer returns it. */
export interface MetaEnabledAdAccount {
  id: string;
  name?: string;
  currency?: string;
  status?: number;
  missing: boolean;
}

/**
 * `GET /ad-accounts`: every account the login reaches (it lists other businesses' too), and THIS business's own: the
 * enabled ones that are still on the login (`enabledIds`), the default among them, and every enabled one with a
 * `missing` flag. Every create is refused for any account not in `enabledIds`.
 */
export interface MetaAdAccountsResponse {
  accounts: MetaAdAccount[];
  enabledAccounts: MetaEnabledAdAccount[];
  enabledIds: string[];
  defaultId: string | null;
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
  /** Meta's own targeting spec, as stored: `geo_locations.countries`, `age_min`, `age_max`, … */
  targeting?: Record<string, unknown>;
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

/** The Facebook Page an ad is published as. `null` when none is stored. */
export interface MetaAdPage {
  id: string;
  name?: string;
}

export interface MetaCampaignEdit {
  name?: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
}

export interface MetaAdSetEdit {
  name?: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
  startTime?: string;
  endTime?: string;
  targeting?: { countries?: string[]; ageMin?: number; ageMax?: number };
}

/** The bodies of the three create routes — built by `buildCreateBodies` in `meta-ads-form.ts`. */
export interface MetaLaunchBodies {
  campaign: Record<string, unknown>;
  adSet: (campaignId: string) => Record<string, unknown>;
  ad: (adSetId: string) => Record<string, unknown>;
}

/** Where a launch stopped, so the screen can say what exists in the merchant's Meta account. */
export class MetaLaunchError extends Error {
  constructor(
    public readonly cause: unknown,
    /** The campaign that was created before the failure, if any. */
    public readonly campaignId: string | null,
    /** True when that campaign could not be removed, so it is still in their account (paused). */
    public readonly leftBehind: boolean,
  ) {
    super("launch failed");
  }
}

export const metaAdsApi = {
  listAdAccounts: () =>
    api.get<MetaAdAccountsResponse>(metaAdsUrl("/v1/meta/ads/ad-accounts")),

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

  /** Adopt the account's dataset, or create one (a write to the merchant's Meta account), and choose it. */
  createDataset: (adAccountId: string) =>
    api.post<{ created: boolean; selected: MetaDatasetSelection | null }>(metaAdsUrl("/v1/meta/ads/datasets"), { adAccountId }),

  selectDataset: (adAccountId: string, datasetId: string) =>
    api.put<{ selected: MetaDatasetSelection | null }>(
      metaAdsUrl("/v1/meta/ads/datasets/selected"),
      { adAccountId, datasetId },
    ),

  getPage: () => api.get<{ page: MetaAdPage | null }>(metaAdsUrl("/v1/meta/ads/page")),

  /** `mediaId` is a Drive file (chosen in the picker); the server reads its bytes, so nothing is sent from the browser. Answers the hash an ad's creative takes. */
  uploadImage: (v: { adAccountId: string; mediaId: string }) =>
    api.post<{ imageHash: string; url?: string }>(metaAdsUrl("/v1/meta/ads/images"), v),

  editCampaign: (campaignId: string, edit: MetaCampaignEdit) =>
    api.patch<{ campaign: MetaCampaign | null }>(metaAdsUrl("/v1/meta/ads/campaigns/:campaignId", { campaignId }), edit),

  editAdSet: (adSetId: string, edit: MetaAdSetEdit) =>
    api.patch<{ adSet: MetaAdSet | null }>(metaAdsUrl("/v1/meta/ads/ad-sets/:adSetId", { adSetId }), edit),

  /**
   * Campaign → ad set → ad, all PAUSED, in that order (each needs the one above's id).
   *
   * ⚠️A FAILURE AT LEVEL TWO OR THREE REMOVES THE CAMPAIGN, because a retry would otherwise mint a second
   * one and leave the first as an empty shell in the merchant's account. Removal is the status route's
   * `DELETED` (the same one Ads Manager's delete uses). If even that fails the error says the campaign is
   * left behind, paused, so the screen can tell the merchant instead of pretending it is gone.
   */
  launchCampaign: async (bodies: MetaLaunchBodies): Promise<{ campaignId: string; adSetId: string; adId: string }> => {
    // Level one is wrapped too: a refusal here (the weekly limit, a missing declaration) must reach the screen
    // the same way, through the merchant-facing filter, and say that nothing was created.
    const campaign = await api
      .post<{ campaignId: string }>(metaAdsUrl("/v1/meta/ads/campaigns"), bodies.campaign)
      .catch((cause: unknown) => {
        throw new MetaLaunchError(cause, null, false);
      });
    try {
      const adSet = await api.post<{ adSetId: string }>(
        metaAdsUrl("/v1/meta/ads/ad-sets"),
        bodies.adSet(campaign.campaignId),
      );
      const ad = await api.post<{ adId: string }>(metaAdsUrl("/v1/meta/ads/ads"), bodies.ad(adSet.adSetId));
      return { campaignId: campaign.campaignId, adSetId: adSet.adSetId, adId: ad.adId };
    } catch (cause) {
      let leftBehind = false;
      try {
        await api.patch(metaAdsUrl("/v1/meta/ads/campaigns/:campaignId/status", { campaignId: campaign.campaignId }), {
          status: "DELETED",
        });
      } catch {
        leftBehind = true;
      }
      throw new MetaLaunchError(cause, campaign.campaignId, leftBehind);
    }
  },
};
