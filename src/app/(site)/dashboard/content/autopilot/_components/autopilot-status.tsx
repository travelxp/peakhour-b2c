"use client";

import { CheckCircle2, Clock, AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AutopilotState } from "@/hooks/use-home-summary";

/**
 * The autopilot status chip — the one-glance answer to "is my content
 * engine working, waiting on me, or stuck?" Plain language, no jargon.
 * This is the emotional anchor of the page: it tells an owner whether the
 * thing they're paying for is alive.
 */

const STYLES: Record<
  AutopilotState,
  { label: string; icon: LucideIcon; dot: string; ring: string; text: string }
> = {
  working: {
    label: "Autopilot is working",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    ring: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  waiting: {
    label: "Waiting on you",
    icon: Clock,
    dot: "bg-amber-500",
    ring: "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
  },
  stalled: {
    label: "Needs attention",
    icon: AlertTriangle,
    dot: "bg-rose-500",
    ring: "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
  },
};

function formatLastRun(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function AutopilotStatus({
  state,
  reason,
  lastRunAt,
}: {
  state: AutopilotState;
  reason: string;
  lastRunAt: string | null;
}) {
  const s = STYLES[state];
  const Icon = s.icon;
  const lastRun = formatLastRun(lastRunAt);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3.5 py-2.5",
        s.ring,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-2.5 shrink-0">
        {state !== "stalled" && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              s.dot,
            )}
          />
        )}
        <span className={cn("relative inline-flex size-2.5 rounded-full", s.dot)} />
      </span>
      <Icon className={cn("size-4 shrink-0", s.text)} />
      <span className={cn("text-sm font-semibold", s.text)}>{s.label}</span>
      <span className="text-sm text-muted-foreground">— {reason}</span>
      {lastRun && (
        <span className="ml-auto text-xs text-muted-foreground/70">
          last run {lastRun}
        </span>
      )}
    </div>
  );
}
