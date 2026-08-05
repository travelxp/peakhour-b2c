import { api } from "@/lib/api";

/**
 * /v1/audiences — the Autonomous Audience Engine's client.
 *
 * ★THE FIRST ONE. Until this file, `grep -rn "/v1/audiences" src` returned
 * nothing: the engine reads a business, classifies it, resolves a servable
 * audience and puts it on every boosted campaign — entirely invisibly. Three
 * things followed from that, and this client exists to end all three:
 *
 *   - the profile could not be seen, so Phase 1's exit criterion ("it is
 *     recognisably right, and its errors are correctable") was untestable;
 *   - it could not be CORRECTED, and a correction is the best learning signal
 *     this engine will ever get — better than anything the content side has,
 *     because it says WHAT was wrong rather than merely that something was;
 *   - `targetingProvenance` was write-only.
 *
 * Platform is a PARAMETER on this surface, never a path segment — same rule as
 * the ads hub, so adding Meta is a registry row and an adapter rather than a
 * new client.
 */

/** Where a claim came from. `stated` (a human typed it) beats `observed` (we
 *  measured it) beats `inferred` (the model's judgement), and the UI shows the
 *  difference because a strategist who tells you which is which is the
 *  product. */
export type EvidenceTier = "stated" | "observed" | "inferred";

export interface ProfileSource {
  tier: EvidenceTier;
  /** Machine-readable origin — "org_businesses.valueProposition", "gsc.queries". */
  kind: string;
  /** Human-readable pointer: a page title, a query, a count. */
  detail?: string;
}

export interface ProfileClaim {
  value: string;
  confidence: number;
  sources?: ProfileSource[];
}

export interface AudienceProfile {
  classification: {
    industry?: ProfileClaim;
    subIndustry?: ProfileClaim;
    marketType?: { value: string; confidence: number; sources?: ProfileSource[] };
    lifecycleStage?: ProfileClaim;
    regionalPresence?: ProfileClaim[];
  };
  icp: Array<{
    label: string;
    description?: string;
    confidence: number;
    sources?: ProfileSource[];
  }>;
  personas: Array<{
    label: string;
    role?: string;
    seniority?: string;
    buyingRole?: string;
    confidence: number;
    sources?: ProfileSource[];
  }>;
  decisionMakers: Array<{
    titleFamily: string;
    seniority?: string;
    confidence: number;
    sources?: ProfileSource[];
  }>;
  painPoints: Array<{ statement: string; confidence: number; sources?: ProfileSource[] }>;
  intentSignals: Array<{ signal: string; strength: number; sources?: ProfileSource[] }>;
  /**
   * Where a stated fact and an observed one disagree. NOT an error to resolve:
   * a business that says it sells to enterprises while its content only ever
   * addresses freelancers is the most interesting thing the engine noticed, and
   * flattening it into one answer throws that away.
   */
  conflicts: Array<{ field: string; statedValue?: string; observedValue?: string; note?: string }>;
  corrections: Array<{
    field: string;
    from?: string;
    to?: string;
    fromList?: string[];
    toList?: string[];
    byUserId: string;
    at: string;
  }>;
  profileVersion: number;
  /** Which skill instance produced each stage. ★The panel reads
   *  `understand_business_for_ads` to tell "we found nothing" from "the deeper
   *  read never ran" — two very different facts behind the same empty list. */
  skillVersions?: Record<string, string>;
  status: "active" | "stale" | "building" | "failed";
  computedAt?: string;
  updatedAt?: string;
}

/**
 * What the server will accept as a correction, per field.
 *
 * ★SENT BY THE SERVER, never hardcoded here. A client offering a control the
 * server refuses is a dead control; a client sending a scalar where the server
 * wants a list is a 400 the user reads as "my correction was wrong". The panel
 * renders whatever this list says and nothing else.
 */
export interface CorrectableFieldSpec {
  field: string;
  shape: "scalar" | "list";
  maxLength: number;
  maxItems?: number;
  /** Closed vocabulary, when the field has one (market type). */
  values?: readonly string[];
  /** Comma-separated ISO-3166 alpha-2 — the one list-shaped field that stays a
   *  scalar, because a two-character vocabulary cannot contain a comma. */
  csv?: "iso2";
  maxCount?: number;
}

export interface ProfileResponse {
  profile: AudienceProfile | null;
  correctableFields: CorrectableFieldSpec[];
}

