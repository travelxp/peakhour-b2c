import { describe, it, expect } from "vitest";
import { formatMoneyOrNumber } from "@/lib/outcome-value";
import {
  campaignCurrency,
  deriveAccountCurrency,
  fundingNotice,
  fundingOptions,
  isBillableInstrument,
  normalizeCurrency,
  totalsCurrency,
} from "./x-ads-money";

describe("normalizeCurrency", () => {
  it("trims and upper-cases; empty is unknown", () => {
    expect(normalizeCurrency(" inr ")).toBe("INR");
    expect(normalizeCurrency("")).toBeNull();
    expect(normalizeCurrency("   ")).toBeNull();
    expect(normalizeCurrency(undefined)).toBeNull();
    expect(normalizeCurrency(null)).toBeNull();
  });
});

describe("deriveAccountCurrency", () => {
  const active = (currency: string) => ({ currency, status: "ACTIVE" });
  const cancelled = (currency: string) => ({ currency, status: "CANCELLED" });

  it("uses the one code every active instrument agrees on", () => {
    expect(deriveAccountCurrency([active("INR"), active("inr ")])).toBe("INR");
  });

  it("ignores instruments with an empty code", () => {
    expect(deriveAccountCurrency([active(""), active("EUR")])).toBe("EUR");
  });

  it("a cancelled USD card beside an active INR card is INR", () => {
    expect(deriveAccountCurrency([cancelled("USD"), active("INR")])).toBe("INR");
  });

  it("with no active instrument, falls back to all of them", () => {
    expect(deriveAccountCurrency([cancelled("INR")])).toBe("INR");
    expect(deriveAccountCurrency([cancelled("INR"), cancelled("USD")])).toBeNull();
  });

  it("is unknown with no instruments", () => {
    expect(deriveAccountCurrency([])).toBeNull();
    expect(deriveAccountCurrency(undefined)).toBeNull();
    expect(deriveAccountCurrency([active("")])).toBeNull();
  });

  it("is unknown when active instruments disagree", () => {
    expect(deriveAccountCurrency([active("INR"), active("USD")])).toBeNull();
  });
});

describe("campaignCurrency", () => {
  const instruments = [
    { id: "f1", currency: " inr" },
    { id: "f2", currency: "USD" },
  ];

  it("uses the campaign's own funding instrument, normalised", () => {
    expect(campaignCurrency({ fundingInstrumentId: "f1" }, instruments, "USD")).toBe("INR");
    expect(campaignCurrency({ fundingInstrumentId: "f2" }, instruments, "INR")).toBe("USD");
  });

  it("falls back to the account currency only when the instrument is missing", () => {
    expect(campaignCurrency({ fundingInstrumentId: "gone" }, instruments, "EUR")).toBe("EUR");
    expect(campaignCurrency({ fundingInstrumentId: "f1" }, undefined, null)).toBeNull();
  });
});

describe("totalsCurrency", () => {
  it("one currency → that currency", () => {
    expect(totalsCurrency(["INR", "INR"], null)).toEqual({ kind: "single", currency: "INR" });
  });

  it("two currencies → mixed, never a sum", () => {
    expect(totalsCurrency(["INR", "USD"], "INR")).toEqual({ kind: "mixed" });
  });

  it("an unknown beside a known one is mixed", () => {
    expect(totalsCurrency(["INR", null], "INR")).toEqual({ kind: "mixed" });
  });

  it("no campaigns → the account's currency", () => {
    expect(totalsCurrency([], "EUR")).toEqual({ kind: "single", currency: "EUR" });
  });
});

// formatMoneyOrNumber pins its locale (outcome-value's LOCALE, en-US), so these
// exact strings hold on any host locale, including non-Latin digit systems.
describe("formatMoneyOrNumber", () => {
  it("never shows a guessed $ when the currency is unknown", () => {
    for (const unknown of [null, undefined, ""]) {
      expect(formatMoneyOrNumber(1234.5, unknown)).toBe("1,234.5");
    }
  });

  it("uses the given code when known", () => {
    expect(formatMoneyOrNumber(10, "USD")).toBe("$10.00");
    expect(formatMoneyOrNumber(10, "INR")).toBe("₹10.00");
  });

  it("labels an unrecognised code instead of dropping it", () => {
    expect(formatMoneyOrNumber(10, "NOTACODE")).toBe("NOTACODE 10");
  });
});

describe("fundingNotice", () => {
  const q = (over: Partial<Parameters<typeof fundingNotice>[0]>) => ({
    isSuccess: false,
    isError: false,
    fetchStatus: "idle" as "fetching" | "paused" | "idle",
    data: undefined,
    ...over,
  });

  it("says empty only after a successful load with no rows", () => {
    expect(fundingNotice(q({ isSuccess: true, data: [] }))).toBe("empty");
  });

  it("says offline for a paused query with no data, never empty", () => {
    expect(fundingNotice(q({ fetchStatus: "paused" }))).toBe("offline");
  });

  it("says nothing while loading", () => {
    expect(fundingNotice(q({ fetchStatus: "fetching" }))).toBeNull();
  });

  const ACTIVE = { status: "ACTIVE" };
  const PAUSED = { status: "PAUSED" };

  it("says nothing when an active instrument exists, even if a refetch is paused", () => {
    expect(fundingNotice(q({ isSuccess: true, data: [ACTIVE] }))).toBeNull();
    expect(fundingNotice(q({ isSuccess: true, data: [PAUSED, ACTIVE] }))).toBeNull();
    expect(
      fundingNotice(q({ isSuccess: true, fetchStatus: "paused", data: [ACTIVE] }))
    ).toBeNull();
  });

  it("says none-active when instruments loaded but none is ACTIVE", () => {
    expect(fundingNotice(q({ isSuccess: true, data: [PAUSED] }))).toBe("none-active");
    expect(
      fundingNotice(q({ isSuccess: true, data: [{ status: "EXPIRED" }, { status: "" }] }))
    ).toBe("none-active");
  });

  it("reports an error instead of an empty list", () => {
    expect(fundingNotice(q({ isError: true }))).toBe("error");
  });

  it("keeps a usable list when only a background refetch failed", () => {
    expect(fundingNotice(q({ isError: true, data: [ACTIVE] }))).toBeNull();
    expect(fundingNotice(q({ isError: true, data: [PAUSED] }))).toBe("none-active");
  });
});

describe("isBillableInstrument", () => {
  it("only ACTIVE, normalised, can be billed", () => {
    expect(isBillableInstrument({ status: "ACTIVE" })).toBe(true);
    expect(isBillableInstrument({ status: " active " })).toBe(true);
    for (const status of ["PAUSED", "CANCELLED", "EXPIRED", ""]) {
      expect(isBillableInstrument({ status })).toBe(false);
    }
  });
});

describe("fundingOptions", () => {
  it("lists every instrument but only ACTIVE ones are selectable", () => {
    expect(
      fundingOptions([
        { id: "a", description: "Visa 4242", currency: " inr", status: "ACTIVE" },
        { id: "b", description: "Amex 0005", currency: "USD", status: "PAUSED" },
        { id: "c", description: "Credit line", currency: "", status: "EXPIRED" },
      ])
    ).toEqual([
      { id: "a", label: "Visa 4242 (INR)", selectable: true },
      { id: "b", label: "Amex 0005 (USD) (not active)", selectable: false },
      { id: "c", label: "Credit line (not active)", selectable: false },
    ]);
  });

  it("no instruments → no options", () => {
    expect(fundingOptions(undefined)).toEqual([]);
  });
});
