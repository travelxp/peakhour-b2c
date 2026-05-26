"use client";

/**
 * <PublishBundleSummary /> — denser bundle card for the dashboard
 * "next publish" surface. Renders one row per channel with the
 * resolved time, current item status, and any payload-stale /
 * needs-action banner inline.
 *
 * Distinct from ScheduleConfirmCard (pre-commit preview) — this one
 * renders ALREADY-COMMITTED items.
 */

import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  RotateCw,
  XCircle,
} from "lucide-react";
import { ChannelIconCompact } from "@/components/ui/channel-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  channelDisplayName,
  formatScheduleLabel,
  formatRelative,
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

export interface PublishBundleSummaryProps {
  /** Plan title for the header — falls back to the source title. */
  title?: string;
  items: ScheduledItemDto[];
  /** Optional href to drill into the per-plan detail page. */
  detailHref?: string;
  /** Optional "Refresh snapshot" button for stale items. */
  onRefreshStale?: () => void;
  /** Cancel button — when omitted, header is read-only. */
  onCancel?: () => void;
  className?: string;
}

export function PublishBundleSummary({
  title,
  items,
  detailHref,
  onRefreshStale,
  onCancel,
  className,
}: PublishBundleSummaryProps) {
  if (items.length === 0) return null;
  const tz = items[0]!.audienceTimezone;
  const staleCount = items.filter((i) => i.payloadStale).length;
  const needsActionCount = items.filter((i) => i.status === "needs_action").length;
  const earliest = items
    .slice()
    .sort((a, b) => a.scheduledAtUtc.localeCompare(b.scheduledAtUtc))[0]!;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {title ?? "Scheduled bundle"}
          </div>
          <div className="text-xs text-muted-foreground">
            First out · {formatRelative(earliest.scheduledAtUtc)} ·{" "}
            {items.length} channel{items.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {detailHref && (
            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Link href={detailHref}>Open</Link>
            </Button>
          )}
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {(staleCount > 0 || needsActionCount > 0) && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              {staleCount > 0 && (
                <div>
                  {staleCount} item{staleCount === 1 ? "" : "s"} need a snapshot
                  refresh — your source content changed since these were
                  scheduled.
                </div>
              )}
              {needsActionCount > 0 && (
                <div>
                  {needsActionCount} item{needsActionCount === 1 ? "" : "s"}{" "}
                  paused — waiting for you to reconnect or resolve.
                </div>
              )}
            </div>
            {onRefreshStale && staleCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-amber-300 px-2 text-xs"
                onClick={onRefreshStale}
              >
                Refresh
              </Button>
            )}
          </div>
        )}

        <ul className="divide-y rounded-md border bg-background text-sm">
          {items.map((item) => {
            const Icon = STATUS_ICON[item.status] ?? Clock;
            const tone = statusTone(item.status);
            return (
              <li
                key={item._id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2",
                  item.payloadStale && "bg-amber-50/50 dark:bg-amber-950/20",
                )}
              >
                <ChannelIconCompact channel={item.channel} size={16} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {channelDisplayName(item.channel)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatScheduleLabel(item.scheduledAtUtc, tz)}
                  </div>
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    tone === "success" &&
                      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                    tone === "info" &&
                      "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
                    tone === "warn" &&
                      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                    tone === "error" &&
                      "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                    tone === "neutral" && "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {item.status.replaceAll("_", " ")}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Helper for the "next item up" sidebar slot — a single
 *  scheduled item, denser than the bundle card. */
export function NextActionScheduleSlot({
  item,
  className,
}: {
  item: ScheduledItemDto;
  className?: string;
}) {
  const Icon = STATUS_ICON[item.status] ?? Clock;
  const tone = statusTone(item.status);
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3",
        item.status === "needs_action" &&
          "border-amber-300 bg-amber-50 dark:bg-amber-950/30",
        item.payloadStale && "border-amber-300",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full",
          tone === "success" && "bg-emerald-100 text-emerald-700",
          tone === "info" && "bg-sky-100 text-sky-700",
          tone === "warn" && "bg-amber-100 text-amber-700",
          tone === "error" && "bg-rose-100 text-rose-700",
          tone === "neutral" && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <ChannelIconCompact channel={item.channel} size={14} />
          {channelDisplayName(item.channel)}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatRelative(item.scheduledAtUtc)} ·{" "}
          {formatScheduleLabel(item.scheduledAtUtc, item.audienceTimezone)}
        </div>
      </div>
    </div>
  );
}
