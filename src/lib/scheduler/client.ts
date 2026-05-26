/**
 * Typed client for /v1/scheduler/* REST surface.
 *
 * All calls go through the shared `api` ApiClient (handles CSRF +
 * credentials + auth refresh). This file is a thin typed wrapper so
 * component code can `await scheduler.commitPlan(input)` without
 * memorising the path strings.
 */

import { api } from "../api";
import type {
  CommitPlanRequest,
  CommitPlanResponse,
  ListItemsResponse,
  ListPlansResponse,
  PlanDetailResponse,
  PreviewTimeRequest,
  PreviewTimeResponse,
  ScheduledItemStatus,
  PublishPlanStatus,
  PublishPlanApprovalState,
  SchedulerEntitlementsResponse,
} from "./types";

export interface ListPlansQuery {
  from?: Date;
  to?: Date;
  status?: PublishPlanStatus;
  approvalState?: PublishPlanApprovalState;
  recurringRuleId?: string;
  limit?: number;
  cursor?: string;
}

export interface ListItemsQuery {
  from?: Date;
  to?: Date;
  channel?: string;
  status?: ScheduledItemStatus;
  planId?: string;
  payloadStale?: boolean;
  limit?: number;
}

function dateParam(d: Date | undefined): string | undefined {
  return d ? d.toISOString() : undefined;
}

function buildQuery(record: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

export const scheduler = {
  commitPlan(body: CommitPlanRequest) {
    return api.post<CommitPlanResponse>("/v1/scheduler/plans", body);
  },

  cancelPlan(planId: string, reason?: string) {
    const path = `/v1/scheduler/plans/${planId}${
      reason ? `?reason=${encodeURIComponent(reason)}` : ""
    }`;
    return api.delete<{ cancelledItems: number; providerCancels: number }>(path);
  },

  markStale(planId: string, sourceTextHash: string) {
    return api.post<{ flagged: number }>(
      `/v1/scheduler/plans/${planId}/stale`,
      { sourceTextHash },
    );
  },

  listPlans(query: ListPlansQuery = {}) {
    return api.get<ListPlansResponse>(
      "/v1/scheduler/plans",
      buildQuery({
        from: dateParam(query.from),
        to: dateParam(query.to),
        status: query.status,
        approvalState: query.approvalState,
        recurringRuleId: query.recurringRuleId,
        limit: query.limit,
        cursor: query.cursor,
      }),
    );
  },

  listItems(query: ListItemsQuery = {}) {
    return api.get<ListItemsResponse>(
      "/v1/scheduler/items",
      buildQuery({
        from: dateParam(query.from),
        to: dateParam(query.to),
        channel: query.channel,
        status: query.status,
        planId: query.planId,
        payloadStale: query.payloadStale,
        limit: query.limit,
      }),
    );
  },

  getPlan(planId: string) {
    return api.get<PlanDetailResponse>(`/v1/scheduler/plans/${planId}`);
  },

  previewTime(body: PreviewTimeRequest) {
    return api.post<PreviewTimeResponse>("/v1/scheduler/preview-time", body);
  },

  getEntitlements() {
    return api.get<SchedulerEntitlementsResponse>(
      "/v1/scheduler/entitlements",
    );
  },
};
