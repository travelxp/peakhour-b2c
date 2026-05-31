"use client";

/**
 * <SchedulerComposer /> — opinionated composition of the 8 scheduler
 * primitives into a complete "schedule this content" form.
 *
 * Caller passes:
 *   - the content payload (source + per-channel payload snapshots),
 *   - the available channels (typically intersection of recommender
 *     output + connected channels),
 *   - a `onScheduled(plan)` callback for after commit.
 *
 * This is the "scheduler glue" for the b2c repurpose sheet, the
 * Beehiiv composer, and any other surface that wants the full
 * schedule UX without re-assembling primitives. The pure
 * <CalendarView /> stays on the /dashboard/calendar page (PR 7).
 *
 * Renders top-to-bottom:
 *   1. Channel target list (read-only badges per channel)
 *   2. <ScheduleTimePicker /> for the anchor
 *   3. <StaggerStrategyChooser /> chips
 *   4. <TimezoneBanner /> when audience tz differs from user tz
 *   5. <ScheduleConfirmCard /> with live preview
 *   6. <ScheduleConflictWarning /> when the smart-time engine adjusted
 *   7. Commit button + auto-approve checkbox (gated by plan tier)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { scheduler } from "@/lib/scheduler/client";
import { detectTimezone } from "@/lib/scheduler/format";
import type {
  ChannelKey,
  CommitPlanRequest,
  CommitPlanResponse,
  StaggerStrategy,
  ScheduleSourceType,
} from "@/lib/scheduler/types";
import { ScheduleTimePicker } from "./schedule-time-picker";
import { StaggerStrategyChooser } from "./stagger-strategy-chooser";
import { ScheduleConfirmCard } from "./schedule-confirm-card";
import { ScheduleConflictWarning } from "./schedule-conflict-warning";
import { TimezoneBanner } from "./timezone-banner";
import { ChannelIconCompact } from "@/components/ui/channel-icon";
import { useSchedulePreview } from "./use-schedule-preview";
import { useSchedulerEntitlements } from "./use-scheduler-entitlements";
import { UpgradeCallout } from "./upgrade-callout";
import { channelDisplayName } from "@/lib/scheduler/format";

export interface SchedulerComposerProps {
  /** Source-content reference for the plan. */
  source: {
    sourceType: ScheduleSourceType;
    sourceRef?: string;
    sourceTextHash: string;
  };
  /** Optional title (overrides server-side fallback). */
  title?: string;
  /** Channels to schedule + their pre-built payloads. */
  channels: {
    channel: ChannelKey;
    connectionId?: string;
    preferredLocalTime?: string;
    publishViaReminder?: boolean;
    payload: CommitPlanRequest["channels"][number]["payload"];
  }[];
  /**
   * Explicit override for the auto-approve affordance. When omitted,
   * the composer reads from /v1/scheduler/entitlements and only
   * surfaces the checkbox when `schedulerFeatures.autoApprove` is
   * true. Passing `true` here forces it visible regardless (useful
   * for staging / preview pages); passing `false` hides it.
   */
  canAutoApprove?: boolean;
  /** Initial anchor — defaults to the next round hour. */
  initialAnchor?: Date;
  /** Initial timezone — defaults to detected. */
  initialTimezone?: string;
  /** Called after a successful commit; the parent typically closes
   *  the sheet or navigates to /dashboard/calendar. */
  onScheduled?: (result: CommitPlanResponse) => void;
  /**
   * Override for the commit call. Defaults to `scheduler.commitPlan`
   * (POST /v1/scheduler/plans). Surfaces that need the commit to run
   * through a different endpoint — e.g. the News Desk approve, which
   * POSTs to /v1/content/ideas/:id/schedule so the idea status flip and
   * the plan commit happen atomically server-side — pass their own
   * function. It receives the exact body the composer would have sent
   * and must return the same CommitPlanResponse shape.
   */
  commit?: (body: CommitPlanRequest) => Promise<CommitPlanResponse>;
  /** Override the commit button label (default "Schedule"). */
  submitLabel?: string;
  className?: string;
}