export interface RefreshResponse {
  profile: AudienceProfile;
  /** False when only the EVIDENCED half is present — the model read failed or
   *  was skipped. The panel says the deeper read is unavailable rather than
   *  presenting gaps as findings. */
  classified: boolean;
}

/** One correction. Carries `to` OR `toList` — the FIELD decides which, and the
 *  spec above says. */
export interface CorrectionInput {
  field: string;
  to?: string;
  toList?: string[];
}

/** What the engine would target, without writing anything. */
export interface ProposalResponse {
  proposal: {
    /** Platform-native criteria — opaque here; the campaign gets its own copy. */
    criteria: Record<string, unknown>;
    facets: Record<string, string[]>;
    labels: Record<string, string>;
    /** Why each attribute is in the audience, in business language. */
    basis: Array<{
      attribute: string;
      values: string[];
      evidence: Array<{ tier: EvidenceTier; kind: string; detail?: string }>;
    }>;
    /** Platform-sourced only; `belowFloor` carries NO number. */
    reach?: { supported: boolean; value?: number; belowFloor?: boolean; fetchedAt?: string };
    /** ★The ISO-2 codes this audience was built from — NOT derivable from
     *  `basis`, whose values are display labels ("India", never "IN"). A
     *  client that pre-fills a codes box from the labels turns confirming the
     *  inference into deleting it. */
    geoCodes?: string[];
    /** What we wanted to express and could not — surfaced, never dropped. */
    unresolved: Array<{ attribute: string; value: string; reason: string }>;
  } | null;
  /** A refusal is a 200 with a REASON, because "we don't know your country" is
   *  a question for the user rather than a failure of the request. */
  refusal: {
    reason:
      | "no_profile"
      | "no_geography"
      | "geo_unresolved"
      | "platform_unsupported"
      | "registry_empty"
      | "not_servable";
    message: string;
  } | null;
}

export const audiencesApi = {
  /** What we understand about this business. `profile: null` is a first-class
   *  answer — nobody has asked for audiences yet — not an error. */
  getProfile: () => api.get<ProfileResponse>("/v1/audiences/profile"),

  /** Rebuild from current signals. Expensive (site graph, content, a strong
   *  model call), so the panel makes it an explicit action rather than
   *  something that happens on mount. */
  refreshProfile: () => api.post<RefreshResponse>("/v1/audiences/profile/refresh", {}),

  /** Corrections are APPENDED to a log, never written over the field: the
   *  delta is what teaches the engine, and storing only the result would let a
   *  later rebuild silently revert it. */
  /**
   * What we WOULD target, resolved against the platform with a real reach
   * number. Read-only: it writes nothing and touches no campaign.
   *
   * `geo` is decision D13's confirmed geography. Omitting it means "use what
   * the profile says"; sending an EMPTY array is the user saying none of these,
   * and the api treats the two differently.
   */
  propose: (body: { geo?: string[] } = {}) =>
    api.post<ProposalResponse>("/v1/audiences/propose", body),

  correctProfile: (corrections: CorrectionInput[]) =>
    api.patch<{ profile: AudienceProfile }>("/v1/audiences/profile", { corrections }),
};

// ── The library ─────────────────────────────────────────────────────────
//
// ★EVERYTHING BELOW IS THE FIRST CALLER E1–F4 HAS EVER HAD. The engine has
// planned portfolios, imported the audiences a business actually ran, scored
// them, argued against them and resolved them per channel — all of it API-only,
// with this client calling exactly four profile endpoints. "Built" means a
// caller can reach it, and until now nothing did.

/** Where an audience came from — the brief's own distinction, and the one the
 *  list has to make visible. */
export type AudienceSource = "generated" | "fallback" | "imported" | "user_defined";

export type AudienceSetStatus = "proposed" | "applied" | "discarded" | "superseded";

/**
 * One channel this audience is KNOWN to work on, as `GET /sets` reports it.
 *
 * ★A CHANNEL MISSING FROM THE LIST HAS NOT BEEN ASKED. That is a different
 * statement from "it doesn't work there", and a client that renders them the
 * same is making a claim about a customer's reach on a channel nobody has
 * queried. The list is what is already stored; asking a channel costs a
 * typeahead round and lives behind `GET /sets/:id/resolutions/:platform`.
 */
