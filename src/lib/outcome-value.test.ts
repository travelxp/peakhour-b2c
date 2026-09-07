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

describe("shortDate", () => {
  it("★formats the UTC calendar day, whatever the viewer's timezone", () => {
    // ★★EVERY DATE THE API SENDS IS A UTC-MIDNIGHT INSTANT, and formatting one
    // in the viewer's zone shifts it a full day WEST of UTC — "16 Aug" becomes
    // "15 Aug" in New York. The span sentence would then be wrong at both ends
    // for every merchant in the Americas, and wrong in the direction that
    // quietly widens the claim.
    //
    // ★ASSERTED ON THE DAY NUMBER, not by comparing against shortDate itself —
    // a spec that formats its own expectation with the function under test
    // cannot see this at all, which is how it shipped once.
    // ★COMPARED AGAINST AN EXPECTATION BUILT WITH timeZone: "UTC" EXPLICITLY,
    // not against shortDate itself — a spec that formats its own expectation
    // with the function under test cannot see this at all, which is how it
    // shipped once. Independent of the month names the runner's ICU produces.
    const utc = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      });
    for (const iso of [
      "2026-08-16T00:00:00.000Z",
      "2026-09-07T00:00:00.000Z",
      // ★THE YEAR ROLLOVER, and it needs the full comparison rather than a
      // digit: the buggy render of 1 Jan is "31 Dec", which contains "1".
      "2026-01-01T00:00:00.000Z",
    ]) {
      expect(shortDate(iso), iso).toBe(utc(iso));
    }
  });
});

describe("the locale every number on the card is grouped by", () => {
  it("★is the page's, and the currency is still the merchant's", () => {
    // ★★ASSERTED ON THE CALL, not on the output. Which separators a locale
    // produces is ICU's business and varies by platform — on Windows it ignores
    // LANG entirely — so an output comparison here scores nothing on the one
    // machine that matters. What must hold is the ARGUMENTS: one locale for
    // every figure on this card (the page hard-codes en-US for the rest, and
    // "1,234 wins" above "from 1.234 orders" reads as a bug whichever is
    // right), and the currency taken from the response.
    const seen: Array<[unknown, unknown]> = [];
    const real = Intl.NumberFormat;
    const spy = function (this: unknown, locale?: unknown, options?: unknown) {
      seen.push([locale, options]);
      return new (real as unknown as new (l?: unknown, o?: unknown) => Intl.NumberFormat)(
        locale as string | undefined,
        options as Intl.NumberFormatOptions | undefined,
      );
    } as unknown as typeof Intl.NumberFormat;
    (Intl as { NumberFormat: typeof Intl.NumberFormat }).NumberFormat = spy;
    try {
      formatMoney(1284.5, "INR");
      orderCountLine(available());
    } finally {
      (Intl as { NumberFormat: typeof Intl.NumberFormat }).NumberFormat = real;
    }
    expect(seen.length).toBeGreaterThanOrEqual(2);
    for (const [locale] of seen) expect(locale).toBe("en-US");
    expect(seen[0][1]).toMatchObject({ style: "currency", currency: "INR" });
  });
});

