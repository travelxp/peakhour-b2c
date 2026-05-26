"use client";

/**
 * /dashboard/calendar — global scheduling calendar.
 *
 * Single page that surfaces every scheduled publish across every
 * channel for the current business. Per locked decision #9 in
 * content-pipeline-hardening.md: ONE global view with channel filter
 * chips, not per-channel calendars.
 *
 * Layout:
 *   [PageHeader] — title + week/month toggle + "today" + week nav
 *   [Filter bar] — channel chip strip + status filter
 *   [CalendarView] — grid of items with drag-to-reschedule
 *   [PerItemDrawer] — opens when user clicks a chip; per-item drawer
 *                     with payload preview + attempts log + cancel button
 *
 * Data flow:
 *   - listItems({ from, to, channel?, status? }) on each window change
 *   - mutations: cancel, refresh-stale, drag-to-reschedule (PR 8)
 *
 * Power-user shortcuts:
 *   - Arrow Left / Right: previous / next window
 *   - T: jump to today
 *   - W / M: toggle week / month
 *   - Esc: close drawer
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CalendarView, TimezoneBanner } from "@/components/scheduler";
import type { ScheduledItemDto } from "@/lib/scheduler/types";
import { ChannelIconCompact } from "@/components/ui/channel-icon";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { scheduler } from "@/lib/scheduler/client";
import {
  channelDisplayName,
  detectTimezone,
  formatScheduleLabel,
} from "@/lib/scheduler/format";
import type {
  ListItemsResponse,
  ScheduledItemStatus,
} from "@/lib/scheduler/types";
import { CalendarItemDrawer } from "./_components/calendar-item-drawer";

type Mode = "week" | "month";

/** Render a Date's local (in `tz`) year-month-day parts. */
function localParts(date: Date, tz: string): { y: number; mo: number; d: number; wd: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  return {
    y: Number(get("year")),
    mo: Number(get("month")),
    d: Number(get("day")),
    wd: get("weekday") || "Mon",
  };
}

/** Compose a UTC instant from local (in tz) year-month-day at the
 *  given hour:minute. Uses the guess-and-diff trick to honour DST
 *  without drifting across boundaries. */
function localTimeUtc(
  y: number,
  mo: number,
  d: number,
  hh: number,
  mm: number,
  tz: string,
): Date {
  const guess = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0, 0));
  const rendered = localParts(guess, tz);
  const renderedHm = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess);
  const rHh = Number(renderedHm.find((p) => p.type === "hour")?.value ?? "0");
  const rMm = Number(renderedHm.find((p) => p.type === "minute")?.value ?? "0");
  const renderedMs = Date.UTC(
    rendered.y, rendered.mo - 1, rendered.d,
    rHh === 24 ? 0 : rHh, rMm, 0, 0,
  );
  const desiredMs = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
  return new Date(guess.getTime() + (desiredMs - renderedMs));
}

function localMidnightUtc(y: number, mo: number, d: number, tz: string): Date {
  return localTimeUtc(y, mo, d, 0, 0, tz);
}

const WEEKDAY_OFFSET: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** Week starts on Monday in our UI — aligns with the platform's
 *  primary B2B audience scheduling pattern. Computed in `tz` so the
 *  week boundary matches the user's local calendar, not UTC. */
function startOfWeek(date: Date, tz: string): Date {
  const p = localParts(date, tz);
  const offset = WEEKDAY_OFFSET[p.wd] ?? 0;
  // Back up `offset` local days to land on Monday-midnight-local.
  let monday = localMidnightUtc(p.y, p.mo, p.d, tz);
  monday = new Date(monday.getTime() - offset * 24 * 60 * 60 * 1000);
  // Re-snap to local midnight after the day arithmetic (DST safety).
  const mondayParts = localParts(monday, tz);
  return localMidnightUtc(mondayParts.y, mondayParts.mo, mondayParts.d, tz);
}