export interface AudienceChannel {
  platform: string;
  /** The entry is real but cannot be shown to be current — the adapter build
   *  that produced it has moved, or none was recorded. */
  stale: boolean;
  /** False for an audience with no business-language hypothesis to re-express
   *  — an imported set. Its criteria are a record of what was RUN, so `stale`
   *  on such a row would invite an action that does not exist. */
  rematerialisable: boolean;
  /** True only when we HAVE a number. False covers both "the channel publishes
   *  no count" and "we could not get one", which the api collapses on purpose:
   *  from the customer's side both are "we don't have a size". Neither is a
   *  zero. */
  reachSupported: boolean;
  reachValue?: number;
  /** The platform masked the count because the audience is under its serving
   *  floor. Carries NO figure, deliberately. */
  belowFloor: boolean;
  /** How many attributes this channel could not express at all. The names live
   *  behind the per-channel view. */
  droppedAttributes: number;
  resolvedAt?: string;
}

/** The business-language shape of an audience — no URNs, no platform enums.
 *  This IS the audience; a channel's criteria are a cache of it. */
export interface AudienceHypothesisAttribute {
  attribute: string;
  variant: string;
  values: string[];
}

export interface AudienceSet {
  id: string;
  name: string;
  description?: string;
  source: AudienceSource;
  status: AudienceSetStatus;
  archetype?: string;
  hypothesis?: {
    attributes: AudienceHypothesisAttribute[];
    rationale?: string;
    cites?: string[];
  };
  channels: AudienceChannel[];
  /** Every hand-correction to this audience's targeting. The count is the
   *  interesting figure on a list: an audience corrected four times is one we
   *  keep getting wrong. */
  userEdits?: Array<{ at: string; attribute?: string; from?: string[]; to?: string[] }>;
  /** Copied from the campaigns that ran it, never independently measured. */
  outcome?: {
    campaignIds: string[];
    impressions: number;
    clicks: number;
    ctr?: number;
    conversions?: number;
    spend?: number;
    currency?: string;
    note?: string;
    syncedAt: string;
  };
  discardReason?: string;
  createdAt: string;
}

export interface AudienceSetsQuery {
  platform?: string;
  status?: AudienceSetStatus;
  source?: AudienceSource;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface AudienceSetsResponse {
  sets: AudienceSet[];
  /** The true total, not the page size — so the header can say "23 audiences"
   *  rather than a number that silently equals the page. */
  total: number;
  limit: number;
  offset: number;
}

/**
 * One thing this audience asks for that a channel could not express.
 *
 * ★PER ATTRIBUTE AND BY NAME, NEVER A COUNT. "Two things couldn't be expressed"
 * is not information a customer can act on; "X can't target seniority, and it
 * matched 3 of your 5 job titles" is. `unsupported` separates the two kinds:
 * the channel has no way to say this AT ALL, versus it tried and some values
 * did not bind.
 */
export interface AudienceChannelGap {
  attribute: string;
  variant: string;
  unsupported: boolean;
  /** Why, when `unsupported`. In the customer's terms, naming the channel. */
  reason?: string;
  /** Values the channel's own search could not bind, each with its own reason.
   *  Empty when `unsupported` — nothing was asked. */
  values: Array<{ value: string; reason: string }>;
}

/** One channel's stored shape of an audience. The criteria themselves are the
 *  platform's own and deliberately not rendered — `basis` is the readable half. */
export interface AudienceResolution {
  basis?: Array<{ attribute: string; values: string[] }>;
  geoCodes?: string[];
  unresolved?: Array<{ attribute: string; value: string; reason: string }>;
  droppedAttributes?: string[];
  reach?: { supported: boolean; value?: number; belowFloor?: boolean; fetchedAt?: string };
  adapterVersion?: string;
  resolvedAt: string;
  /** A HUMAN built this channel shape. It is not a cache and nothing may
   *  re-resolve it — there is nothing it could be out of date WITH. */
  authored?: boolean;
}

/**
 * What an audience looks like on one channel.
 *
 * ★A REFUSAL IS A 200 WITH A REASON, NOT AN ERROR. "This audience doesn't work
 * on X, and here is which part X couldn't express" is the ANSWER to the
 * question asked — a client that rendered it as a failed request would turn an
 * honest, useful result into a broken screen.
 */
export type AudienceResolutionResponse =
  | {
      platform: string;
      available: true;
      /** `cache` — returned as stored. `resolved` — freshly asked. */
      from: "cache" | "resolved";
      /** The entry is real but cannot be shown to be current. */
      stale: boolean;
      rematerialisable: boolean;
      /** Present when we TRIED to re-ask the channel and could not, and are
       *  showing what we had instead. Without it a failed refresh is
       *  indistinguishable from a cache hit. */
      refreshFailed?: { code: string; message: string };
      resolution: AudienceResolution;
      gaps: AudienceChannelGap[];
    }
  | {
      platform: string;
      available: false;
      code: string;
      message: string;
      gaps: AudienceChannelGap[];
    };

export interface AudienceSetResponse {
  set: AudienceSet;
}

export const audienceLibraryApi = {
  /**
   * The library. Filters are SERVER-SIDE and the enums are the server's: a
   * value it does not recognise is a 400, not a silently empty list.
   */
  listSets: (query: AudienceSetsQuery = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === "") continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    return api.get<AudienceSetsResponse>(`/v1/audiences/sets${qs ? `?${qs}` : ""}`);
  },

