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
  /** Billable qualified leads attributed to this campaign (G2 — the
   *  lead qualifier's conservative verdict; CPQL = spend ÷ this). */
  qualifiedLeads?: number;
  lastUpdated?: string;
}

/** Facet keys the targeting editor exposes — mirror the api's
 *  TARGETING_FACETS (helpers/linkedin-ad-targeting.ts). */
export type TargetingFacetKey =
  | "locations"
  | "industries"
  | "seniorities"
  | "titles"
  | "staffCountRanges";

/** Per-facet entity-URN lists. `locations` is required at APPLY time
 *  (server 400s without one) but optional in the type so partial
 *  editor state is representable. */
export type TargetingFacets = Partial<Record<TargetingFacetKey, string[]>>;

export interface TargetingEntity {
  urn: string;
  facetUrn: string;
  name: string;
}

/** Stored targeting selection on a managed row (set via setTargeting). */
export interface CampaignTargeting {
  facets?: TargetingFacets;
  /** URN → display name, for chip redisplay. */
  labels?: Record<string, string>;
  criteria?: Record<string, unknown>;
  appliedAt?: string;
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
  /** zCampaignObjective — typed to the boost set today; rows written by
   *  other producers may carry values outside it, so treat unknown
   *  strings as display-only rather than exhaustive-matching. */
  objective?: BoostObjective | (string & {});
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
  /** Platform creative URN ids attached at boost time. */
  linkedCreativeUrns?: string[];
  /** Audience selection. Rows written by the boost/workflow paths may
   *  carry a legacy free-form object here instead — always feature-
   *  detect `targeting.facets` before treating it as editor state. */
  targeting?: CampaignTargeting | Record<string, unknown>;
  /**
   * WHO chose this audience, on what evidence, and whether a human has ever
   * looked at it (mig 208).
   *
   * ★`confirmedAt` ABSENT is what earns the phrase "auto-selected from your
   * business — you can change this". The moment it is set, the campaign is a
   * reviewed one and must stop being described as unreviewed.
   */
  targetingProvenance?: {
    source?: "auto_proposed" | "user_set" | "platform_set";
    proposedAt?: string;
    engineVersion?: string;
    /** Why each attribute is in the audience, in BUSINESS language — "India",
     *  never `urn:li:geo:1` — with the profile's own evidence tiers. */
    basis?: Array<{
      attribute: string;
      values: string[];
      evidence: Array<{ tier: "stated" | "observed" | "inferred"; kind: string; detail?: string }>;
    }>;
    /** Platform-sourced ONLY. `belowFloor` carries NO number, because
     *  LinkedIn's `total: 0` means "fewer than 300" — rendering it as
     *  "0 people" would be a false statement about the customer's market. */
    reach?: { supported: boolean; value?: number; belowFloor?: boolean; fetchedAt?: string };
    confirmedAt?: string;
    confirmedByUserId?: string;
  };
  /**
   * The api's own read of the provenance, derived per request — the UI must
   * use THIS rather than re-deriving, because `verified` depends on a
   * fingerprint comparison the client cannot make.
   */
  audienceOrigin?: {
    source: string;
    confirmed: boolean;
    /** False when the provenance may no longer describe `targeting`. The UI
     *  then shows the audience WITHOUT claiming who chose it. */
    verified: boolean;
    /** The one flag to act on: ours, and nobody has looked at it yet. */
    autoSelectedUnconfirmed: boolean;
  };
  performance?: ManagedCampaignPerformance;
  /**
   * SPEND ALARM — set by the api (derived, never stored) when this campaign
   * is at or over its total budget cap AND still `active`.
   *
   * That combination means the protective auto-pause did not take: it failed
   * (LinkedIn refusing our app on the ad account, a suspended account, a
   * dead token) or never ran (a dead workflow, exhausted monitor polls). The
   * api leaves the row `active` on purpose, because it IS still serving —
   * flipping it locally would tell the user spend had stopped while LinkedIn
   * kept billing. Rendering this is the only thing that makes real money
   * leaking past a user-set cap visible to them.
   *
   * `reason` is the api's authored sentence from the last recorded failure,
   * when there was one — absent when the monitor never got that far.
   *
   * `spend` and `cap` are the figures the api JUDGED on. Render these, not
   * `budget.spent`: that field "is not reliably maintained" (the api's own
   * words, in ads-monitoring-skills.ts), so re-deriving here could show a
   * number under the cap next to an alarm saying it was over.
   */
  spendAlarm?: { overCap: true; spend: number; cap: number; reason?: string };
  /**
   * Past the end date its owner set, and still `active`.
   *
   * ★A DIFFERENT ABSENCE FROM `spendAlarm`, WHICH IS WHY IT IS A DIFFERENT
   * FIELD. LinkedIn never carries an `end` on the campaign's `runSchedule` —
   * the flight cap lives only on our row — so the monitor has to stop the
   * campaign on the platform itself, and it leaves the row `active` when it
   * cannot. `spendAlarm` does not cover that: it requires the campaign to be
   * over its budget cap, and this population is exactly the campaigns that
   * UNDER-spend. A campaign can be in one, the other, or both.
   *
   * `reason` absent is meaningful and must not be filled in here — it means no
   * tick has yet recorded WHY the campaign is still running, which is what a
   * monitor that has not run since it expired looks like. "We cannot tell" is
   * its own answer.
   */
  flightEndAlarm?: { pastEnd: true; endsAt: string; reason?: string };
  createdAt: string;
  updatedAt?: string;
  /** Audit ids (hex) — present on rows created via the routes. */
  createdById?: string;
  updatedById?: string;
}

