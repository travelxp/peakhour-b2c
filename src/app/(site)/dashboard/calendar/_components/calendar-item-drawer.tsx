"use client";

/**
 * Per-item drawer for /dashboard/calendar. Opens when the user clicks
 * a chip in CalendarView. Shows:
 *   - Title row: channel icon + display name + status badge
 *   - When + where badge (resolved local time + audience timezone)
 *   - For a live item: the shared <ScheduledPostEditor/> — edit, reschedule,
 *     publish now, cancel. For a terminal one: the read-only snapshot, since
 *     there is nothing left to change.
 *   - Smart-time audit (which tier picked the time + conflicts)
 *   - Attempts log (per-attempt outcome + errorCode + retry timeline)
 *
 * ★The actions used to be a cancel button and a PERMANENTLY DISABLED "Refresh
 * snapshot" whose tooltip told the user to go and recompose the post. Editing
 * the payload is what releases a stale hold now — the same act that made the
 * user look at the content — so that button is gone rather than sitting there
 * greyed out, and its job is done by Save.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Image,
  RotateCw,
  XCircle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ChannelIconCompact } from "@/components/brand/channel-icon";
import { ScheduledPostEditor } from "@/components/scheduler/scheduled-post-editor";
import { cn } from "@/lib/utils";
import {
  channelDisplayName,
  formatRelative,
  formatScheduleLabel,
  formatTimeLabel,
  statusTone,
} from "@/lib/scheduler/format";
import type { ScheduledItemDto } from "@/lib/scheduler/types";

const STATUS_ICON = {
  published: CheckCircle2,
  queued: Clock,
  awaiting_retry: RotateCw,
  ready: Clock,
  in_flight: RotateCw,
  failed: XCircle,
  cancelled: XCircle,
  skipped: XCircle,
  needs_action: AlertTriangle,
} as const;

export interface CalendarItemDrawerProps {
  item: ScheduledItemDto;
  /** Any mutation landed — parent refetches the calendar. */
  onChanged: () => void;
  /** The item was cancelled — parent closes the drawer. */
  onCancelled: () => void;
}

