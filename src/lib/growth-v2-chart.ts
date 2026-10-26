import type { Figure, Money } from "@/lib/api/growth-v2";
import { absentReason, figureValue } from "@/lib/growth-v2-figure";

/**
 * The arithmetic behind the Growth v2 charts, kept out of the components so it
 * can be tested. Nothing here turns an absent figure into a number.
 */

// -- Waterfall (why a figure moved) ---------------------------------------------

export interface WaterfallItem {
  key: string;
  label: string;
  figure: Figure;
}

export type WaterfallBar =
  | { kind: "total"; label: string; from: number; to: number; value: number }
  | { kind: "up" | "down"; label: string; from: number; to: number; value: number }
  | { kind: "absent"; label: string; reason: string; at: number | undefined };

/**
 * Items run start, changes..., end. The first and the last are totals (`key`
 * "start" and "end"); everything between is a change that stacks on the running
 * total. A change with no figure is `absent`: it moves nothing, and the bar
 * after it carries on from the same total.
 *
 * A total with no figure makes the whole walk meaningless, so it yields no bars.
 */
export function waterfallBars(items: WaterfallItem[]): WaterfallBar[] {
  const isTotal = (i: WaterfallItem) => i.key === "start" || i.key === "end";
  const totals = items.filter(isTotal);
  if (totals.some((t) => figureValue(t.figure) === undefined)) return [];
  let run = 0;
  return items.map((item): WaterfallBar => {
    const v = figureValue(item.figure);
    if (isTotal(item)) {
      run = v as number;
      return { kind: "total", label: item.label, from: 0, to: run, value: run };
    }
    if (v === undefined) return { kind: "absent", label: item.label, reason: absentReason(item.figure) ?? "", at: run };
    const from = run;
    run += v;
    return { kind: v < 0 ? "down" : "up", label: item.label, from, to: run, value: v };
  });
}

// -- Funnel -------------------------------------------------------------------------

export interface FunnelRow {
  key: string;
  label: string;
  value: number | undefined;
  reason?: string;
  /** Share of the previous present stage that reached this one, when both exist. */
  rateFromPrev?: number;
}

/**
 * Stage rows with the conversion from the previous stage. A stage with no
 * figure is skipped as the "previous" one: the rate is only ever between two
 * stages that were both counted, so a gap never reads as a 100% drop.
 */
export function funnelRows(stages: Array<{ key: string; label: string; figure: Figure }>): FunnelRow[] {
  let prev: number | undefined;
  return stages.map((s) => {
    const value = figureValue(s.figure);
    const row: FunnelRow = { key: s.key, label: s.label, value, reason: absentReason(s.figure) };
    if (value !== undefined) {
      if (prev !== undefined && prev > 0) row.rateFromPrev = value / prev;
      prev = value;
    }
    return row;
  });
}

// -- Pacing -------------------------------------------------------------------------

export type PacingState = "healthy" | "ahead" | "over" | "unknown";

/**
 * Spend against an even climb to the ceiling.
 *
 * - `over`: spend has passed the ceiling.
 * - `ahead`: spend is more than 10% above the even pace for today.
 * - `healthy`: at or under that pace, or within 10% above it.
 * - `unknown`: either money figure is absent, or the month length is unknown and spend is under the ceiling.
 */
export function pacingState(spent: Money, ceiling: Money, daysLeft: number, daysInMonth: number): PacingState {
  const s = figureValue(spent);
  const c = figureValue(ceiling);
  if (s === undefined || c === undefined || !(c > 0)) return "unknown";
  if (s > c) return "over";
  if (!(daysInMonth > 0)) return "unknown";
  const elapsed = Math.min(Math.max(daysInMonth - daysLeft, 0), daysInMonth);
  const ideal = (c * elapsed) / daysInMonth;
  return s > ideal * 1.1 ? "ahead" : "healthy";
}

/** The even-pace spend for day `elapsed` of `daysInMonth`. */
export function idealSpend(ceiling: number, elapsed: number, daysInMonth: number): number {
  return daysInMonth > 0 ? (ceiling * elapsed) / daysInMonth : 0;
}

// -- Share by week ---------------------------------------------------------------------

/** Share of the week no platform's figure covers, from 0 to 1. Absent shares count as uncovered, not zero. */
export function uncoveredShare(shares: Array<{ share: Figure }>): number {
  const covered = shares.reduce((sum, s) => sum + (figureValue(s.share) ?? 0), 0);
  return Math.max(0, 1 - covered);
}
