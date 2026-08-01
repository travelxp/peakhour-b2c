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
  correctProfile: (corrections: CorrectionInput[]) =>
    api.patch<{ profile: AudienceProfile }>("/v1/audiences/profile", { corrections }),
};
