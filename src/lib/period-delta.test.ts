import { describe, it, expect } from "vitest";
import { periodDelta, deltaText, deltaSentence, SMALL_BASE } from "./period-delta";

describe("periodDelta", () => {
  it("gives a rounded percent on a normal base", () => {
    expect(periodDelta(112, 100)).toEqual({ direction: "up", tone: "good", basis: "percent", amount: 12, unit: "" });
    expect(periodDelta(75, 100)).toMatchObject({ direction: "down", tone: "bad", basis: "percent", amount: 25 });
    expect(periodDelta(1000, 333)).toMatchObject({ amount: 200 });
    expect(periodDelta(125, 120)).toMatchObject({ amount: 4 }); // 4.17 rounds down
  });

  it("is null, never 0%, when there is no prior value", () => {
    expect(periodDelta(50, null)).toBeNull();
    expect(periodDelta(50, undefined)).toBeNull();
    expect(periodDelta(50, Number.NaN)).toBeNull();
    expect(periodDelta(null, 50)).toBeNull();
    expect(periodDelta(Number.POSITIVE_INFINITY, 50)).toBeNull();
  });

  it("shows the absolute change when the previous value is 0", () => {
    expect(periodDelta(12, 0)).toMatchObject({ direction: "up", basis: "absolute", amount: 12 });
    expect(periodDelta(0, 0)).toMatchObject({ direction: "flat", amount: 0 });
  });

  it("shows the absolute change on a tiny base instead of a misleading percent", () => {
    expect(periodDelta(6, 3)).toMatchObject({ basis: "absolute", amount: 3, direction: "up" });
    expect(periodDelta(SMALL_BASE - 6, SMALL_BASE - 1)).toMatchObject({ basis: "absolute", direction: "down", amount: 5 });
    expect(periodDelta(SMALL_BASE + 1, SMALL_BASE)).toMatchObject({ basis: "percent" });
  });

  it("is flat when the change rounds to nothing", () => {
    expect(periodDelta(100, 100)).toMatchObject({ direction: "flat", tone: "neutral", amount: 0 });
    expect(periodDelta(1001, 1000)).toMatchObject({ direction: "flat" }); // 0.1%
    expect(periodDelta(5, 5)).toMatchObject({ direction: "flat" });
  });

  it("keeps direction apart from tone when lower is better", () => {
    expect(periodDelta(8.2, 11.4, { absoluteOnly: true, lowerIsBetter: true, decimals: 1, unit: "places" })).toEqual({
      direction: "down",
      tone: "good",
      basis: "absolute",
      amount: 3.2,
      unit: "places",
    });
    expect(periodDelta(12, 8, { absoluteOnly: true, lowerIsBetter: true })).toMatchObject({ direction: "up", tone: "bad" });
  });

  it("never gives a percent for absoluteOnly, even on a big base", () => {
    expect(periodDelta(62, 55, { absoluteOnly: true, unit: "pts" })).toMatchObject({ basis: "absolute", amount: 7, unit: "pts" });
  });

  it("treats a previous 0 as missing when zeroIsMissing (no ranking last period)", () => {
    expect(periodDelta(8, 0, { zeroIsMissing: true })).toBeNull();
    expect(periodDelta(8, 9, { zeroIsMissing: true })).not.toBeNull();
  });

  it("does not carry the unit on a percent", () => {
    expect(periodDelta(200, 100, { unit: "pts" })?.unit).toBe("");
  });
});

describe("deltaText and deltaSentence", () => {
  it("formats each basis", () => {
    expect(deltaText(periodDelta(112, 100)!)).toBe("+12%");
    expect(deltaText(periodDelta(75, 100)!)).toBe("-25%");
    expect(deltaText(periodDelta(1500, 0)!)).toBe("+1,500");
    expect(deltaText(periodDelta(62, 55, { absoluteOnly: true, unit: "pts" })!)).toBe("+7 pts");
    expect(deltaText(periodDelta(5, 5)!)).toBe("no change");
  });

  it("reads a full sentence", () => {
    expect(deltaSentence("People", periodDelta(112, 100)!, "the week before")).toBe(
      "People: up 12% compared with the week before.",
    );
    expect(deltaSentence("People", periodDelta(5, 5)!, "the week before")).toBe(
      "People: no change compared with the week before.",
    );
    const pos = periodDelta(8, 11, { absoluteOnly: true, lowerIsBetter: true, unit: "places" })!;
    expect(deltaSentence("Average position", pos, "a week ago", true)).toBe(
      "Average position: down 3 places compared with a week ago, which is better.",
    );
  });
});