describe("provenanceLine", () => {
  it("names the source on a complete period, and says nothing about dates", () => {
    expect(provenanceLine(available())).toBe("From your store's own orders");
    expect(provenanceLine(available({ source: "analytics" }))).toBe(
      "Measured by Google Analytics",
    );
  });

  it("★says which days a partial COMMERCE figure covers", () => {
    const line = provenanceLine(
      available({
        partial: true,
        coveredSince: "2026-08-16T00:00:00.000Z",
        daysMeasured: 22,
        daysInWindow: 30,
      }),
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

  it("★describes a partial MEASUREMENT by its day count, not by dates", () => {
    const line = provenanceLine(
      available({
        source: "analytics",
        partial: true,
        daysMeasured: 22,
        daysInWindow: 30,
      }),
    );
    // ★★A MEASUREMENT'S `covered` IS ALWAYS THE FULL WINDOW, by design: GA4's
    // gaps are scattered — it can report on Monday and Wednesday and not
    // Tuesday — so there is no narrowed span to state. Printing "covers 8 Aug
    // to 7 Sep, not the whole period" is a sentence contradicting its own
    // dates, and the real gap never gets said. Its end is exclusive too, so
    // rendering it as the last day covered claims a day the amount holds
    // nothing from.
    expect(line).toContain("22 of 30 days");
    expect(line).not.toContain("covers");
    expect(line).not.toContain("not the whole period");
  });

  it("does not claim a short revenue coverage when only the COUNT is short", () => {
    // ★`partial` IS TRUE IF EITHER FIGURE FALLS SHORT, so a window whose
    // revenue covers every day and whose purchase count does not would print
    // "measured on 30 of 30 days" — a shortfall sentence carrying numbers that
    // say the opposite. The count's own line states that case.
    const line = provenanceLine(
      available({
        source: "analytics",
        partial: true,
        daysMeasured: 30,
        daysInWindow: 30,
        transactionDays: 12,
      }),
    );
    expect(line).toBe("Measured by Google Analytics");
  });

  it("reads `partial` rather than recomputing it from the day counts", () => {
    // ★★THE SAME COUNTS, THE OPPOSITE FLAG, THE OPPOSITE OUTPUT — which is the
    // only shape that proves the flag is read rather than derived. A surface
    // recomputing `partial` from daysMeasured would produce the same sentence
    // for both of these, and would drop the api's purchase-count case silently.
    const short = { daysMeasured: 22, daysInWindow: 30 };
    expect(provenanceLine(available({ ...short, partial: true }))).toContain("covers");
    expect(provenanceLine(available({ ...short, partial: false }))).toBe(
      "From your store's own orders",
    );
  });

  it("adds nothing when a COMMERCE figure is partial only on its count", () => {
    // ⏸UNREACHABLE TODAY — the api sets the two coverages equal on this path —
    // and guarded anyway, because its `partial` is written to allow the count
    // alone to set it and the sentence would then print "covers 8 Aug to 7 Sep,
    // not the whole period" over a span covering every day of it. An earlier
    // spec pinned that contradiction as the expected output.
    const line = provenanceLine(
      available({ partial: true, daysMeasured: 30, daysInWindow: 30, transactionDays: 12 }),
    );
    expect(line).toBe("From your store's own orders");
  });
});

describe("orderCountLine", () => {
  it("reads as a phrase beside the amount when the figure is available", () => {
    expect(orderCountLine(available())).toBe("from 17 orders");
  });

  it("does not qualify a commerce count the span has already qualified", () => {
    // ★THE API SETS THE TWO COVERAGES EQUAL ON THE COMMERCE PATH, so a short
    // count there is the same shortfall the provenance line states as a span.
    // Saying it twice — "covers 16 Aug to 7 Sep, not the whole period" and
    // "(counted on 22 of 30 days)" — reads as two different problems.
    const line = orderCountLine(
      available({ transactions: 17, transactionDays: 22, daysMeasured: 22, daysInWindow: 30 }),
    );
    expect(line).toBe("from 17 orders");
  });

  it("★dates a short count on the AVAILABLE branch when it DIVERGES from the revenue's", () => {
    const line = orderCountLine(
      available({ transactions: 17, transactionDays: 12, daysMeasured: 30, daysInWindow: 30 }),
    );
    // The count's coverage diverges from the revenue's — a property whose
    // currency we could not read records purchases and no revenue — so an
    // available figure can sit beside a count covering twelve of thirty days.
    // A bare "from 17 orders" claims the whole period for it, which is exactly
    // the claim the refusal branch takes a clause to avoid.
    expect(line).toContain("12 of 30 days");
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
