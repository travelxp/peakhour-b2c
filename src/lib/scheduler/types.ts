/**
 * Wire-shape types matching the /v1/scheduler/* REST surface.
 * Mirrors the API responses (camelCase, hex-encoded ObjectIds, ISO dates).
 *
 * Keep aligned with peakhour-api/src/v1/routes/scheduler/index.ts
 * (normalisePlanForApi + normaliseItemForApi).
 */

export type ChannelKey = string;

export type StaggerStrategy = "synchronized" | "rolling" | "smart";

export type ScheduleSourceType = "draft" | "idea" | "social_post" | "ad_hoc";

export type PublishPlanStatus =
  | "draft"
  | "active"
  | "paused"
  | "cancelled"
  | "completed"
  | "failed_all";

export type PublishPlanApprovalState =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "auto_approved";

export type ScheduledItemStatus =
  | "queued"
  | "awaiting_retry"
  | "ready"
  | "in_flight"
  | "published"
  | "failed"
  | "cancelled"
  | "skipped"
  | "needs_action";

export interface PreflightAudit {
  ranAt: string;
  mode: "live" | "deep";
  band: "needs_work" | "good_fit" | "strong_fit";
  compositeScore?: number;
}

/** A recurring schedule rule (scd_recurring_rules) as served by
 *  GET /v1/scheduler/recurring-rules. Mirrors the API's
 *  normaliseRuleForApi allowlist; only the fields the management page
 *  renders are typed here. */
export type RecurringRuleStatus = "active" | "paused" | "completed" | "expired";
export type RecurringFreq = "daily" | "weekly" | "monthly" | "custom_cron";

export interface RecurringRuleDto {
  _id: string;
  name?: string;
  freq: RecurringFreq;
  interval: number;
  /** 0–6 (Sun–Sat) for weekly rules. */
  weekdays?: number[];
  /** 1–31 for monthly rules. */
  dayOfMonth?: number;
  /** HH:mm local. */
  localTime: string;
  timezone: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  maxRuns?: number;
  runsSpawned: number;
  runsCompleted: number;
  lastSpawnedAt?: string;
  nextSpawnAt?: string;
  status: RecurringRuleStatus;
  pauseReason?: string;
  lastSpawnError?: string;
  planTemplate?: {
    channels?: { channel: ChannelKey }[];
    titleTemplate?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ListRecurringRulesResponse {
  rules: RecurringRuleDto[];
}

export interface PayloadSnapshot {
  text: string;
  hashtags?: string[];
  mediaUrls?: string[];
  firstComment?: string;
  threadParts?: string[];
  channelOptions?: Record<string, unknown>;
  audit?: PreflightAudit;
  snapshotAt: string;
  version: number;
}

export interface SmartTimeMeta {
  tier: "tier1" | "tier2" | "manual";
  adapterVersion: string;
  engineVersion: string;
  candidateHoursUtc?: number[];
  chosenHourLocal?: number;
  conflictsResolved?: string[];
}

export interface PlanChannelTarget {
  channel: ChannelKey;
  connectionId?: string;
  preferredLocalTime?: string;
  publishViaReminder: boolean;
}

export interface PublishPlanDto {
  _id: string;
  orgId: string;
  businessId: string;
  ownerUserId: string;
  title?: string;
  source: {
    sourceType: ScheduleSourceType;
    sourceRef?: string;
    sourceTextHash: string;
  };
  channels: PlanChannelTarget[];
  staggerStrategy: StaggerStrategy;
  canonicalScheduledAtUtc: string;
  timezone: string;
  approvalState: PublishPlanApprovalState;
  approvalActorUserId?: string;
  approvalActorChannel?: string;
  approvedAt?: string;
  approvalNote?: string;
  status: PublishPlanStatus;
  recurringRuleId?: string;
  recurringRunNumber?: number;
  requestId: string;
  totalCostUsd?: number;
  cancellationReason?: string;
  editLog?: { at: string; action: string; summary?: string }[];
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface ScheduledAttempt {
  startedAt: string;
  endedAt: string;
  outcome:
    | "success"
    | "transient_error"
    | "permanent_error"
    | "rate_limited";
  durationMs: number;
  providerHttpStatus?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface ScheduledItemDto {
  _id: string;
  orgId: string;
  businessId: string;
  planId: string;
  channel: ChannelKey;
  connectionId: string;
  status: ScheduledItemStatus;
  scheduledAtUtc: string;
  audienceTimezone: string;
  payload: PayloadSnapshot;
  attempts?: ScheduledAttempt[];
  attemptsCount: number;
  payloadStale: boolean;
  publishViaReminder: boolean;
  priority: "low" | "normal" | "high";
  smartTime?: SmartTimeMeta;
  externalId?: string;
  externalUrl?: string;
  publishedAt?: string;
  terminatedAt?: string;
  cancellationReason?: string;
  nextAttemptAt?: string;
  socialPostId?: string;
  createdAt: string;
  updatedAt?: string;
}

// ── Request bodies ───────────────────────────────────────────

export interface CommitPlanRequest {
  title?: string;
  source: {
    sourceType: ScheduleSourceType;
    sourceRef?: string;
    sourceTextHash: string;
  };
  channels: {
    channel: ChannelKey;
    connectionId?: string;
    preferredLocalTime?: string;
    publishViaReminder?: boolean;
    payload: {
      text: string;
      hashtags?: string[];
      mediaUrls?: string[];
      firstComment?: string;
      threadParts?: string[];
      channelOptions?: Record<string, unknown>;
      audit?: PreflightAudit;
    };
  }[];
  staggerStrategy?: StaggerStrategy;
  canonicalScheduledAtUtc: string;
  timezone: string;
  autoApprove?: boolean;
  meta?: Record<string, unknown>;
}

export interface CommitPlanResponse {
  planId: string;
  scheduledItemIds: string[];
  requestId: string;
  resolvedTimes: { channel: ChannelKey; scheduledAtUtc: string }[];
}

export interface PreviewTimeRequest {
  channels: { channel: ChannelKey; preferredLocalTime?: string }[];
  staggerStrategy?: StaggerStrategy;
  canonicalScheduledAtUtc: string;
  timezone: string;
}

export interface PreviewTimeResponse {
  resolvedTimes: {
    channel: ChannelKey;
    scheduledAtUtc: string | null;
    audit: string[];
  }[];
  /** Present when the preview includes LinkedIn and the business has an
   *  approved/applied `posting_cadence` adjustment from the weekly
   *  optimizer (G3) — surfaced so cadence guidance steers scheduling. */
  cadenceAdjustment?: { summary: string; expectedEffect: string };
}

export interface ListPlansResponse {
  plans: PublishPlanDto[];
  nextCursor: string | null;
}

export interface ListItemsResponse {
  items: ScheduledItemDto[];
}

export interface PlanDetailResponse {
  plan: PublishPlanDto;
  items: ScheduledItemDto[];
}

export interface SchedulerEntitlementsResponse {
  plan: string;
  planVersion: number;
  schedulerFeatures: {
    recurring: boolean;
    bundles: boolean;
    autoApprove: boolean;
    bulkCsv: boolean;
  };
  schedulerLimits: {
    maxScheduledItems?: number;
    maxScheduleHorizonDays?: number;
    maxScheduleBundleSize?: number;
  };
}
