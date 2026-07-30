import { api } from "@/lib/api";
import type { AdvertisingDeclaration } from "@/lib/ads-copy";

/**
 * Growth-engine client (G3) — the channel-common /v1/growth surface.
 *
 * Weekly optimizer runs land as `opt_adjustments` rows: at most 3
 * SMALL, CONSERVATIVE proposals per week, each with evidence, expected
 * effect, and a rollback condition. Humans decide here (autonomy
 * L0/L1); only an approved budget_resplit ever touches the platform,
 * behind the api's no-increase-without-envelope guard. Nothing on this
 * surface can create campaigns or start spend.
 */

export type ProposalType =
  | "hook_weighting"
  | "posting_cadence"
  | "budget_resplit"
  | "boost_threshold"
  | "audience_emphasis";

export type ProposalStatus = "proposed" | "approved" | "dismissed" | "applied" | "failed";

/** Decision outcomes the decide endpoint reports. `retryable` = the
 *  apply failed for a FIXABLE reason and the proposal was reverted to
 *  `proposed` — fix the cause (reconnect / envelope) and decide again. */
export type DecisionStatus = "approved" | "dismissed" | "applied" | "failed" | "retryable";

export interface GrowthSettings {
  optimizerEnabled?: boolean;
  autonomyLevel?: number;
  weeklyBudgetEnvelope?: number;
  /** The business's one-time political-advertising declaration, with
   *  provenance. Absent means nobody has declared — the single reading of
   *  absence, which is why withdrawing UNSETS it rather than storing
   *  NOT_DECLARED. */
  advertisingDeclaration?: AdvertisingDeclaration;
}

/**
 * The settings envelope. `currentNoticeVersion` and `declaredByName` are
 * read-only siblings of `settings`, not part of the stored record:
 *   - `currentNoticeVersion` is the wording in force RIGHT NOW. The UI
 *     compares it with the declaration's own version to tell "declared" from
 *     "needs re-confirming". Never hardcode a copy — it would drift from the
 *     api's CURRENT_NOTICE_VERSION and mis-state every business's status.
 *   - `declaredByName` is resolved server-side from declaredByUserId, because
 *     an ObjectId is not an attribution a human recognises. Absent when there
 *     is no declaration or the declaring user is gone.
 * Both GET and PATCH return this shape, so the card renders identically from
 * either without waiting for a refetch.
 */
export interface GrowthSettingsResponse {
  settings: GrowthSettings;
  currentNoticeVersion?: string;
  declaredByName?: string;
}

export interface OptimizerProposal {
  id: string;
  type: ProposalType;
  summary: string;
  evidence: string[];
  expectedEffect: string;
  rollbackCondition: string;
  autoApplicable: boolean;
  params?: Record<string, unknown>;
  status: ProposalStatus;
  decidedAt?: string;
  appliedAt?: string;
  failReason?: string;
}

export interface OptimizerRun {
  _id: string;
  platform: string;
  weekStart: string;
  proposals: OptimizerProposal[];
  noAdjustmentReason?: string;
  inputsDigest?: { organicPosts: number; campaignsAnalysed: number; windowDays: number };
  createdAt: string;
}

export type RunNowResult =
  | { created: false; reason: "already_ran" | "optimizer_disabled" | "no_data" }
  | { created: true; runId: string; proposalCount: number };

export const growthApi = {
  /** Recent weekly optimizer runs (newest first, up to 12). */
  adjustments: () => api.get<{ runs: OptimizerRun[] }>("/v1/growth/adjustments"),

  /** Run the optimizer now for the active business. Idempotent per ISO
   *  week; typed no-op reasons (already_ran / optimizer_disabled /
   *  no_data) come back as 200s, not errors. */
  runNow: () => api.post<RunNowResult>("/v1/growth/adjustments/run"),

  /** Human decision on one proposal. Approving a budget_resplit also
   *  attempts the guarded platform apply — the response's status says
   *  what ACTUALLY happened (approved / applied / failed / retryable).
   *  Reauth failures arrive as 409 NEEDS_REAUTH instead, and a platform
   *  refusing OUR APP on the ad account as 403 AD_ACCOUNT_NOT_AUTHORIZED.
   *
   *  `notAuthorized` is the same condition arriving on a 200 `retryable`
   *  from an api deployment that predates that code — the board uses it to
   *  suppress its "fix that and approve again" copy, which is wrong for a
   *  refusal no user action can clear. */
  decide: (runId: string, proposalId: string, decision: "approve" | "dismiss") =>
    api.post<{
      ok: true;
      status: DecisionStatus;
      failReason?: string;
      notAuthorized?: boolean;
    }>(
      `/v1/growth/adjustments/${runId}/proposals/${proposalId}/${decision}`,
    ),

  /** Per-business growth settings (the optimizer opt-in and the advertising
   *  declaration live here), plus the notice version in force. */
  settings: () => api.get<GrowthSettingsResponse>("/v1/growth/settings"),

  /**
   * Self-serve optimizer opt-in / weekly budget envelope / advertising
   * declaration.
   *
   * `notPolitical: true` records the declaration with server-stamped
   * provenance (who, when, which wording); `false` WITHDRAWS it by unsetting
   * the record. The client cannot set declaredAt / declaredByUserId /
   * noticeVersion — the whole value of the field is that the server knows a
   * real person declared it at a known time under known wording.
   */
  updateSettings: (patch: {
    optimizerEnabled?: boolean;
    weeklyBudgetEnvelope?: number | null;
    notPolitical?: boolean;
  }) => api.patch<GrowthSettingsResponse>("/v1/growth/settings", patch),
};