  /** One audience, with the channels it is already known to work on. */
  getSet: (id: string) => api.get<AudienceSetResponse>(`/v1/audiences/sets/${id}`),

  /**
   * Put a library audience on a campaign (G4).
   *
   * ★IT SPENDS NOTHING AND ACTIVATES NOTHING. A draft campaign stays a draft;
   * an active one re-enters the platform's review with a new audience, exactly
   * as the manual targeting editor already does. Generating an audience is not
   * authority to spend it, and neither is putting it on a campaign.
   *
   * ★AND IT ASKS FOR THE CAMPAIGN'S OWN CHANNEL. The api materialises the set
   * for whatever platform the campaign runs on and REFUSES to spend against a
   * resolution it cannot confirm — so a 409 here is the engine declining to
   * guess, not a broken request.
   */
  applySet: (setId: string, campaignId: string) =>
    api.post<{
      setId: string;
      campaignId: string;
      appliedAt: string;
      /** Sets this replaced, counting only those now running nowhere else.
       *  Empty is the common answer and is not an error. */
      supersededSetIds: string[];
    }>(`/v1/audiences/sets/${setId}/apply`, { campaignId }),

  /**
   * Keep the audience someone built by hand (F3/G4).
   *
   * ★OFFERED, NEVER AUTOMATIC. A library that fills up with every one-off
   * experiment is a library nobody opens — so the api creates the set when
   * asked, and the targeting editor goes on doing nothing of the sort. This is
   * where the ask comes from.
   *
   * It lands at evidence tier `stated`: they chose it, usually against a
   * proposal we had just shown them, which the design calls the best signal
   * this engine gets.
   */
  saveFromCampaign: (body: { campaignId: string; name?: string; description?: string }) =>
    api.post<{
      set: AudienceSet;
      /**
       * What did not survive the trip into business language, each with its
       * reason — a facet we have no name for, one whose entities the campaign
       * never named, one only partly named, or an attribute past the cap.
       *
       * ★AND THE DIRECTION IS BROADER, NOT NARROWER: a lost include removes a
       * whole AND-block, so the saved audience reaches MORE people than the
       * campaign did. Silence here would be the dangerous half.
       */
      lost: Array<{ facet: string; reason: string }>;
      /** So a client can say "you already saved this" rather than "saved!". */
      alreadySaved: boolean;
    }>("/v1/audiences/sets/from-campaign", body),

  /**
   * What this audience looks like on ONE channel.
   *
   * ★IT WRITES ON A GET, DELIBERATELY, AND THE API SAYS SO. The typeahead round
   * and the reach call have already been paid by the time there is anything to
   * return, so the answer is cached into the set — but that also means this is
   * an ACTION rather than something to fire on mount for every channel. The
   * list view renders what is already stored; this asks.
   *
   * `refresh` re-asks a channel we have already asked. It cannot touch an
   * AUTHORED entry: a channel shape a human built has no producer to be out of
   * date with, and "refreshing" it would replace their own entity ids with
   * whatever our search ranks first today.
   */
  getResolution: (id: string, platform: string, opts: { refresh?: boolean } = {}) =>
    api.get<AudienceResolutionResponse>(
      `/v1/audiences/sets/${id}/resolutions/${platform}${opts.refresh ? "?refresh=true" : ""}`,
    ),
};
