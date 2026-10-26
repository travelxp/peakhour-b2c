/**
 * Chart series the Growth v2 screens draw that the plan 2.10 response shapes do
 * not carry.
 *
 * ★A CONTRACT GAP, NOT A DESIGN. `HomeResponse.lift` is a single percentage and
 * `pacing` is two totals, so the weekly with-ads-versus-holdout band, the KPI
 * sparklines and the day-by-day pacing line have nothing to draw from. The
 * prototype shows all three. Until the plan's contract carries them (H1 / H3),
 * only the preview sample has them, and a screen given `undefined` says the
 * series is not available. It never draws a flat line.
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
}
