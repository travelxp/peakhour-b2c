import { describe, expect, it } from "vitest";
import { funnelRows, idealSpend, pacingState, uncoveredShare, waterfallBars, type WaterfallItem } from "./growth-v2-chart";

const walk = (...steps: Array<[string, number | { absent: string }]>): WaterfallItem[] =>
  steps.map(([key, f]) => ({ key, label: key, figure: typeof f === "number" ? { value: f } : f }));

describe("waterfallBars", () => {
  it("stacks changes on the running total between a start and an end", () => {
    const bars = waterfallBars(walk(["start", 452], ["a", -28], ["b", -19], ["c", 9], ["d", -4], ["end", 410]));
    expect(bars.map((b) => b.kind)).toEqual(["total", "down", "down", "up", "down", "total"]);
    expect(bars[1]).toMatchObject({ from: 452, to: 424 });
    expect(bars[3]).toMatchObject({ from: 405, to: 414 });
  });

  it("marks a change with no figure absent and carries the total across it unchanged", () => {
    const bars = waterfallBars(walk(["start", 100], ["a", -10], ["b", { absent: "no data" }], ["c", -5], ["end", 85]));
    expect(bars[2]).toEqual({ kind: "absent", label: "b", reason: "no data", at: 90 });
    expect(bars[3]).toMatchObject({ from: 90, to: 85 });
  });

  it("yields no bars when a total is absent, rather than walking from a guess", () => {
    expect(waterfallBars(walk(["start", { absent: "x" }], ["a", -10], ["end", 85]))).toEqual([]);
    expect(waterfallBars(walk(["start", 100], ["a", -10], ["end", { absent: "x" }]))).toEqual([]);
  });
});

describe("funnelRows", () => {
  const stage = (key: string, f: number | { absent: string }) => ({ key, label: key, figure: typeof f === "number" ? { value: f } : f });

  it("gives each counted stage its rate from the previous counted one", () => {
    const rows = funnelRows([stage("a", 1000), stage("b", 100), stage("c", 25)]);
    expect(rows.map((r) => r.rateFromPrev)).toEqual([undefined, 0.1, 0.25]);
  });

  it("skips an uncounted stage, so the gap is not read as a total drop", () => {
    const rows = funnelRows([stage("a", 1000), stage("b", { absent: "not tracked" }), stage("c", 50)]);
    expect(rows[1]).toMatchObject({ value: undefined, reason: "not tracked" });
    expect(rows[1].rateFromPrev).toBeUndefined();
    expect(rows[2].rateFromPrev).toBe(0.05);
  });

  it("gives no rate from a previous stage of zero", () => {
    expect(funnelRows([stage("a", 0), stage("b", 5)])[1].rateFromPrev).toBeUndefined();
  });
});

describe("pacingState", () => {
  const m = (value: number) => ({ value, currency: "INR" });
  // Day 22 of 31 with 9 left: the even pace is 20,000 * 22 / 31 = 14,193.5.
  it("is healthy at or under the even pace, and within 10% above it", () => {
    expect(pacingState(m(13940), m(20000), 9, 31)).toBe("healthy");
    expect(pacingState(m(15500), m(20000), 9, 31)).toBe("healthy");
  });

  it("is ahead beyond 10% over the even pace, and over past the ceiling", () => {
    expect(pacingState(m(16000), m(20000), 9, 31)).toBe("ahead");
    expect(pacingState(m(20001), m(20000), 9, 31)).toBe("over");
  });

  it("is unknown when a money figure is absent, never healthy", () => {
    expect(pacingState({ absent: "x" }, m(20000), 9, 31)).toBe("unknown");
    expect(pacingState(m(100), { absent: "x" }, 9, 31)).toBe("unknown");
  });

  it("is unknown without a month length, and for a ceiling of zero", () => {
    expect(pacingState(m(100), m(20000), 9, 0)).toBe("unknown");
    expect(pacingState(m(0), m(0), 9, 31)).toBe("unknown");
  });
});

describe("idealSpend / uncoveredShare", () => {
  it("climbs evenly to the ceiling", () => {
    expect(idealSpend(20000, 31, 31)).toBe(20000);
    expect(idealSpend(20000, 0, 31)).toBe(0);
    expect(idealSpend(20000, 5, 0)).toBe(0);
  });

  it("counts a missing share as uncovered, not as zero covered", () => {
    expect(uncoveredShare([{ share: { value: 0.5 } }, { share: { value: 0.3 } }])).toBeCloseTo(0.2);
    expect(uncoveredShare([{ share: { value: 0.5 } }, { share: { absent: "x" } }])).toBeCloseTo(0.5);
    expect(uncoveredShare([{ share: { value: 1.2 } }])).toBe(0);
  });
});

describe("pacingState without a known month length", () => {
  const m = (value: number) => ({ value, currency: "INR" });
  it("still says over the ceiling, which needs no month", () => {
    expect(pacingState(m(21000), m(20000), 9, 0)).toBe("over");
  });
});
