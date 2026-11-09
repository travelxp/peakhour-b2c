import type { Figure, HomeResponse } from "@/lib/api/growth-v2";
import { figureValue } from "@/lib/growth-v2-figure";

/**
 * Chart series the Growth v2 screens draw.
 *
 * Home's come from its own response (`lift.weeks`, each KPI's `spark`, `pacing.series`), read out by
 * `seriesFromHome`. Channels & money still has a gap until H3: its day-by-day line has only the preview sample. A
 * screen given `undefined` says the series is not available. It never draws a flat line.
 */

/** One week of the lift chart: with ads against the holdout, scaled, with its range. */
export interface LiftWeek {
  /** ISO date of the week's first day. */
  weekStart: string;
  withAds: number;
  holdout: number;
  /** The range around `withAds`. Absent when the week is low-powered. */
  low?: number;
  high?: number;
}

export interface HomeSeries {
  liftWeeks: LiftWeek[];
  /** A per-week goal line, when the merchant has a goal. */
  weeklyGoal?: number;
  /** A short trend per KPI key, oldest first. */
  sparks: Record<string, number[]>;
}

/** Cumulative spend by day of the month, for the pacing chart. */
export interface PacingSeries {
  /** Day of the month (1-based) and cumulative spend to the end of that day. */
  points: Array<{ day: number; spend: number }>;
  daysInMonth: number;
  /** Days with no spend row at all: unknown, not free. */
  missingDays?: number[];
}

/**
 * A spark line's numbers: the latest unbroken run of weeks that were read.
 *
 * ★A WEEK THAT COULD NOT BE READ IS A BREAK, NOT A 0. Joining the points on either side would draw a trend nobody
 * measured, so only the newest run is drawn, and with fewer than two points there is no line.
 */
export function sparkValues(spark: Figure[] | undefined): number[] | undefined {
  if (!spark) return undefined;
  const run: number[] = [];
  for (let i = spark.length - 1; i >= 0; i--) {
    const v = figureValue(spark[i]);
    if (v === undefined) break;
    run.unshift(v);
  }
  return run.length >= 2 ? run : undefined;
}

/** The chart series a Growth home response carries, in the shapes the charts draw. */
export function seriesFromHome(home: HomeResponse): { series?: HomeSeries; pacingSeries?: PacingSeries } {
  const sparks: Record<string, number[]> = {};
  for (const k of home.kpis) {
    const v = sparkValues(k.spark);
    if (v) sparks[k.key] = v;
  }
  const weeks = home.lift.weeks;
  const pacing = home.pacing.series;
  return {
    ...(weeks || Object.keys(sparks).length > 0
      ? { series: { liftWeeks: weeks ?? [], ...(home.lift.weeklyGoal !== undefined ? { weeklyGoal: home.lift.weeklyGoal } : {}), sparks } }
      : {}),
    ...(pacing ? { pacingSeries: { points: pacing.points, daysInMonth: pacing.daysInMonth, missingDays: pacing.missingDays } } : {}),
  };
}
