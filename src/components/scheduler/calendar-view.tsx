"use client";

/**
 * <CalendarView /> — reusable week-grid + month-grid component that
 * renders scheduled items as dense, drag-droppable cards. Stateless:
 * parent owns the items + the selected date range + drag callbacks.
 *
 * Two display modes:
 *   - "week" — 7-column day grid with per-day item stacks
 *   - "month" — 6-row month grid with item chips (denser overview)
 *
 * Drag-to-reschedule is opt-in via the `onItemMove` prop. Per locked
 * decision #10 in content-pipeline-hardening.md, plain drag moves the
 * whole BUNDLE (every sibling item in the same plan); alt-drag moves
 * the single item only. The callback receives a `mode: "bundle" |
 * "item"` flag so the parent can stage the right mutation.
 *
 * Channel filter is owned by the parent (the calendar PAGE in PR 7
 * renders the chip strip + passes filtered items down).
 */

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
  RotateCw,
  XCircle,
} from "lucide-react";
import { ChannelIconCompact } from "@/components/ui/channel-icon";
import { cn } from "@/lib/utils";
import {
  channelDisplayName,
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
  skipped: PauseCircle,
  needs_action: AlertTriangle,
} as const;

export interface CalendarViewProps {
  items: ScheduledItemDto[];
  /** UTC start of the visible window — inclusive. */
  rangeStart: Date;
  /** UTC end of the visible window — exclusive. */
  rangeEnd: Date;
  /** IANA timezone the user is viewing in. */
  timezone: string;
  mode?: "week" | "month";
  /** Open the per-item drawer. */
  onItemClick?: (item: ScheduledItemDto) => void;
  /** Drop callback. mode="bundle" when user dragged without alt;
   *  "item" with alt-drag. The parent stages the actual API mutation. */
  onItemMove?: (args: {
    item: ScheduledItemDto;
    toDayLocal: Date;
    mode: "bundle" | "item";
  }) => void;
  className?: string;
}

/** Inclusive list of midnight-local Dates between rangeStart and
 *  rangeEnd, computed in the target timezone. */
