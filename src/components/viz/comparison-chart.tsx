"use client";

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ComparisonRow } from "@/lib/period-series";

/**
 * This period as a filled area, the period before it as a line, aligned day by
 * day (the Shadcnblocks "total revenue year comparison" pattern, on our chart
 * tokens). Colours come from --chart-1 and --chart-2 only. The series do not
 * rely on colour alone: the previous period is a dashed line.
 */

const config = {
  current: { label: "This period", color: "var(--chart-1)" },
  previous: { label: "Period before", color: "var(--chart-2)" },
} satisfies ChartConfig;

function fmtDate(value: string) {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

export function ComparisonChart({
  rows,
  height = 220,
}: {
  rows: ComparisonRow[];
  height?: number;
}) {
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={fmtDate}
        />
        <YAxis tickLine={false} axisLine={false} width={40} tickMargin={4} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as ComparisonRow | undefined;
                return row ? `${fmtDate(row.date)} (before: ${fmtDate(row.previousDate)})` : "";
              }}
            />
          }
        />
        <Area
          dataKey="current"
          type="monotone"
          fill="var(--color-current)"
          fillOpacity={0.2}
          stroke="var(--color-current)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="previous"
          type="monotone"
          stroke="var(--color-previous)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
