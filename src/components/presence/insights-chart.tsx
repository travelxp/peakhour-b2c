"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

/**
 * The recharts half of the insights panel, split out so the panel's text and
 * tiles stay in the server-rendered markup and only this chunk is lazy.
 */
export function InsightsChart({
  points,
  label,
  shortDate,
  formatNumber,
}: {
  points: { date: string; value: number | null }[];
  label: string;
  shortDate: (iso: string) => string;
  formatNumber: (n: number) => string;
}) {
  const chartConfig = {
    value: { label, color: "var(--chart-5)" },
  } satisfies ChartConfig;
  return (
      <ChartContainer config={chartConfig} className="h-56 w-full">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="presenceInsightsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeOpacity={0.4} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            fontSize={12}
            minTickGap={28}
            tickFormatter={shortDate}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            fontSize={12}
            width={32}
            allowDecimals={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideIndicator
                labelFormatter={(label) => shortDate(String(label))}
                formatter={(value) => (
                  <span className="font-medium tabular-nums">
                    {label}: {value === null || value === undefined ? "No data" : formatNumber(Number(value))}
                  </span>
                )}
              />
            }
          />
          <Area
            dataKey="value"
            type="monotone"
            stroke="var(--chart-5)"
            strokeWidth={2}
            fill="url(#presenceInsightsFill)"
            connectNulls={false}
            dot={{ r: 2, fill: "var(--chart-5)", strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
  );
}
