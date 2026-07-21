import { api } from "@/lib/api";

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
   *  Reauth failures arrive as 409 NEEDS_REAUTH instead. */
  decide: (runId: string, proposalId: string, decision: "approve" | "dismiss") =>
    api.post<{ ok: true; status: DecisionStatus; failReason?: string }>(
      `/v1/growth/adjustments/${runId}/proposals/${proposalId}/${decision}`,
    ),

  /** Per-business growth settings (the optimizer opt-in lives here). */
  settings: () => api.get<{ settings: GrowthSettings }>("/v1/growth/settings"),

  /** Self-serve optimizer opt-in / weekly budget envelope. */
  updateSettings: (patch: { optimizerEnabled?: boolean; weeklyBudgetEnvelope?: number | null }) =>
    api.patch<{ settings: GrowthSettings }>("/v1/growth/settings", patch),
};
