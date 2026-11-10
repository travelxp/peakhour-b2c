import { describe, it, expect } from "vitest";
import { splitPeriods } from "./period-series";

function series(n: number, start = "2026-10-01", skip: number[] = []) {
  const out: Array<{ date: string; sessions: number }> = [];
  const t0 = Date.parse(`${start}T00:00:00.000Z`);
  for (let i = 0; i < n; i++) {
    if (skip.includes(i)) continue;
    out.push({ date: new Date(t0 + i * 86_400_000).toISOString().slice(0, 10), sessions: i + 1 });
  }
  return out;
}

describe("splitPeriods", () => {
  it("pairs each day with the same day of the earlier period", () => {
    const r = splitPeriods(series(14), "sessions", 7)!;
    expect(r.rows).toHaveLength(7);
    expect(r.rows[0]).toEqual({ date: "2026-10-08", previousDate: "2026-10-01", current: 8, previous: 1 });
    expect(r.currentTotal).toBe(8 + 9 + 10 + 11 + 12 + 13 + 14);
    expect(r.previousTotal).toBe(28);
  });

  it("uses only the last two periods of a longer series", () => {
    const r = splitPeriods(series(30), "sessions", 7)!;
    expect(r.rows[6].date).toBe("2026-10-30");
    expect(r.rows[0].previousDate).toBe("2026-10-17");
  });

  it("is null when there is not a full prior period", () => {
    expect(splitPeriods(series(13), "sessions", 7)).toBeNull();
    expect(splitPeriods([], "sessions", 7)).toBeNull();
    expect(splitPeriods(undefined, "sessions", 7)).toBeNull();
  });

  it("is null when a day is missing, rather than pairing the wrong days", () => {
    expect(splitPeriods(series(15, "2026-10-01", [3]), "sessions", 7)).toBeNull();
  });

  it("is null for a bad date or a non-numeric value", () => {
    const bad = series(14);
    bad[5] = { date: "not-a-date", sessions: 1 };
    expect(splitPeriods(bad, "sessions", 7)).toBeNull();
    expect(splitPeriods(series(14), "missing", 7)).toBeNull();
  });
});
