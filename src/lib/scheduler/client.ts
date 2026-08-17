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
  ScheduledItemDto,
  ScheduledItemStatus,
  PublishPlanStatus,
  PublishPlanApprovalState,
  SchedulerEntitlementsResponse,
  ListRecurringRulesResponse,
  RecurringRuleDto,
  RecurringRuleStatus,
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

  /**
   * Drag-to-reschedule. mode="bundle" shifts every sibling item under
   * the same plan by the same delta (anchor item's old → new time);
   * mode="item" shifts only the dragged item. Per locked decision #10:
   * plain drag = bundle, alt-drag = item.
   *
   * Backdated requests (>5min in the past) return 400 BACKDATED_NOT_ALLOWED.
   * Items in terminal status or currently being published return 409.
   */
  rescheduleItem(
    itemId: string,
    body: { scheduledAtUtc: Date; mode: "bundle" | "item" },
  ) {
    return api.patch<{
      movedItemIds: string[];
      cancelledItemIds: string[];
      skippedItemIds: string[];
      deltaMs: number;
    }>(`/v1/scheduler/items/${itemId}/reschedule`, {
      scheduledAtUtc: body.scheduledAtUtc.toISOString(),
      mode: body.mode,
    });
  },

  /**
   * Edit a scheduled post's frozen snapshot. Every field is optional and an
   * omitted field keeps its stored value, so a text-only edit needs no media
   * round trip. Clears the `payloadStale` hold — the author has just
   * re-authored the content, which is what the hold was waiting for.
   *
   * `channelOptions` is deliberately NOT editable: it carries the author URN +
   * visibility the plan was committed with, and changing who publishes means
   * cancelling and recomposing so the author policy runs again. The server
   * REJECTS an unknown field rather than dropping it, so a client that tries
   * gets a 400 instead of a false success.
   *
   * 400 TEXT_TOO_LONG / TEXT_REQUIRED / TOO_MANY_MEDIA on invalid content
   * (over-length text is rejected, never silently truncated). 409 when the
   * item is terminal or the publisher already holds it.
   */
  editItemPayload(
    itemId: string,
    patch: {
      text?: string;
      hashtags?: string[];
      mediaUrls?: string[];
      firstComment?: string;
      threadParts?: string[];
    },
  ) {
    return api.patch<{
      itemId: string;
      status: ScheduledItemStatus;
      payload: ScheduledItemDto["payload"];
    }>(`/v1/scheduler/items/${itemId}/payload`, patch);
  },

  /**
   * Publish one scheduled item immediately, ahead of its time.
   *
   * Runs the publish cron's own path server-side, so the attempt is recorded on
   * the item exactly as a scheduled attempt would be. `outcome` is therefore
   * NOT always "published": a transient provider error comes back as
   * `transient_error` with a 200, and the item goes to `awaiting_retry` on its
   * normal backoff. Callers should read `outcome` and refetch, not assume
   * success from the status code.
   *
   * 409 with a specific code for every state that cannot publish:
   * ITEM_TERMINAL, ITEM_NEEDS_ACTION, ITEM_PAYLOAD_STALE, ITEM_IN_FLIGHT.
   */
  publishItemNow(itemId: string) {
    return api.post<{
      itemId: string;
      outcome:
        | "published"
        | "transient_error"
        | "permanent_error"
        | "rate_limited"
        | "needs_action"
        | "unknown";
      code?: string;
      published: boolean;
    }>(`/v1/scheduler/items/${itemId}/publish-now`, {});
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

  // ── Recurring rules ─────────────────────────────────────
  listRecurringRules(query: { status?: RecurringRuleStatus; limit?: number } = {}) {
    return api.get<ListRecurringRulesResponse>(
      "/v1/scheduler/recurring-rules",
      buildQuery({ status: query.status, limit: query.limit }),
    );
  },

  /** Pause an active rule (DELETE flips status → paused; `reason` is
   *  stored as pauseReason). */
  pauseRecurringRule(ruleId: string, reason?: string) {
    const path = `/v1/scheduler/recurring-rules/${ruleId}${
      reason ? `?reason=${encodeURIComponent(reason)}` : ""
    }`;
    return api.delete<{ paused: boolean }>(path);
  },

  /** Resume a paused rule (→ active, nextSpawnAt recomputed server-side). */
  resumeRecurringRule(ruleId: string) {
    return api.post<{ resumed: boolean; nextSpawnAt: string }>(
      `/v1/scheduler/recurring-rules/${ruleId}/resume`,
      {},
    );
  },

  getRecurringRule(ruleId: string) {
    return api.get<RecurringRuleDto>(`/v1/scheduler/recurring-rules/${ruleId}`);
  },
};
