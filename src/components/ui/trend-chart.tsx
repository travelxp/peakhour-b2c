"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface TrendSeries {
  /** Key into each data row. */
  key: string;
  /** Legend/tooltip label. */
  label: string;
  /** CSS color (defaults to the primary chart token). */
  color?: string;
}

/**
 * A reusable day-grain trend area chart over the shadcn/recharts wrapper — the
 * first consumer of components/ui/chart.tsx. Deterministic, theme-aware. Points
 * carry a "YYYY-MM-DD" `date`; the x-axis renders a short "D Mon" tick.
 *
 * Renders a compact empty state (not a misleading flat line) when there are
 * fewer than two points — a fresh connection with no history yet.
 */
export function TrendChart({
  data,
  series,
  dateKey = "date",
  height = 220,
  emptyLabel = "Not enough history yet to chart a trend.",
  valueFormatter = (v: number) => v.toLocaleString(),
}: {
  data: Array<Record<string, string | number>>;
  series: TrendSeries[];
  dateKey?: string;
  height?: number;
  emptyLabel?: string;
  valueFormatter?: (value: number) => string;
}) {
  // Instance-unique prefix so two TrendCharts sharing a series key on one page
  // don't collide on the SVG gradient <defs> id (SVG ids are document-global).
  const gradPrefix = React.useId().replace(/:/g, "");
  const config: ChartConfig = React.useMemo(
    () =>
      Object.fromEntries(
        series.map((s, i) => [
          s.key,
          { label: s.label, color: s.color ?? `var(--chart-${(i % 5) + 1})` },
        ]),
      ),
    [series],
  );

  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const fmtDate = (value: string) => {
    // "YYYY-MM-DD" → "D Mon" (UTC — the series is UTC-day-keyed).
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  };

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${gradPrefix}-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${s.key})`} stopOpacity={0.28} />
              <stop offset="95%" stopColor={`var(--color-${s.key})`} stopOpacity={0.04} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={dateKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={fmtDate}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tickMargin={4}
          allowDecimals={false}
          tickFormatter={(v: number) => valueFormatter(v)}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(label) => fmtDate(String(label))} />}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            fill={`url(#${gradPrefix}-fill-${s.key})`}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
