"use client";

/**
 * <ScheduleConfirmCard /> — shows resolved per-channel times before
 * the user clicks Schedule. Pairs with the /v1/scheduler/preview-time
 * preview endpoint so the user sees real numbers, not a guess.
 *
 * Single-glance summary above + per-channel rows below with their
 * resolved time, audience timezone, and smart-time audit chips
 * ("shifted +90m for cross-channel min-spacing").
 */

import { CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { ChannelIconCompact } from "@/components/ui/channel-icon";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { channelDisplayName, formatScheduleLabel } from "@/lib/scheduler/format";
import type { PreviewTimeResponse } from "@/lib/scheduler/types";

export interface ScheduleConfirmCardProps {
  timezone: string;
  preview?: PreviewTimeResponse;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function ScheduleConfirmCard({
  timezone,
  preview,
  loading,
  error,
  className,
}: ScheduleConfirmCardProps) {
  if (loading) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Resolving your schedule…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("border-destructive/30 bg-destructive/5", className)}>
        <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!preview || preview.resolvedTimes.length === 0) return null;

  // First scheduled time = "publishes at" headline.
  const earliest = preview.resolvedTimes
    .filter((r) => r.scheduledAtUtc)
    .sort((a, b) => (a.scheduledAtUtc ?? "").localeCompare(b.scheduledAtUtc ?? ""))[0];

  return (
    <Card className={cn("border-primary/30 bg-primary/5", className)}>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Your post starts publishing{" "}
          {earliest?.scheduledAtUtc && (
            <span className="text-primary">
              {formatScheduleLabel(earliest.scheduledAtUtc, timezone)}
            </span>
          )}
        </div>

        <ul className="divide-y rounded-md border bg-background">
          {preview.resolvedTimes.map((r) => (
            <li
              key={r.channel}
              className="flex items-start gap-3 px-3 py-2 text-sm"
            >
              <ChannelIconCompact channel={r.channel} size={16} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">
                    {channelDisplayName(r.channel)}
                  </span>
                  <span className="text-muted-foreground">
                    {r.scheduledAtUtc
                      ? formatScheduleLabel(r.scheduledAtUtc, timezone)
                      : "no time resolved"}
                  </span>
                </div>
                {r.audit && r.audit.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.audit.map((note) => (
                      <span
                        key={note}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                      >
                        {note.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {preview.cadenceAdjustment && (
          <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-background px-3 py-2 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <span className="font-medium text-foreground">
                Your weekly optimizer suggests:
              </span>{" "}
              {preview.cadenceAdjustment.summary}
              <span className="block text-[11px]">
                {preview.cadenceAdjustment.expectedEffect}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
