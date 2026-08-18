"use client";

import { cn } from "@/lib/utils";

/**
 * Tiny inline-SVG sparkline — a dependency-free micro-trend (no per-widget
 * recharts overhead). Renders nothing when there's no series or the series is
 * flat-zero, so a surface with no analytics yet shows a clean gap rather than a
 * misleading flat line. Shared UI primitive (promoted from the autopilot channel
 * widgets); use ui/trend-chart.tsx for a full axed/tooltipped chart.
 */
export function Sparkline({
  data,
  className,
  width = 96,
  height = 28,
}: {
  data: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  if (max <= 0) return null; // all-zero → no trend to show

  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    // Inset by 2px top/bottom so the stroke isn't clipped.
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const gradId = `spark-grad-${width}-${height}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible text-primary", className)}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
