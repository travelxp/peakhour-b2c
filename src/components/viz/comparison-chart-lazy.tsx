"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ComparisonChart as ComparisonChartImpl } from "./comparison-chart";

type Props = ComponentProps<typeof ComparisonChartImpl>;

// Same reason as trend-chart-lazy: recharts loads as its own chunk, off the first paint.
const Chunk = dynamic<Props>(() => import("./comparison-chart").then((m) => m.ComparisonChart), {
  ssr: false,
});

export function ComparisonChart(props: Props) {
  return <Chunk {...props} />;
}
