import { describe, it, expect } from "vitest";
import { intervalSuffix, periodTotals, priceForTerm, termOptions, termSuffix } from "./billing-terms";

/** The real catalog's shape: Suite monthly and yearly, Agency quarterly and
 *  yearly, Enterprise through sales (no sellable term). */
const SUITE = { amount: 4999, termPrices: [{ term: "monthly" as const, amount: 4999 }, { term: "yearly" as const, amount: 49999 }] };
const AGENCY = { amount: 24999, termPrices: [{ term: "quarterly" as const, amount: 74997 }, { term: "yearly" as const, amount: 249999 }] };
const ENTERPRISE = { amount: 0, termPrices: [] };

describe("priceForTerm", () => {
  it("the picked term when the plan sells it", () => {
    expect(priceForTerm(SUITE, "yearly")).toEqual({ term: "yearly", amount: 49999, fallback: false });
    expect(priceForTerm(AGENCY, "quarterly")).toEqual({ term: "quarterly", amount: 74997, fallback: false });
  });

  it("Agency under Monthly: its first sold term, flagged, never a monthly figure it is not sold at", () => {
    expect(priceForTerm(AGENCY, "monthly")).toEqual({ term: "quarterly", amount: 74997, fallback: true });
    expect(priceForTerm(SUITE, "quarterly")).toEqual({ term: "monthly", amount: 4999, fallback: true });
  });

  it("no sellable term (Enterprise, contact sales): null", () => {
    expect(priceForTerm(ENTERPRISE, "monthly")).toBeNull();
  });

  it("an api without termPrices prices monthly from amount, as before", () => {
    expect(priceForTerm({ amount: 4999 }, "monthly")).toEqual({ term: "monthly", amount: 4999, fallback: false });
    expect(priceForTerm({ amount: 4999 }, "yearly")).toEqual({ term: "monthly", amount: 4999, fallback: true });
  });
});

describe("termOptions", () => {
  it("every term any plan sells, in month-quarter-year order", () => {
    expect(termOptions([AGENCY, SUITE, ENTERPRISE])).toEqual(["monthly", "quarterly", "yearly"]);
    expect(termOptions([AGENCY])).toEqual(["quarterly", "yearly"]);
    expect(termOptions([{}])).toEqual([]);
  });
});

describe("suffixes", () => {
  it("a quarter is /quarter, a year /yr; an absent or unknown interval is a monthly line", () => {
    expect(intervalSuffix("quarter")).toBe("/quarter");
    expect(intervalSuffix("year")).toBe("/yr");
    expect(intervalSuffix("month")).toBe("/mo");
    expect(intervalSuffix(undefined)).toBe("/mo");
    expect(intervalSuffix("week")).toBe("/mo");
    expect(termSuffix("quarterly")).toBe("/quarter");
  });
});

describe("periodTotals", () => {
  it("a quarterly-only business never reads ₹0 a month", () => {
    expect(periodTotals({ monthlyTotal: 0, quarterlyTotal: 74997, yearlyTotal: null })).toEqual([{ interval: "quarter", amount: 74997 }]);
  });

  it("each period present, in month-quarter-year order", () => {
    expect(periodTotals({ monthlyTotal: 4999, quarterlyTotal: 74997, yearlyTotal: 249999 })).toEqual([
      { interval: "month", amount: 4999 },
      { interval: "quarter", amount: 74997 },
      { interval: "year", amount: 249999 },
    ]);
  });

  it("monthly only (or nothing at all): one monthly figure, zero included", () => {
    expect(periodTotals({ monthlyTotal: 4999 })).toEqual([{ interval: "month", amount: 4999 }]);
    expect(periodTotals({ monthlyTotal: 0 })).toEqual([{ interval: "month", amount: 0 }]);
  });

  it("an order confirmation's string totals", () => {
    expect(periodTotals({ monthlyTotal: "0.00", quarterlyTotal: "74997.00" })).toEqual([{ interval: "quarter", amount: 74997 }]);
  });

  it("no monthly figure (a mixed-currency portfolio): nothing", () => {
    expect(periodTotals({ monthlyTotal: null, quarterlyTotal: null, yearlyTotal: null })).toEqual([]);
  });
});