export interface BoostCampaignInput {
  /** LinkedIn share/ugcPost URN of the organic post to sponsor. */
  postUrn: string;
  name: string;
  objective: BoostObjective;
  /** Decision D13's CONFIRMED geography, ISO-3166 alpha-2. Absent = use what
   *  the business profile says. An EMPTY array is the user's own statement
   *  ("none of these") and the api treats the two differently — so the audience
   *  the preview showed is the audience the campaign gets. */
  geo?: string[];
  dailyBudget: number;
  /** Must match the ad account's billing currency — the server rejects
   *  a mismatch with code CURRENCY_MISMATCH naming the expected code. */
  currencyCode: string;
  durationDays: number;
  /**
   * The advertiser ticking LinkedIn's political-advertising consent notice.
   *
   * LinkedIn REQUIRES an app that creates ads to present that notice and
   * pass back what was confirmed (`politicalIntent` on the campaign — it
   * became a required field with the EU's TTPA regulation, and omitting it
   * 422s every create). Absent/false means NOT_DECLARED, never
   * "not political": that is a legal declaration the customer makes, not us.
   */
  notPolitical?: boolean;
}

export const linkedInAdsApi = {
  /** Local managed campaigns for the active business (newest first). */
  managedCampaigns: () =>
    api.get<{ campaigns: ManagedCampaign[] }>(
      "/v1/linkedin/ads/managed-campaigns",
    ),

  /**
   * Boost-to-Campaign: sponsor an existing organic post. Creates the
   * REAL LinkedIn artefacts as a non-serving draft (group DRAFT +
   * campaign DRAFT; the creative's own ACTIVE intent is overridden by
   * those parents) and persists the managed row. Nothing spends until
   * the campaign is explicitly activated.
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

  /** Facet-entity discovery within one LinkedIn targeting facet.
   *  With `query` it typeaheads; without, lists the full facet
   *  (sensible only for small facets like seniorities). */
  targetingEntities: (facetUrn: string, query?: string) => {
    const qs = new URLSearchParams({ facet: facetUrn });
    if (query) qs.set("query", query);
    return api.get<{ entities: TargetingEntity[] }>(
      `/v1/linkedin/ads/targeting/entities?${qs.toString()}`,
    );
  },

  /**
   * Record that a human read the auto-selected audience and agreed with it.
   *
   * Cannot spend and cannot retarget: it sets `confirmedAt` on a row whose
   * audience LinkedIn already has. It is also the ACCEPTED-as-proposed half of
   * the learning signal — the targeting PATCH only ever records edits, and an
   * engine that hears about nothing but its mistakes learns a pessimistic
   * lesson.
   */
  confirmAudience: (id: string) =>
    api.post<{ campaignId: string; confirmedAt: string; alreadyConfirmed: boolean }>(
      `/v1/linkedin/ads/managed-campaigns/${id}/confirm-audience`,
      {},
    ),

  /**
   * Replace a campaign's audience targeting (platform first, then the
   * local row). Locations required — the server 400s without one.
   * Cannot start spend; an ACTIVE campaign re-enters LinkedIn review.
   */
  setTargeting: (id: string, facets: TargetingFacets, labels?: Record<string, string>) =>
    api.patch<{ campaignId: string; facets: TargetingFacets }>(
      `/v1/linkedin/ads/managed-campaigns/${id}/targeting`,
      { facets, ...(labels ? { labels } : {}) },
    ),
};
