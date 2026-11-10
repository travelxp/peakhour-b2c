/**
 * Splits a day-grain series into "this period" and "the period before it",
 * aligned day by day, for the comparison chart.
 *
 * It returns null unless the last 2 x `days` calendar days are ALL present.
 * A series with holes (a sync gap, GSC's reporting lag) would otherwise be
 * compared index by index and silently pair the wrong days, so a short or
 * gappy series gets no comparison rather than a wrong one.
 */

export interface DayPoint {
  /** "YYYY-MM-DD", UTC. */
  date: string;
  [key: string]: string | number;
}

export interface ComparisonRow {
  /** Date of the day in this period. */
  date: string;
  /** Date of the aligned day in the previous period. */
  previousDate: string;
  current: number;
  previous: number;
}

export interface PeriodComparison {
  rows: ComparisonRow[];
  currentTotal: number;
  previousTotal: number;
}

const DAY_MS = 86_400_000;

function dayNumber(date: string): number | null {
  const t = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isNaN(t) ? null : Math.round(t / DAY_MS);
}

export function splitPeriods(
  points: readonly DayPoint[] | undefined,
  valueKey: string,
  days: number,
): PeriodComparison | null {
  if (!points || days < 1 || points.length < days * 2) return null;
  const tail = points.slice(-days * 2);
  let prevDay: number | null = null;
  for (const p of tail) {
    const n = dayNumber(p.date);
    const v = p[valueKey];
    if (n === null || typeof v !== "number" || !Number.isFinite(v)) return null;
    if (prevDay !== null && n !== prevDay + 1) return null;
    prevDay = n;
  }
  const previous = tail.slice(0, days);
  const current = tail.slice(days);
  const rows = current.map((p, i) => ({
    date: p.date,
    previousDate: previous[i].date,
    current: p[valueKey] as number,
    previous: previous[i][valueKey] as number,
  }));
  return {
    rows,
    currentTotal: rows.reduce((a, r) => a + r.current, 0),
    previousTotal: rows.reduce((a, r) => a + r.previous, 0),
  };
}
