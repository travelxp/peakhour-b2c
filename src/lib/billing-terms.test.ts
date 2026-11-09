import { describe, it, expect } from "vitest";
import {
  intervalSuffix,
  currentOnTerm,
  knownRecurringTotal,
  lineCostText,
  periodTotals,
  priceForTerm,
  recurringTotalText,
  termOptions,
  termSuffix,
  type RecurringTotalsish,
} from "./billing-terms";

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

describe("currentOnTerm (D21, P4.2)", () => {
  it("a plan held on a term is current on that term only", () => {
    expect(currentOnTerm({ isCurrent: true, heldTerm: "monthly" }, "monthly")).toBe(true);
    expect(currentOnTerm({ isCurrent: true, heldTerm: "monthly" }, "yearly")).toBe(false);
  });

  it("a current plan with no held term (base plan, comp, older api) is current on every term", () => {
    expect(currentOnTerm({ isCurrent: true, heldTerm: null }, "yearly")).toBe(true);
    expect(currentOnTerm({ isCurrent: true }, "quarterly")).toBe(true);
  });

  it("a plan not held is never current", () => {
    expect(currentOnTerm({ isCurrent: false, heldTerm: "yearly" }, "yearly")).toBe(false);
    expect(currentOnTerm({ isCurrent: false }, "monthly")).toBe(false);
  });
});

/**
 * An unknown amount is never a 0 (P4.3b, api#1510). The api sums an unpriced
 * line as 0 into its period's total and flags the summary incomplete, so the
 * figures below are what `/v1/billing/summary` serves for each portfolio.
 */
describe("the recurring total never states an unknown amount as 0 (P4.3b)", () => {
  const fmt = (n: number) => `INR ${n}`;
  const line = (interval: string, amountKnown: boolean, endsAt: string | null = null) => ({ interval, amountKnown, endsAt });
  const totals = (over: Partial<RecurringTotalsish>): RecurringTotalsish => ({
    monthlyTotal: null,
    quarterlyTotal: null,
    yearlyTotal: null,
    monthlyTotalComplete: true,
    products: [],
    ...over,
  });

  it("★a priced Suite beside an unpriced quarterly Agency reads the Suite and a +, never INR 0/quarter", () => {
    const s = totals({ monthlyTotal: 4999, quarterlyTotal: 0, monthlyTotalComplete: false, products: [line("month", true), line("quarter", false)] });
    expect(knownRecurringTotal(s, fmt)).toBe("INR 4999/mo");
    expect(recurringTotalText(s, fmt)).toBe("INR 4999/mo+");
  });

  it("★an unpriced monthly line beside a priced quarterly one reads the quarter and a +", () => {
    const s = totals({ monthlyTotal: 0, quarterlyTotal: 74997, monthlyTotalComplete: false, products: [line("month", false), line("quarter", true)] });
    expect(recurringTotalText(s, fmt)).toBe("INR 74997/quarter+");
  });

  it("★a period whose only figure is an unpriced line's 0 is left out even when it is the only period", () => {
    const s = totals({ monthlyTotal: 0, monthlyTotalComplete: false, products: [line("month", false), line("month", true)] });
    expect(knownRecurringTotal(s, fmt)).toBeNull();
    expect(recurringTotalText(s, fmt)).toBe("Price unavailable");
  });

  it("★only unpriced lines (no currency, so no totals) read Price unavailable, not a dash", () => {
    const s = totals({ monthlyTotalComplete: false, products: [line("month", false)] });
    expect(recurringTotalText(s, fmt)).toBe("Price unavailable");
  });

  it("a period with a priced line and an unpriced one keeps its figure, a floor", () => {
    const s = totals({ monthlyTotal: 4999, monthlyTotalComplete: false, products: [line("month", true), line("month", false)] });
    expect(recurringTotalText(s, fmt)).toBe("INR 4999/mo+");
  });

  it("a complete total reads every period, with no +", () => {
    const s = totals({ monthlyTotal: 4999, quarterlyTotal: 74997, products: [line("month", true), line("quarter", true)] });
    expect(recurringTotalText(s, fmt)).toBe("INR 4999/mo + INR 74997/quarter");
  });

  it("a known 0 stays a 0: only an unknown amount is hidden", () => {
    const s = totals({ monthlyTotal: 0, products: [line("month", true)] });
    expect(recurringTotalText(s, fmt)).toBe("INR 0/mo");
  });

  it("an ending unpriced line is not billed, so it hides nothing", () => {
    const s = totals({ monthlyTotal: 0, monthlyTotalComplete: true, products: [line("month", true), line("month", false, "2026-11-01T00:00:00.000Z")] });
    expect(recurringTotalText(s, fmt)).toBe("INR 0/mo");
  });

  it("nothing to total is a dash: no lines, several currencies, or no summary", () => {
    expect(recurringTotalText(totals({}), fmt)).toBe("—");
    expect(recurringTotalText(totals({ products: [line("month", true), line("month", true)] }), fmt)).toBe("—");
    expect(recurringTotalText(undefined, fmt)).toBe("—");
  });
});

describe("lineCostText: one line's price (P4.3b)", () => {
  const fmt = (n: number) => `INR ${n}`;

  it("★an unpriced line reads Price unavailable, never 0 and never nothing", () => {
    expect(lineCostText({ amount: null, amountKnown: false, interval: "quarter" }, fmt)).toBe("Price unavailable");
    expect(lineCostText({ amount: 0, amountKnown: false, interval: "month" }, fmt)).toBe("Price unavailable");
    expect(lineCostText({ amount: null, amountKnown: true, interval: "month" }, fmt)).toBe("Price unavailable");
  });

  it("a priced line reads its amount on its own interval", () => {
    expect(lineCostText({ amount: 74997, amountKnown: true, interval: "quarter" }, fmt)).toBe("INR 74997/quarter");
    expect(lineCostText({ amount: 4999, amountKnown: true, interval: "month" }, fmt)).toBe("INR 4999/mo");
  });

  it("a line the summary does not list (not loaded yet) says nothing about its price", () => {
    expect(lineCostText(undefined, fmt)).toBeNull();
  });
});
