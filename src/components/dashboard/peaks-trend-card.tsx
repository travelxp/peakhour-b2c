"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/viz/trend-chart";
import { useCreditsHistory } from "@/hooks/use-credits";

/**
 * Peaks spent, last 30 days.
 *
 * Composition only — GET /v1/dashboard/credits/history already returns daily
 * totals and components/viz/trend-chart.tsx already draws a theme-aware,
 * tooltipped day-grain area. Nothing new is fetched or drawn here.
 *
 * Two decisions worth knowing:
 *
 * 1. The series is --brand-strong, not --chart-1. Peaks is the platform's
 *    currency rather than a pillar, and --chart-1 *means* Commerce in the
 *    validated series palette — borrowing it would say this chart is about
 *    Commerce. --brand-strong is theme-stable and measures 3.3:1 on a light
 *    card and 5.1:1 on a dark one, clearing the 3:1 a non-text mark needs in
 *    both. (--brand itself is 2.1:1 on white, which is exactly why the token
 *    file keeps --brand-label around for small text.)
 *
 * 2. Missing days are filled with zero. The api aggregates ts_usage_meters by
 *    day, so a day with no AI usage produces no row at all. Charting the rows
 *    as-is would silently compress the x-axis — three scattered days of use
 *    would draw as three adjacent points and read like continuous activity.
 *    A quiet day is data.
 */

const DAYS = 30;

/** "YYYY-MM-DD" in UTC, matching the api's $dateToString bucket. */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function PeaksTrendCard({ className }: { className?: string }) {
  const { data, isLoading } = useCreditsHistory();

  const series = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const row of data?.days ?? []) byDay.set(row.date, row.peaks);

    const today = new Date();
    return Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(today.getTime() - (DAYS - 1 - i) * 86_400_000);
      const key = isoDay(d);
      return { date: key, peaks: byDay.get(key) ?? 0 };
    });
  }, [data]);

  const total = data?.total ?? 0;
  const spentToday = series[series.length - 1]?.peaks ?? 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <CardTitle className="text-base font-semibold">Peaks spent</CardTitle>
          <span className="text-xs text-muted-foreground">
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {total.toLocaleString()}
            </span>{" "}
            in 30 days
            {spentToday > 0 && (
              <>
                {" · "}
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {spentToday.toLocaleString()}
                </span>{" "}
                today
              </>
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[180px] animate-pulse rounded-lg bg-muted" />
        ) : (
          <TrendChart
            data={series}
            height={180}
            series={[{ key: "peaks", label: "Peaks", color: "var(--brand-strong)" }]}
            emptyLabel="No AI usage yet — your first Peaks will chart here."
          />
        )}
      </CardContent>
    </Card>
  );
}