function ToneBadge({
  tone,
  children,
}: {
  tone: ReturnType<typeof statusTone>;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        tone === "success" &&
          "bg-success/15 text-success-on-tint",
        tone === "info" &&
          "bg-state-info/15 text-state-info-on-tint",
        tone === "warn" &&
          "bg-warning/15 text-warning-on-tint",
        tone === "error" &&
          "bg-destructive/15 text-destructive-on-tint",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function CalendarItemDrawer({
  item,
  onChanged,
  onCancelled,
}: CalendarItemDrawerProps) {
  const Icon = STATUS_ICON[item.status] ?? Clock;
  const tone = statusTone(item.status);
  const attemptCount = item.attempts?.length ?? 0;
  const isTerminal =
    item.status === "published" ||
    item.status === "failed" ||
    item.status === "cancelled" ||
    item.status === "skipped";

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Title row */}
      <div className="flex items-start gap-3">
        <ChannelIconCompact channel={item.channel} size={20} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {channelDisplayName(item.channel)}
            <ToneBadge tone={tone}>
              <Icon className="h-3 w-3" />
              {item.status.replaceAll("_", " ")}
            </ToneBadge>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatScheduleLabel(item.scheduledAtUtc, item.audienceTimezone)} ·{" "}
            {formatRelative(item.scheduledAtUtc)}
          </div>
        </div>
      </div>

      {/* Stale / needs_action banner */}
      {(item.payloadStale || item.status === "needs_action") && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning-on-tint">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            {item.payloadStale ? (
              <>
                <div className="font-medium">Snapshot is stale</div>
                <p className="mt-0.5">
                  The source content was edited after this was scheduled, so the
                  publish is held.
                  {isTerminal
                    ? ""
                    : " Saving the post below releases it — what goes out is what you see."}
                </p>
              </>
            ) : (
              <>
                <div className="font-medium">Needs your attention</div>
                <p className="mt-0.5">
                  The publish was paused —{" "}
                  {item.attempts?.at(-1)?.errorMessage ??
                    "check the most recent attempt for details"}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <Separator />

      {/* Live item → the editor. Terminal item → the frozen snapshot, because
          there is nothing left to change and a form implying otherwise is
          worse than a record. */}
      {isTerminal ? (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Content snapshot
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="whitespace-pre-wrap wrap-break-word text-foreground">
              {item.payload.text.length > 400
                ? `${item.payload.text.slice(0, 400)}…`
                : item.payload.text}
            </p>
            {item.payload.hashtags && item.payload.hashtags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.payload.hashtags.map((h) => (
                  <span
                    key={h}
                    className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                  >
                    #{h}
                  </span>
                ))}
              </div>
            )}
            {item.payload.mediaUrls && item.payload.mediaUrls.length > 0 && (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image className="h-3 w-3" />
                {item.payload.mediaUrls.length} attachment
                {item.payload.mediaUrls.length === 1 ? "" : "s"}
              </div>
            )}
            {item.payload.threadParts && item.payload.threadParts.length > 0 && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                Thread · {item.payload.threadParts.length} part
                {item.payload.threadParts.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>
      ) : (
        <ScheduledPostEditor
          item={item}
          onChanged={onChanged}
          onCancelled={onCancelled}
        />
      )}

      {/* Smart-time audit */}
      {item.smartTime && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Smart-time engine
          </div>
          <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
            <div>
              Tier:{" "}
              <code className="rounded bg-muted px-1">{item.smartTime.tier}</code>{" "}
              · Adapter{" "}
              <code className="rounded bg-muted px-1">
                {item.smartTime.adapterVersion}
              </code>{" "}
              · Engine{" "}
              <code className="rounded bg-muted px-1">
                {item.smartTime.engineVersion}
              </code>
            </div>
            {item.smartTime.conflictsResolved &&
              item.smartTime.conflictsResolved.length > 0 && (
                <div className="mt-1.5">
                  <div className="font-medium">Adjustments</div>
                  <ul className="ml-3 list-disc">
                    {item.smartTime.conflictsResolved.map((c) => (
                      <li key={c}>{c.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Attempt log */}
      {attemptCount > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Attempt log ({attemptCount})
          </div>
          <ol className="space-y-1.5">
            {(item.attempts ?? []).map((a, idx) => (
              <li
                key={`${a.startedAt}-${idx}`}
                className={cn(
                  "rounded-md border p-2 text-xs",
                  a.outcome === "success" && "border-success/30 bg-success/10",
                  a.outcome === "transient_error" &&
                    "border-state-info/30 bg-state-info/10",
                  a.outcome === "rate_limited" &&
                    "border-warning/30 bg-warning/5",
                  a.outcome === "permanent_error" &&
                    "border-destructive/30 bg-destructive/10",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium capitalize">
                    {a.outcome.replaceAll("_", " ")}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatTimeLabel(a.startedAt, item.audienceTimezone)} ·{" "}
                    {a.durationMs}ms
                  </span>
                </div>
                {a.errorCode && (
                  <div className="mt-0.5 text-muted-foreground">
                    <code className="rounded bg-background px-1">{a.errorCode}</code>
                  </div>
                )}
                {a.errorMessage && (
                  <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                    {a.errorMessage}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* External link */}
      {item.externalUrl && (
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View on {channelDisplayName(item.channel)}
        </a>
      )}

      {/* No actions block: every action a live item has — save, reschedule,
          publish now, cancel — belongs to <ScheduledPostEditor/> above, so it
          behaves identically here and in the LinkedIn hub's Scheduled tab.
          A terminal item has none. */}

      {/* Item metadata footer */}
      <div className="border-t pt-3 text-[10px] text-muted-foreground">
        <div>Item id · {item._id}</div>
        <div>Plan id · {item.planId}</div>
        {item.externalId && <div>External id · {item.externalId}</div>}
      </div>
    </div>
  );
}
