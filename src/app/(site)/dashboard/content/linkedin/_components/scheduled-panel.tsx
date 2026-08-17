"use client";

/**
 * ScheduledPanel — every LinkedIn post that hasn't gone out yet, in one list,
 * with the four things you can do to one of them.
 *
 * ★WHY A LIST AND NOT JUST THE CALENDAR. /dashboard/calendar already showed
 * these — as chips on a month grid, cross-channel, with a drawer that could
 * preview and cancel and nothing else. If the question is "what is my LinkedIn
 * queue and can I change that post", a month grid answers it badly: you scan
 * cells to count, and the answer to "change it" was no. This is the queue as a
 * queue, filtered to the channel the hub is about, and the row expands into the
 * shared editor.
 *
 * Reads GET /v1/scheduler/items with `channel=linkedin` over a forward window.
 * Server-side sort is `scheduledAtUtc: 1`, so soonest-first needs no client sort.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Clock,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { ScheduledPostEditor } from "@/components/scheduler/scheduled-post-editor";
import { scheduler } from "@/lib/scheduler/client";
import {
  formatRelative,
  formatScheduleLabel,
  statusTone,
} from "@/lib/scheduler/format";
import { cn } from "@/lib/utils";
import type { ScheduledItemDto } from "@/lib/scheduler/types";

export const LINKEDIN_SCHEDULED_QUERY_KEY = ["linkedin-scheduled-items"] as const;

/**
 * How far ahead to look. The API defaults to now+30d, which would silently hide
 * a post scheduled for next quarter — and a queue that omits rows is worse than
 * no queue, because it reads as "nothing scheduled". A year forward covers any
 * realistic plan; the 500-item cap is the real bound and is not reachable by
 * hand-scheduling.
 */
const HORIZON_DAYS = 365;
/**
 * ...and a short look BACK, so a post that failed or got held yesterday is
 * still in the list rather than vanishing at midnight. These are exactly the
 * rows that need attention.
 */
const LOOKBACK_DAYS = 7;

/** Statuses that mean "still coming, or still needs you". Terminal rows are
 *  excluded: a published post belongs in the Library, not the queue. */
const OPEN_STATUSES = new Set<ScheduledItemDto["status"]>([
  "queued",
  "awaiting_retry",
  "ready",
  "in_flight",
  "needs_action",
]);

export function ScheduledPanel() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: LINKEDIN_SCHEDULED_QUERY_KEY,
    // The window is computed INSIDE queryFn, not during render: a clock read in
    // render is impure (React can re-run it and get a different answer), and
    // putting the resulting dates in the queryKey would make the key change on
    // every tick and refetch forever. Fetch time is the right clock for a
    // "from now" window anyway.
    queryFn: () => {
      const now = Date.now();
      return scheduler.listItems({
        channel: "linkedin",
        from: new Date(now - LOOKBACK_DAYS * 86_400_000),
        to: new Date(now + HORIZON_DAYS * 86_400_000),
        limit: 500,
      });
    },
    staleTime: 30_000,
  });

  const items = useMemo(
    () => (data?.items ?? []).filter((i) => OPEN_STATUSES.has(i.status)),
    [data],
  );

  function handleChanged() {
    void queryClient.invalidateQueries({ queryKey: LINKEDIN_SCHEDULED_QUERY_KEY });
    // A publish-now moves the post into the published archive, and a reschedule
    // moves a chip on the calendar — both are other surfaces' data.
    void queryClient.invalidateQueries({ queryKey: ["linkedin-feed"] });
    void queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load your scheduled posts"
        description="We hit a snag reading the queue. Try again in a moment."
        action={{ label: "Retry", onClick: () => void refetch() }}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nothing scheduled"
        description="Posts you schedule from the composer appear here, where you can edit them, move them, publish early or call them off."
      />
    );
  }

  const needAttention = items.filter(
    (i) => i.status === "needs_action" || i.payloadStale,
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {items.length} post{items.length === 1 ? "" : "s"} queued
          {needAttention > 0 && (
            <>
              {" · "}
              <span className="font-medium text-warning-on-tint">
                {needAttention} need{needAttention === 1 ? "s" : ""} attention
              </span>
            </>
          )}
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="h-7 gap-1.5 px-2 text-xs"
        >
          <RotateCw className={cn("size-3", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const expanded = expandedId === item._id;
          const tone = statusTone(item.status);
          const firstLine =
            item.payload.text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "(no text)";
          return (
            <li key={item._id}>
              <Card className={cn(expanded && "border-primary/40")}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : item._id)}
                    aria-expanded={expanded}
                    className="flex w-full items-start gap-3 p-3 text-left hover:bg-accent/40"
                  >
                    <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium">{firstLine}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <span>
                          {formatScheduleLabel(item.scheduledAtUtc, item.audienceTimezone)}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{formatRelative(item.scheduledAtUtc)}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 font-medium capitalize",
                            tone === "info" && "bg-state-info/15 text-state-info-on-tint",
                            tone === "warn" && "bg-warning/15 text-warning-on-tint",
                            tone === "error" && "bg-destructive/15 text-destructive-on-tint",
                            tone === "success" && "bg-success/15 text-success-on-tint",
                            tone === "neutral" && "bg-muted",
                          )}
                        >
                          {item.status.replaceAll("_", " ")}
                        </span>
                        {item.payloadStale && (
                          <span className="rounded-full bg-warning/15 px-1.5 py-0.5 font-medium text-warning-on-tint">
                            held for review
                          </span>
                        )}
                        {item.payload.mediaUrls && item.payload.mediaUrls.length > 0 && (
                          <span>
                            {item.payload.mediaUrls.length} attachment
                            {item.payload.mediaUrls.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>

                  {expanded && (
                    <div className="border-t p-3">
                      <ScheduledPostEditor
                        item={item}
                        onChanged={handleChanged}
                        onCancelled={() => setExpandedId(null)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
