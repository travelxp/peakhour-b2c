import { describe, it, expect } from "vitest";
import {
  formatMoney,
  orderCountLine,
  provenanceLine,
  shortDate,
  sourceLabel,
  type ValueAvailable,
  type ValueUnavailable,
} from "./outcome-value";

/**
 * ★★THESE TEST WHAT IS SAID, NOT WHAT IS TRUE. Every judgement — may an amount
 * be shown, which source, how much of the period it covers — is already made in
 * the api. What can still go wrong here is a surface that renders a true figure
 * inside a false sentence, and that is what each case below is about.
 */

const available = (over: Partial<ValueAvailable> = {}): ValueAvailable => ({
  available: true,
  source: "commerce",
  amount: 1284.5,
  currency: "GBP",
  transactions: 17,
  transactionDays: 30,
  coveredSince: "2026-08-08T00:00:00.000Z",
  coveredUntil: "2026-09-07T00:00:00.000Z",
  daysMeasured: 30,
  daysInWindow: 30,
  partial: false,
  ...over,
});

const unavailable = (over: Partial<ValueUnavailable> = {}): ValueUnavailable => ({
  available: false,
  reason: "not_reported",
  message: "No revenue data for this period.",
  ...over,
});

describe("formatMoney", () => {
  it("uses the currency the api sent, not one derived from the locale", () => {
    // ★THE ONE THING A MONEY FIGURE MUST NEVER DO is relabel an Indian
    // merchant's rupees as dollars for a reader in New York. Asserted by the
    // SYMBOL rather than the separators, which are the viewer's to choose.
    expect(formatMoney(1284.5, "INR")).toContain("₹");
    expect(formatMoney(1284.5, "GBP")).toContain("£");
  });

  it("renders a refund-negative amount as negative", () => {
    // Both sources are refund-net. A surface that dropped the sign would report
    // a period of refunds as a period of sales.
    const out = formatMoney(-240.75, "GBP");
    expect(out).toMatch(/-|\(/);
    expect(out).toContain("240.75");
  });

  it("renders a real zero as a zero", () => {
    // ★THE BOOKS' OWN ZERO REACHES THIS FUNCTION, and it is a fact worth
    // printing: complete order records with nothing in them mean nothing was
    // sold. The api already withheld the ambiguous kind.
    expect(formatMoney(0, "GBP")).toContain("0");
  });

  it("survives a currency code Intl refuses, rather than blanking the page", () => {
    // The api validates against ISO-4217, so this is defence — but an uncaught
    // throw would take the whole Outcomes view down over a formatting detail,
    // and the amount is still perfectly reportable beside its code.
    const out = formatMoney(12, "XXXX" as string);
    expect(out).toContain("12");
    expect(out).toContain("XXXX");
  });
});

describe("provenanceLine", () => {
  it("names the source on a complete period, and says nothing about dates", () => {
    expect(provenanceLine(available())).toBe("From your store's own orders");
    expect(provenanceLine(available({ source: "analytics" }))).toBe(
      "Measured by Google Analytics",
    );
  });

  it("★says which days a partial figure covers", () => {
    const line = provenanceLine(
      available({ partial: true, coveredSince: "2026-08-16T00:00:00.000Z" }),
    );
    // ★★A TOTAL OVER 22 OF 30 DAYS IS A TRUE NUMBER AND A FALSE ANSWER to the
    // question the period heading just asked. The reader has no way to tell
    // unless the span is stated.
    expect(line).toContain("covers");
    expect(line).toContain("not the whole period");
    // Dated the way the code dates it, never by regex over a formatted string —
    // the locale decides the wording and CI's is not the developer's.
    expect(line).toContain(shortDate("2026-08-16T00:00:00.000Z"));
    expect(line).toContain(shortDate("2026-09-07T00:00:00.000Z"));
  });

  it("reads `partial` rather than recomputing it from the day counts", () => {
    // ★TWO SURFACES RECOMPUTING ONE RULE IS HOW THEY COME TO DISAGREE. The api
    // sets `partial` from both coverages; a surface deriving it from
    // daysMeasured alone would drop the purchase-count case silently.
    const line = provenanceLine(available({ partial: true, daysMeasured: 30, daysInWindow: 30 }));
    expect(line).toContain("covers");
  });
});

describe("orderCountLine", () => {
  it("reads as a phrase beside the amount when the figure is available", () => {
    expect(orderCountLine(available())).toBe("from 17 orders");
  });

  it("says `order` for one", () => {
    expect(orderCountLine(available({ transactions: 1 }))).toBe("from 1 order");
  });

  it("★survives a refusal, because a count needs no currency", () => {
    // On a two-currency store this is the only money-adjacent figure there is.
    const line = orderCountLine(unavailable({ reason: "mixed_currency", transactions: 17 }));
    expect(line).toContain("17 orders");
  });

  it("★dates the count on a refusal when it covers less than the period", () => {
    const line = orderCountLine(
      unavailable({ transactions: 17, transactionDays: 12, daysInWindow: 30 }),
    );
    // ★A BARE "17 ORDERS IN THIS PERIOD" claims the whole period for a count
    // that covers twelve days of it — the same false claim the amount above it
    // was withheld to avoid.
    expect(line).toContain("12 of 30 days");
  });

  it("does not date a refusal's count when it covers the whole period", () => {
    const line = orderCountLine(
      unavailable({ transactions: 17, transactionDays: 30, daysInWindow: 30 }),
    );
    expect(line).toBe("17 orders in this period");
  });

  it("★★returns nothing at all when the api sent no count", () => {
    // A count nobody took is not a count of nought. This is the one place a
    // surface can reintroduce the false zero the whole stage exists to refuse.
    expect(orderCountLine(unavailable())).toBeNull();
    expect(orderCountLine(available({ transactions: undefined }))).toBeNull();
  });

  it("prints a real zero count rather than hiding it", () => {
    // Asserted past the negative: `0` is a value the api only sends when it
    // could stand behind it, and treating it as absent would suppress the
    // books' own statement that nothing was sold.
    expect(orderCountLine(available({ transactions: 0 }))).toBe("from 0 orders");
  });
});

describe("sourceLabel", () => {
  it("distinguishes the books from a measurement", () => {
    // ★THE DIFFERENCE A MERCHANT NEEDS the moment this number disagrees with
    // the one in their own store admin.
    expect(sourceLabel("commerce")).not.toBe(sourceLabel("analytics"));
  });
});
