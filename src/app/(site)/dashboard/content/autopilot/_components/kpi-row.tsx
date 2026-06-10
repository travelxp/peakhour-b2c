"use client";

import { Send, Inbox, CalendarClock, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HomeSummary } from "@/hooks/use-home-summary";

/**
 * Three honest, glanceable KPIs. We deliberately resist a wall of charts
 * (a CEO-level decision): these three answer "did it ship, what do I owe
 * it, what's coming" — the only numbers that change behaviour. "Needs you"
 * is emphasised because it's the one that drives a return visit.
 */

interface Kpi {
  key: keyof HomeSummary["kpis"];
  label: string;
  icon: LucideIcon;
  hint: string;
  emphasise?: boolean;
}

const KPIS: Kpi[] = [
  {
    key: "publishedThisWeek",
    label: "Published this week",
    icon: Send,
    hint: "Posts the engine shipped in the last 7 days",
  },
  {
    key: "needsYou",
    label: "Needs you",
    icon: Inbox,
    hint: "Approvals, failed sends, and reconnects waiting on you",
    emphasise: true,
  },
  {
    key: "scheduledUpcoming",
    label: "Scheduled",
    icon: CalendarClock,
    hint: "Posts queued to publish on their own",
  },
];

export function KpiRow({ kpis }: { kpis: HomeSummary["kpis"] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {KPIS.map((k) => {
        const value = kpis[k.key];
        const Icon = k.icon;
        const active = k.emphasise && value > 0;
        return (
          <Card
            key={k.key}
            className={cn(
              "gap-0 p-4 transition-colors",
              active && "border-amber-300 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/30",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {k.label}
              </span>
              <Icon
                className={cn(
                  "size-4 text-muted-foreground/60",
                  active && "text-amber-600 dark:text-amber-500",
                )}
              />
            </div>
            <div
              className={cn(
                "mt-1 text-3xl font-semibold tabular-nums tracking-tight",
                active && "text-amber-700 dark:text-amber-400",
              )}
            >
              {value}
            </div>
            <p className="mt-1 text-xs text-muted-foreground/70">{k.hint}</p>
          </Card>
        );
      })}
    </div>
  );
}
