"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { TrendChart as TrendChartImpl } from "./trend-chart";

type TrendChartProps = ComponentProps<typeof TrendChartImpl>;

// recharts is the heaviest chart dependency and a chart is never first-paint
// critical, so it loads as its own chunk behind a same-height placeholder.
const TrendChartChunk = dynamic<TrendChartProps>(
  () => import("./trend-chart").then((m) => m.TrendChart),
  { ssr: false },
);

export function TrendChart(props: TrendChartProps) {
  return <TrendChartChunk {...props} />;
}