function startOfMonth(date: Date, tz: string): Date {
  const p = localParts(date, tz);
  return localMidnightUtc(p.y, p.mo, 1, tz);
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  // SSR-safe init: both `tz` and `anchor` are hydrated on mount.
  // Initialising `new Date()` directly in useState runs on the
  // server too, causing hydration mismatch when the server's "now"
  // differs from the client's "now" by even a second — and the
  // resulting queryKey would differ across the boundary, firing
  // two queries.
  const [tz, setTz] = useState("UTC");
  const [anchor, setAnchor] = useState<Date | null>(null);
  useEffect(() => {
    setTz(detectTimezone());
    setAnchor(new Date());
  }, []);

  const [mode, setMode] = useState<Mode>("week");
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ScheduledItemStatus | null>(
    null,
  );
  const [drawerItem, setDrawerItem] = useState<ScheduledItemDto | null>(null);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (!anchor) {
      // Pre-mount stub — no query fires until anchor hydrates.
      const stub = new Date(0);
      return { rangeStart: stub, rangeEnd: stub };
    }
    if (mode === "week") {
      const start = startOfWeek(anchor, tz);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { rangeStart: start, rangeEnd: end };
    }
    const start = startOfMonth(anchor, tz);
    // End-of-month = start of next month in the user's tz, computed
    // the same way to avoid UTC-month edge cases.
    const p = localParts(start, tz);
    const end = (() => {
      const nextMo = p.mo === 12 ? 1 : p.mo + 1;
      const nextY = p.mo === 12 ? p.y + 1 : p.y;
      // Inline composer to avoid a circular helper.
      const guess = new Date(Date.UTC(nextY, nextMo - 1, 1, 0, 0, 0, 0));
      const rendered = localParts(guess, tz);
      const renderedMs = Date.UTC(rendered.y, rendered.mo - 1, rendered.d, 0, 0, 0, 0);
      const desiredMs = Date.UTC(nextY, nextMo - 1, 1, 0, 0, 0, 0);
      return new Date(guess.getTime() + (desiredMs - renderedMs));
    })();
    return { rangeStart: start, rangeEnd: end };
  }, [anchor, mode, tz]);

  const queryKey = useMemo(
    () => [
      "scheduler:items",
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
      channelFilter ?? "all",
      statusFilter ?? "all",
    ],
    [rangeStart, rangeEnd, channelFilter, statusFilter],
  );

  const { data, isLoading, refetch, isFetching } = useQuery<ListItemsResponse>({
    queryKey,
    enabled: anchor !== null,
    queryFn: () =>
      scheduler.listItems({
        from: rangeStart,
        to: rangeEnd,
        ...(channelFilter ? { channel: channelFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        limit: 500,
      }),
  });

  // Channel chip palette — derived from items so we don't show chips
  // for channels the business has never scheduled to. Stable order:
  // newsletter / linkedin / x / facebook / instagram / threads / others.
  const channelChips = useMemo(() => {
    const set = new Set<string>();
    for (const item of data?.items ?? []) set.add(item.channel);
    const ORDER = [
      "newsletter",
      "linkedin",
      "x",
      "facebook",
      "instagram",
      "threads",
    ];
    return [...set].sort(
      (a, b) =>
        (ORDER.indexOf(a) === -1 ? 99 : ORDER.indexOf(a)) -
        (ORDER.indexOf(b) === -1 ? 99 : ORDER.indexOf(b)),
    );
  }, [data]);

  // Status chips — derive from items so we don't show "failed" chip
  // when nothing has failed.
  const statusChips = useMemo(() => {
    const set = new Set<ScheduledItemStatus>();
    for (const item of data?.items ?? []) set.add(item.status);
    return [...set];
  }, [data]);

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        shiftAnchor(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        shiftAnchor(1);
      } else if (e.key === "t" || e.key === "T") {
        setAnchor(new Date());
      } else if (e.key === "w" || e.key === "W") {
        setMode("week");
      } else if (e.key === "m" || e.key === "M") {
        setMode("month");
      } else if (e.key === "Escape") {
        setDrawerItem(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const shiftAnchor = (dir: -1 | 1) => {
    setAnchor((prev) => {
      const base = prev ?? new Date();
      const p = localParts(base, tz);
      if (mode === "week") {
        // 7 LOCAL days. Adding 7×86400000ms to the UTC instant works
        // unless the shift crosses a DST transition (gains/loses 1h);
        // localMidnightUtc re-snaps on the new day anyway via
        // startOfWeek, so the offset wash is harmless.
        return localMidnightUtc(p.y, p.mo, p.d + dir * 7, tz);
      }
      // Local month arithmetic — JS Date's setUTCMonth clamps Jan-31
      // + 1mo to Mar-3 (UTC), losing February entirely. Computing in
      // local parts and re-anchoring to day=1 of the next month gives
      // the calendar what it expects.
      const nextMo = p.mo + dir;
      const nextY = p.y + Math.floor((nextMo - 1) / 12);
      const moClamped = ((nextMo - 1) % 12 + 12) % 12 + 1;
      return localMidnightUtc(nextY, moClamped, 1, tz);
    });
  };

  const onCancelItem = useCallback(
    async (item: ScheduledItemDto) => {
      try {
        await scheduler.cancelPlan(item.planId, "user_cancelled_from_calendar");
        toast.success("Scheduled bundle cancelled.");
        setDrawerItem(null);
        void queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cancel failed");
      }
    },
    [queryClient],
  );

  const onRefreshStale = useCallback(
    async (item: ScheduledItemDto, newHash: string) => {
      try {
        await scheduler.markStale(item.planId, newHash);
        toast.success("Snapshot refresh requested.");
        void queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Refresh failed");
      }
    },
    [queryClient],
  );

  /**
   * Drag-to-reschedule. The CalendarView callback gives us a day
   * boundary (`toDayLocal` at midnight in the user's tz) and a mode —
   * plain drag = "bundle", alt-drag = "item". We preserve the original
   * time-of-day by computing a UTC delta from the item's original
   * scheduledAtUtc to the same H:M on the target day. The API does the
   * cancel-then-reinsert + sibling shift; we just invalidate the
   * calendar query on success.
   */
  const onItemMove = useCallback(
    async (args: {
      item: ScheduledItemDto;
      toDayLocal: Date;
      mode: "bundle" | "item";
    }) => {
      // Preserve the item's original local time-of-day on the new day —
      // dragging Mon 09:00 → Wed should land on Wed 09:00, not Wed
      // midnight.
      const original = new Date(args.item.scheduledAtUtc);
      const originalHm = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit",
      }).formatToParts(original);
      const hh = Number(originalHm.find((p) => p.type === "hour")?.value ?? "0");
      const mm = Number(originalHm.find((p) => p.type === "minute")?.value ?? "0");
      const dayParts = localParts(args.toDayLocal, tz);
      const newScheduledAtUtc = localTimeUtc(
        dayParts.y, dayParts.mo, dayParts.d, hh, mm, tz,
      );

      // Pre-empt the server's BACKDATED_NOT_ALLOWED check (5min skew
      // tolerance) so dragging onto today before the original time-of-
      // day doesn't round-trip just to get a 400.
      if (newScheduledAtUtc.getTime() < Date.now() - 5 * 60_000) {
        toast.error("Cannot reschedule into the past. Pick a future day.");
        return;
      }

      try {
        const result = await scheduler.rescheduleItem(args.item._id, {
          scheduledAtUtc: newScheduledAtUtc,
          mode: args.mode,
        });
        const moved = result.movedItemIds.length;
        toast.success(
          args.mode === "bundle"
            ? `Bundle rescheduled — ${moved} item${moved === 1 ? "" : "s"} moved.`
            : "Item rescheduled.",
        );
        void queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Reschedule failed",
        );
      }
    },
    [queryClient, tz],
  );

  const headlineLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      month: "long",
      year: "numeric",
    });
    if (mode === "week") {
      const endDate = new Date(rangeEnd.getTime() - 1);
      const start = new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        month: "short",
        day: "numeric",
      }).format(rangeStart);
      const end = new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(endDate);
      return `${start} – ${end}`;
    }
    return anchor ? fmt.format(anchor) : "";
  }, [mode, rangeStart, rangeEnd, anchor, tz]);

  /** Distinct count of items needing attention. An item can be BOTH
   *  payloadStale AND in status="needs_action"; counting them
   *  separately would double-report the same row. */
  const attentionCount = useMemo(() => {
    if (!data) return 0;
    return data.items.filter(
      (i) => i.payloadStale || i.status === "needs_action",
    ).length;
  }, [data]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every scheduled publish across all your channels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-full border bg-background p-0.5">
            <Button
              size="sm"
              variant={mode === "week" ? "default" : "ghost"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setMode("week")}
              aria-pressed={mode === "week"}
            >
              <CalendarDays className="mr-1 h-3.5 w-3.5" /> Week
            </Button>
            <Button
              size="sm"
              variant={mode === "month" ? "default" : "ghost"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setMode("month")}
              aria-pressed={mode === "month"}
            >
              <CalendarRange className="mr-1 h-3.5 w-3.5" /> Month
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => void refetch()}
            aria-label="Refresh calendar"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => shiftAnchor(-1)}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-2 text-sm font-medium tabular-nums">
            {headlineLabel}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => shiftAnchor(1)}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="ml-1 h-8 px-3 text-xs"
            onClick={() => setAnchor(new Date())}
          >
            Today
          </Button>
        </div>
        {attentionCount > 0 && (
          <div className="text-xs">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {attentionCount}{" "}
              {attentionCount === 1 ? "item needs" : "items need"} your
              attention
            </span>
          </div>
        )}
      </div>

      <TimezoneBanner timezone={tz} storageKey="calendar-tz-banner" />

      {/* Filter chips */}
      {(channelChips.length > 1 || statusChips.length > 1) && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-2 sm:flex-row sm:items-center sm:gap-3">
          {channelChips.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Channel:
              </span>
              <button
                type="button"
                onClick={() => setChannelFilter(null)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition",
                  channelFilter === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-accent",
                )}
              >
                All
              </button>
              {channelChips.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() =>
                    setChannelFilter(channelFilter === ch ? null : ch)
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition",
                    channelFilter === ch
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent",
                  )}
                >
                  <ChannelIconCompact channel={ch} size={12} />
                  {channelDisplayName(ch)}
                </button>
              ))}
            </div>
          )}
          {statusChips.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
              <span className="text-xs font-medium text-muted-foreground">
                Status:
              </span>
              <button
                type="button"
                onClick={() => setStatusFilter(null)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs capitalize transition",
                  statusFilter === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-accent",
                )}
              >
                All
              </button>
              {statusChips.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setStatusFilter(statusFilter === s ? null : s)
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs capitalize transition",
                    statusFilter === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent",
                  )}
                >
                  {s.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* The grid itself */}
      {isLoading ? (
        <div className="grid h-100 place-items-center rounded-lg border bg-background text-sm text-muted-foreground">
          Loading your calendar…
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="grid h-75 place-items-center rounded-lg border border-dashed bg-background p-6 text-center">
          <div>
            <div className="text-sm font-medium">Nothing scheduled yet</div>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Schedule your first post from the{" "}
              <Link
                href="/dashboard/content"
                className="text-primary underline-offset-2 hover:underline"
              >
                Content composer
              </Link>{" "}
              or the{" "}
              <Link
                href="/dashboard/integrations"
                className="text-primary underline-offset-2 hover:underline"
              >
                Beehiiv newsletter editor
              </Link>
              . It will appear here on the day it publishes.
            </p>
          </div>
        </div>
      ) : (
        <CalendarView
          items={data?.items ?? []}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          timezone={tz}
          mode={mode}
          onItemClick={(item) => setDrawerItem(item)}
          onItemMove={onItemMove}
        />
      )}

      {/* Keyboard hint */}
      <div className="text-[11px] text-muted-foreground">
        Shortcuts: <kbd className="rounded border bg-muted px-1">←</kbd> /{" "}
        <kbd className="rounded border bg-muted px-1">→</kbd> nav ·{" "}
        <kbd className="rounded border bg-muted px-1">T</kbd> today ·{" "}
        <kbd className="rounded border bg-muted px-1">W</kbd> /{" "}
        <kbd className="rounded border bg-muted px-1">M</kbd> week/month
      </div>

      {/* Per-item drawer */}
      <Sheet
        open={drawerItem !== null}
        onOpenChange={(open) => {
          if (!open) setDrawerItem(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md"
        >
          <SheetTitle className="sr-only">
            {drawerItem
              ? `${channelDisplayName(drawerItem.channel)} — ${formatScheduleLabel(
                  drawerItem.scheduledAtUtc,
                  drawerItem.audienceTimezone,
                )}`
              : "Scheduled item"}
          </SheetTitle>
          {drawerItem && (
            <CalendarItemDrawer
              item={drawerItem}
              onCancel={() => onCancelItem(drawerItem)}
              onRefreshStale={(newHash) =>
                onRefreshStale(drawerItem, newHash)
              }
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