function listLocalDays(start: Date, end: Date, tz: string): Date[] {
  const out: Date[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  let cursor = new Date(start.getTime());
  // Snap cursor to midnight-local of its day.
  while (cursor < end) {
    const parts = fmt.format(cursor);
    out.push(new Date(`${parts}T00:00:00Z`));
    cursor = new Date(cursor.getTime() + 24 * 3600 * 1000);
  }
  return out;
}

/** Bucket items by local-day key (YYYY-MM-DD in the target timezone). */
function bucketByDay(
  items: ScheduledItemDto[],
  tz: string,
): Map<string, ScheduledItemDto[]> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map = new Map<string, ScheduledItemDto[]>();
  for (const item of items) {
    const key = fmt.format(new Date(item.scheduledAtUtc));
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  // Sort each day's items by time.
  for (const arr of map.values()) {
    arr.sort((a, b) => a.scheduledAtUtc.localeCompare(b.scheduledAtUtc));
  }
  return map;
}

function dayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

interface ItemChipProps {
  item: ScheduledItemDto;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

function ItemChip({ item, onClick, draggable, onDragStart }: ItemChipProps) {
  const Icon = STATUS_ICON[item.status] ?? Clock;
  const tone = statusTone(item.status);
  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        "group relative flex w-full items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-left text-xs transition",
        "hover:border-primary/40 hover:shadow-sm",
        item.payloadStale && "border-amber-400 bg-amber-50 dark:bg-amber-950/40",
        tone === "warn" && !item.payloadStale &&
          "border-amber-300 bg-amber-50 dark:bg-amber-950/30",
        tone === "error" && "border-rose-300 bg-rose-50 dark:bg-rose-950/30",
        tone === "success" && "bg-emerald-50 dark:bg-emerald-950/20",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
      title={
        item.payload.text.length > 80
          ? `${item.payload.text.slice(0, 80)}…`
          : item.payload.text
      }
    >
      <ChannelIconCompact channel={item.channel} size={14} />
      <span className="min-w-0 flex-1 truncate font-medium">
        {item.payload.text.split("\n")[0]!.slice(0, 60) ||
          channelDisplayName(item.channel)}
      </span>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {formatTimeLabel(item.scheduledAtUtc, item.audienceTimezone)}
      </span>
      <Icon
        className={cn(
          "h-3 w-3 shrink-0",
          tone === "success" && "text-emerald-600",
          tone === "info" && "text-sky-600",
          tone === "warn" && "text-amber-600",
          tone === "error" && "text-rose-600",
        )}
      />
    </button>
  );
}

export function CalendarView({
  items,
  rangeStart,
  rangeEnd,
  timezone,
  mode = "week",
  onItemClick,
  onItemMove,
  className,
}: CalendarViewProps) {
  const days = useMemo(
    () => listLocalDays(rangeStart, rangeEnd, timezone),
    [rangeStart, rangeEnd, timezone],
  );
  const buckets = useMemo(() => bucketByDay(items, timezone), [items, timezone]);

  const onDrop = (day: Date) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!onItemMove) return;
    const itemId = e.dataTransfer.getData("application/x-scheduled-item-id");
    const itemOnly = e.dataTransfer.getData("application/x-item-only") === "1";
    const item = items.find((i) => i._id === itemId);
    if (!item) return;
    onItemMove({
      item,
      toDayLocal: day,
      mode: itemOnly ? "item" : "bundle",
    });
  };

  if (mode === "week") {
    // Below `md` (768px) week stacks into a vertical list with
    // inline day headers — 7 full-height cards on mobile is too
    // tall to scan. Above md, 7-column grid with stacked items.
    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-2 md:grid-cols-7",
          className,
        )}
      >
        {days.map((day) => {
          const key = dayKey(day, timezone);
          const dayItems = buckets.get(key) ?? [];
          const isToday = key === dayKey(new Date(), timezone);
          return (
            <div
              key={key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop(day)}
              className={cn(
                "flex flex-col rounded-lg border bg-background p-2",
                // Mobile (stacked): compact min-height. Desktop
                // (7-col grid): taller cells to show multiple items.
                "min-h-20 md:min-h-35",
                isToday && "border-primary/40 ring-1 ring-primary/20",
              )}
            >
              <div className="mb-1.5 flex items-baseline justify-between text-xs">
                <span
                  className={cn(
                    "font-semibold",
                    isToday && "text-primary",
                  )}
                >
                  {new Intl.DateTimeFormat(undefined, {
                    weekday: "short",
                    timeZone: timezone,
                  }).format(day)}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {new Intl.DateTimeFormat(undefined, {
                    day: "numeric",
                    month: "short",
                    timeZone: timezone,
                  }).format(day)}
                </span>
              </div>
              <div className="space-y-1">
                {dayItems.length === 0 ? (
                  <div className="text-[11px] italic text-muted-foreground/60">
                    nothing scheduled
                  </div>
                ) : (
                  dayItems.map((item) => (
                    <ItemChip
                      key={item._id}
                      item={item}
                      onClick={() => onItemClick?.(item)}
                      draggable={!!onItemMove}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/x-scheduled-item-id",
                          item._id,
                        );
                        // Shift-drag selects item-only mode; plain
                        // drag is bundle-move (locked decision #10).
                        // Shift avoids the OS-level "create link"
                        // overload that Alt triggers on Windows.
                        e.dataTransfer.setData(
                          "application/x-item-only",
                          e.shiftKey ? "1" : "0",
                        );
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Month view — denser, drops fine-grained per-day time labels.
  return (
    <div
      className={cn(
        "grid grid-cols-7 gap-1 rounded-lg border bg-background p-1.5",
        className,
      )}
    >
      {days.map((day) => {
        const key = dayKey(day, timezone);
        const dayItems = buckets.get(key) ?? [];
        const isToday = key === dayKey(new Date(), timezone);
        return (
          <div
            key={key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop(day)}
            className={cn(
              "flex min-h-25 flex-col rounded p-1 text-xs",
              isToday && "bg-primary/5",
            )}
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                className={cn(
                  "tabular-nums",
                  isToday
                    ? "rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground"
                    : "text-[10px] text-muted-foreground",
                )}
              >
                {new Intl.DateTimeFormat(undefined, {
                  day: "numeric",
                  timeZone: timezone,
                }).format(day)}
              </span>
              {dayItems.length > 0 && (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {dayItems.length}
                </span>
              )}
            </div>
            <div className="space-y-0.5">
              {dayItems.slice(0, 3).map((item) => (
                <ItemChip
                  key={item._id}
                  item={item}
                  onClick={() => onItemClick?.(item)}
                  draggable={!!onItemMove}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/x-scheduled-item-id",
                      item._id,
                    );
                    e.dataTransfer.setData(
                      "application/x-alt",
                      e.altKey ? "1" : "0",
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                />
              ))}
              {dayItems.length > 3 && (
                <button
                  type="button"
                  onClick={() => onItemClick?.(dayItems[0]!)}
                  className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                >
                  +{dayItems.length - 3} more
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
