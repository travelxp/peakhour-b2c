"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * "Your business at a glance" — the four figures that used to float as
 * unlabelled KPI tiles, grouped under one heading and given something to say.
 *
 * ★A NUMBER ON ITS OWN IS NOT A DASHBOARD. The tiles this replaces printed
 * "12 / Content Library / 8 AI-tagged" and left the reader to decide whether 12
 * was good, what to do about it, or why "Customers" showed a dash. Every card
 * here carries three things instead, in a fixed order the eye can learn:
 *
 *   1. ONE figure or status — what it is.
 *   2. ONE line of plain English — what that means.
 *   3. ONE next step — what to do, as a link that lands on the exact screen.
 *
 * ★AND ZERO IS A FIRST-RUN STATE, NOT AN EMPTY ONE. A new business genuinely
 * has 0 of everything, and printing four zeroes is the fastest way to make a
 * working product look broken. When a metric has no data yet the card drops the
 * figure entirely and promotes the next step into its place — `emptyAction`
 * below. The tile keeps its shape; only what it leads with changes.
 */

/**
 * Which chart series this figure belongs to, in the platform's fixed pillar
 * order: 1 Commerce · 2 Content · 3 Growth · 4 Support · 5 Presence. Going
 * through --chart-* is what makes a tile and the chart plotting the same metric
 * agree by construction, and it picks up the dark-mode step for free.
 */
export type PillarSeries = 1 | 2 | 3 | 4 | 5;

const SERIES_TINT: Record<PillarSeries, string> = {
  1: "bg-chart-1/12 text-chart-1 dark:bg-chart-1/18",
  2: "bg-chart-2/12 text-chart-2 dark:bg-chart-2/18",
  3: "bg-chart-3/12 text-chart-3 dark:bg-chart-3/18",
  4: "bg-chart-4/12 text-chart-4 dark:bg-chart-4/18",
  5: "bg-chart-5/12 text-chart-5 dark:bg-chart-5/18",
};

export interface GlanceCardProps {
  label: string;
  icon: LucideIcon;
  series: PillarSeries;
  /** The one figure. Omit (or pass null) when there is nothing to show yet. */
  value?: number | string | null;
  /** Plain-English line under the figure. What the number MEANS. */
  meaning?: string;
  /** The one next step. Text only — the whole card is the link. */
  action: string;
  href: string;
  /**
   * Shown INSTEAD of the figure when this metric has no data for this business
   * yet. Two different situations, one treatment: "you have not done this yet"
   * and "this cannot be measured until you connect something".
   */
  emptyAction?: string;
  loading?: boolean;
}

export function GlanceCard({
  label,
  icon: Icon,
  series,
  value,
  meaning,
  action,
  href,
  emptyAction,
  loading,
}: GlanceCardProps) {
  // `== null` catches undefined too. A real zero is NOT empty — a business with
  // 0 active campaigns and 12 in its library has a true answer to give, and
  // treating it as missing would hide a working metric behind an invitation.
  const isEmpty = !loading && emptyAction !== undefined && value == null;

  return (
    <Link href={href} className="group block">
      {/* u-lift/u-rail are the shared motion primitives from globals.css,
          applied through className so <Card> itself stays regenerable. Both are
          pointer-guarded and inert under prefers-reduced-motion. */}
      <Card className="u-lift u-rail relative h-full overflow-hidden">
        <CardContent className="flex h-full flex-col gap-2 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                SERIES_TINT[series],
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
          </div>

          {loading ? (
            <span className="h-8 w-16 animate-pulse rounded-lg bg-muted" />
          ) : isEmpty ? (
            // No figure at all. A dash or an em-dash in a headline slot is the
            // single clearest way to tell someone software is unfinished.
            <p className="text-sm font-semibold leading-snug">{emptyAction}</p>
          ) : (
            <p className="text-3xl font-bold leading-none tabular-nums tracking-tight">
              {value ?? 0}
            </p>
          )}

          {!loading && !isEmpty && meaning && (
            <p className="text-xs leading-snug text-muted-foreground">{meaning}</p>
          )}

          {/* Pinned to the bottom with `mt-auto` so the next-step line sits on
              one baseline across the row, however tall each card's meaning
              wraps. Without it a four-card row reads as four different objects. */}
          <p className="mt-auto inline-flex items-center gap-1 pt-1 text-[11px] font-semibold text-brand-label">
            {action}
            <ArrowRight
              className="size-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden
            />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function BusinessAtAGlance({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="glance-heading" className="space-y-3">
      <h2 id="glance-heading" className="text-base font-semibold">
        Your business at a glance
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}