function defaultAnchor(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export function SchedulerComposer({
  source,
  title,
  channels,
  canAutoApprove,
  initialAnchor,
  initialTimezone,
  onScheduled,
  commit,
  submitLabel,
  className,
}: SchedulerComposerProps) {
  const [anchor, setAnchor] = useState<Date>(initialAnchor ?? defaultAnchor());
  // SSR-safe timezone init: start with UTC (or caller's explicit choice),
  // then hydrate to the user's real tz after mount. Avoids the hydration
  // mismatch where the server renders "UTC" and the client renders
  // "Asia/Kolkata".
  const [timezone, setTimezone] = useState<string>(initialTimezone ?? "UTC");
  useEffect(() => {
    if (!initialTimezone) setTimezone(detectTimezone());
  }, [initialTimezone]);
  const [strategy, setStrategy] = useState<StaggerStrategy>("smart");
  const [autoApprove, setAutoApprove] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Entitlements gate — pull the scheduler-shaped slice once on
  // mount. Two separate concerns:
  //
  //   - DISPLAY: show / hide affordances and callouts. Default-
  //     restrictive while loading (don't flash locked banners before
  //     we know the user's tier).
  //   - AUTHORIZATION: what goes into the request body. ALWAYS reads
  //     from entitlements, never from props. The `canAutoApprove`
  //     override only forces the checkbox VISIBLE in staging /
  //     preview surfaces; the server is the source of truth.
  const { data: entitlements, isLoading: entitlementsLoading } =
    useSchedulerEntitlements();
  const autoApproveAuthorized =
    entitlements?.schedulerFeatures.autoApprove ?? false;
  const autoApproveVisible =
    canAutoApprove === true || (canAutoApprove !== false && autoApproveAuthorized);
  const bundleCap = entitlements?.schedulerLimits.maxScheduleBundleSize;
  const bundleExceedsCap =
    bundleCap !== undefined && channels.length > bundleCap;
  // Multi-channel users mounted before entitlements arrive: hide
  // the locked banner until we know — otherwise paid users flash a
  // "Free tier" callout on every load.
  const bundlesLocked =
    !entitlementsLoading &&
    channels.length > 1 &&
    entitlements?.schedulerFeatures.bundles === false;
  const queueCap = entitlements?.schedulerLimits.maxScheduledItems;
  // Double-submit ref guard — protects against React batching delays
  // letting two Enter keypresses fire the submit handler before the
  // disabled state propagates.
  const submittingRef = useRef(false);

  // Debounced preview — fires on every anchor / strategy / channels[]
  // change.
  const previewInput = useMemo(
    () => ({
      canonicalScheduledAtUtc: anchor.toISOString(),
      timezone,
      staggerStrategy: strategy,
      channels: channels.map((c) => ({
        channel: c.channel,
        preferredLocalTime: c.preferredLocalTime,
      })),
    }),
    [anchor, timezone, strategy, channels],
  );
  const { preview, loading, error } = useSchedulePreview(previewInput);

  const submit = async () => {
    if (channels.length === 0) {
      toast.error("Pick at least one channel before scheduling.");
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const body: CommitPlanRequest = {
        ...(title ? { title } : {}),
        source,
        channels: channels.map((c) => ({
          channel: c.channel,
          ...(c.connectionId ? { connectionId: c.connectionId } : {}),
          ...(c.preferredLocalTime
            ? { preferredLocalTime: c.preferredLocalTime }
            : {}),
          ...(c.publishViaReminder !== undefined
            ? { publishViaReminder: c.publishViaReminder }
            : {}),
          payload: c.payload,
        })),
        staggerStrategy: strategy,
        canonicalScheduledAtUtc: anchor.toISOString(),
        timezone,
        // Authorization gate — ALWAYS read from entitlements, never
        // from the canAutoApprove display override. A staging caller
        // setting canAutoApprove={true} must not be able to bypass
        // the server's plan check.
        ...(autoApproveAuthorized && autoApprove ? { autoApprove: true } : {}),
      };
      const result = await (commit ?? scheduler.commitPlan)(body);
      toast.success(
        `Scheduled across ${result.scheduledItemIds.length} channel${
          result.scheduledItemIds.length === 1 ? "" : "s"
        }.`,
      );
      onScheduled?.(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scheduling failed.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  // Cmd+Enter / Ctrl+Enter to schedule — power-user shortcut.
  // Scoped to keydown events INSIDE the composer's root (via the
  // wrapper div's onKeyDown below) so it doesn't fire from unrelated
  // modals or sibling composers. Global window listener was scope-
  // leaking across multiple mounted composers.

  return (
    <div
      className={cn("flex flex-col gap-4", className)}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      }}
    >
      {/* Channel targets — read-only badges */}
      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Publishing to {channels.length} channel
          {channels.length === 1 ? "" : "s"}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {channels.map((c) => (
            <div
              key={c.channel}
              className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs"
            >
              <ChannelIconCompact channel={c.channel} size={14} />
              <span className="font-medium">{channelDisplayName(c.channel)}</span>
              {c.publishViaReminder && (
                <span className="rounded-full bg-muted px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Reminder
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <ScheduleTimePicker
        value={anchor}
        timezone={timezone}
        onChange={({ date, timezone: tz }) => {
          setAnchor(date);
          setTimezone(tz);
        }}
      />

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Stagger strategy
        </Label>
        <StaggerStrategyChooser value={strategy} onChange={setStrategy} />
      </div>

      <TimezoneBanner timezone={timezone} storageKey="composer-tz-banner" />

      <ScheduleConfirmCard
        timezone={timezone}
        preview={preview}
        loading={loading}
        error={error}
      />

      <ScheduleConflictWarning preview={preview} />

      {/* Bundle-gate callout — appears when the caller's channel
          count exceeds the user's plan tier. The server will 402 if
          they try to schedule, so we surface the hint before submit.
          Suppressed while entitlements is loading so paid users
          don't flash a "Free tier" banner. */}
      {bundlesLocked && (
        <UpgradeCallout
          variant="banner"
          message="Multi-channel bundled publishing is on Starter+ plans. Free tier schedules channels one at a time."
        />
      )}
      {bundleExceedsCap && (
        <UpgradeCallout
          variant="banner"
          message={`Your plan caps bundle publishing at ${bundleCap} channel${
            bundleCap === 1 ? "" : "s"
          } per plan — upgrade to bundle ${channels.length} together.`}
        />
      )}

      {/* Plan queue cap — informational only. The live "X of Y"
          count belongs on the calendar page, not the composer
          (composer doesn't have list-items query state). */}
      {queueCap !== undefined && !entitlementsLoading && (
        <div className="text-[11px] text-muted-foreground">
          {entitlements?.plan === "free"
            ? `Free tier holds up to ${queueCap} scheduled items at a time. `
            : `Your plan caps active scheduled items at ${queueCap}. `}
          See your{" "}
          <a href="/dashboard/calendar" className="underline-offset-2 hover:underline">
            calendar
          </a>{" "}
          for the current count.
        </div>
      )}

      {/* Auto-approve — checkbox visible when entitlements unlock it
          OR when the explicit override forces it visible. The
          request body still respects entitlements (authorization is
          decoupled from display). */}
      {autoApproveVisible && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
          <Checkbox
            id="auto-approve"
            checked={autoApprove}
            onCheckedChange={(v) => setAutoApprove(v === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="auto-approve"
            className="flex flex-col gap-0.5 text-xs"
          >
            <span className="flex items-center gap-1 text-sm font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Auto-approve
            </span>
            <span className="text-muted-foreground">
              Skip the manual approval queue. Items fire at their scheduled
              time without further review.
            </span>
          </Label>
        </div>
      )}
      {/* Upgrade teaser — surfaces for every tier that doesn't have
          auto_approve unlocked, INCLUDING Free. Free users are the
          highest-value upsell target; excluding them was a mistake. */}
      {!autoApproveAuthorized &&
        !entitlementsLoading &&
        canAutoApprove !== false && (
          <UpgradeCallout message="Auto-approve publishing is on Growth+ plans." />
        )}

      <Button
        onClick={submit}
        // Disable rules:
        //  - submitting / loading-preview (UX)
        //  - empty channels (no-op)
        //  - bundleExceedsCap or bundlesLocked (server would 402)
        //    — we read the same entitlements the server checks; no
        //    sense letting the user hit submit on a known-bad config.
        disabled={
          submitting ||
          channels.length === 0 ||
          loading ||
          bundleExceedsCap ||
          bundlesLocked
        }
        className="w-full gap-2"
        size="lg"
      >
        <CalendarPlus className="h-4 w-4" />
        {submitting ? "Scheduling…" : (submitLabel ?? "Schedule")}
      </Button>
    </div>
  );
}
