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
  /** Whether the org's plan tier allows auto-approval (PR 8 wires
   *  this from the entitlements feed). */
  canAutoApprove?: boolean;
  /** Initial anchor — defaults to the next round hour. */
  initialAnchor?: Date;
  /** Initial timezone — defaults to detected. */
  initialTimezone?: string;
  /** Called after a successful commit; the parent typically closes
   *  the sheet or navigates to /dashboard/calendar. */
  onScheduled?: (result: CommitPlanResponse) => void;
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
        ...(canAutoApprove && autoApprove ? { autoApprove: true } : {}),
      };
      const result = await scheduler.commitPlan(body);
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

      {canAutoApprove && (
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

      <Button
        onClick={submit}
        // Disable only while actively submitting or with no channels.
        // A failed preview (error !== null) shouldn't block commit —
        // the server re-runs the stagger on commit and the user
        // shouldn't be locked out by a transient preview API failure.
        disabled={submitting || channels.length === 0 || loading}
        className="w-full gap-2"
        size="lg"
      >
        <CalendarPlus className="h-4 w-4" />
        {submitting ? "Scheduling…" : "Schedule"}
      </Button>
    </div>
  );
}
