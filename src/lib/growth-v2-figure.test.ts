import { describe, expect, it } from "vitest";
import { FIXTURE_HOME } from "./growth-v2-fixtures";
import type { HomeResponse } from "./api/growth-v2";
import { absentReason, currencyOf, figureText, figureValue, formatChange, formatDate, formatDay, formatMoney, homeHeadline, hoursUntil, isAbsent, unitFor } from "./growth-v2-figure";

describe("figure helpers keep absent apart from zero", () => {
  it("figureValue is undefined for absent, 0 for a real zero", () => {
    expect(figureValue({ absent: "x" })).toBeUndefined();
    expect(figureValue({ value: 0 })).toBe(0);
    expect(figureValue(undefined)).toBeUndefined();
  });

  it("isAbsent and absentReason agree", () => {
    expect(isAbsent({ absent: "why" })).toBe(true);
    expect(isAbsent({ value: 0 })).toBe(false);
    expect(absentReason({ absent: "why" })).toBe("why");
    expect(absentReason({ value: 3 })).toBeUndefined();
  });

  it("figureText prints the absence label, never 0", () => {
    expect(figureText({ absent: "x" })).toBe("Not available");
    expect(figureText({ value: 0 })).toBe("0");
    expect(figureText({ value: 1234567 })).toBe("12,34,567");
  });
});

describe("formatting", () => {
  it("formats rupees with Indian grouping and dollars with western", () => {
    expect(formatMoney(13940, "INR")).toBe("₹13,940");
    expect(formatMoney(1234567, "INR")).toBe("₹12,34,567");
    expect(formatMoney(13940, "USD")).toBe("$13,940");
  });

  it("prints a bare number when the currency is unknown or invalid, never a wrong symbol", () => {
    expect(formatMoney(410, "")).toBe("410");
    expect(formatMoney(410, "NOPE1")).toBe("NOPE1 410");
  });

  it("signs a change", () => {
    expect(formatChange(0.18)).toBe("+18%");
    expect(formatChange(-0.093)).toBe("-9%");
    expect(formatChange(0)).toBe("0%");
  });

  it("pins dates to UTC so the text does not depend on the host zone", () => {
    expect(formatDay("2026-10-26T23:30:00Z")).toBe("26 Oct");
    expect(formatDate("2026-10-02T09:00:00Z")).toBe("2 Oct 2026");
    expect(formatDay("not a date")).toBe("");
  });

  it("counts whole hours until a time, never negative", () => {
    const now = Date.parse("2026-10-26T11:00:00Z");
    expect(hoursUntil("2026-10-28T09:00:00Z", now)).toBe(46);
    expect(hoursUntil("2026-10-26T10:00:00Z", now)).toBe(0);
  });

  it("takes the currency of the first present money figure", () => {
    expect(currencyOf({ absent: "x" }, { value: 1, currency: "INR" })).toBe("INR");
    expect(currencyOf({ absent: "x" }, undefined)).toBe("");
  });
});

describe("homeHeadline", () => {
  it("reads the fixture as the prototype does", () => {
    expect(homeHeadline(FIXTURE_HOME, "INR")).toBe(
      "You got 34 trip bookings at ₹410 each, 9% cheaper than last month. 22 of them would not have happened without your ads, measured against a holdout.",
    );
  });

  it("leaves out the lift sentence when the extra count is absent, instead of saying none were caused", () => {
    const home: HomeResponse = { ...FIXTURE_HOME, kpis: FIXTURE_HOME.kpis.map((k) => (k.key === "incremental" ? { ...k, figure: { absent: "holdout too small" } } : k)) };
    const text = homeHeadline(home, "INR");
    expect(text).not.toContain("would not have happened");
    expect(text).not.toMatch(/\b0\b/);
  });

  it("leaves out the cost when it is absent, instead of saying 0 each", () => {
    const home: HomeResponse = { ...FIXTURE_HOME, efficiency: { ...FIXTURE_HOME.efficiency, you: { absent: "no spend" } } };
    expect(homeHeadline(home, "INR")).toBe("You got 34 trip bookings. 22 of them would not have happened without your ads, measured against a holdout.");
  });

  it("says there is no count yet rather than 0 when the outcome count is absent", () => {
    const home: HomeResponse = {
      ...FIXTURE_HOME,
      goal: undefined,
      kpis: FIXTURE_HOME.kpis.filter((k) => k.key !== "outcomes"),
    };
    expect(homeHeadline(home, "INR")).toBe("We don't have a count of your trip bookings for this month yet.");
    const week: HomeResponse = { ...home, window: { ...home.window, key: "7d" } };
    expect(homeHeadline(week, "INR")).toBe("We don't have a count of your trip bookings for the last 7 days yet.");
  });

  it("never words the month's goal figure as the window's count", () => {
    const week: HomeResponse = { ...FIXTURE_HOME, window: { ...FIXTURE_HOME.window, key: "7d" }, kpis: FIXTURE_HOME.kpis.filter((k) => k.key !== "outcomes") };
    // The goal still says 34 this month; the headline must not say it for the last 7 days.
    expect(week.goal!.soFar).toEqual({ value: 34 });
    expect(homeHeadline(week, "INR")).toBe("We don't have a count of your trip bookings for the last 7 days yet.");
  });

  it("speaks of return on ad spend for a roas mandate", () => {
    const home: HomeResponse = { ...FIXTURE_HOME, efficiency: { metric: "roas", you: { value: 3.24 }, target: { value: 3 }, industry: { value: 2.8 }, basis: "" }, kpis: FIXTURE_HOME.kpis.filter((k) => k.key !== "cost_per_outcome") };
    expect(homeHeadline(home, "INR")).toContain("3.2x return on ad spend");
  });
});

describe("review fixes", () => {
  it("keeps the cents of a small fractional cost", () => {
    expect(formatMoney(3.4, "USD")).toBe("$3.4");
    expect(formatMoney(3.456, "USD")).toBe("$3.46");
    expect(formatMoney(410, "USD")).toBe("$410");
  });

  it("has no hours for an expiry that does not parse, instead of NaN", () => {
    expect(hoursUntil("garbage", 0)).toBeUndefined();
  });

  it("drops the 'cheaper than last month' clause when the change rounds to 0%", () => {
    const home: HomeResponse = { ...FIXTURE_HOME, kpis: FIXTURE_HOME.kpis.map((k) => (k.key === "cost_per_outcome" ? { ...k, change: { value: -0.004 } } : k)) };
    expect(homeHeadline(home, "INR")).not.toContain("cheaper");
    expect(homeHeadline(home, "INR")).not.toContain("0%");
  });

  it("does not say zero outcomes would not have happened", () => {
    const home: HomeResponse = { ...FIXTURE_HOME, kpis: FIXTURE_HOME.kpis.map((k) => (k.key === "incremental" ? { ...k, figure: { value: 0 } } : k)) };
    const text = homeHeadline(home, "INR");
    expect(text).not.toContain("0 of them");
    expect(text).toContain("none of them can be credited");
  });

  it("uses a neutral unit when the mandate is unknown", () => {
    expect(unitFor(undefined)).toEqual({ one: "outcome", many: "outcomes" });
    expect(unitFor("bookings").many).toBe("bookings");
  });
});
