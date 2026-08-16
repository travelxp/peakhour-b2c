import { describe, it, expect } from "vitest";
import { minorUnitExponent, minorToMajor } from "./money";

/**
 * ★A DECODER IS ONLY CORRECT WITH RESPECT TO ITS ENCODER.
 *
 * Every minor amount these helpers read is minted by `toMinor` in peakhour-api
 * `helpers/money.ts`, from a `currencyDecimals` table that follows ISO 4217.
 * This file used to derive the exponent from `Intl.NumberFormat` — a CLDR
 * DISPLAY convention — and the two disagree for IQD (3 vs 0) and for RSD, LBP,
 * ALL, AFN, IRR, LAK, MMK, SLL, SOS, SYP and YER (2 vs 0).
 *
 * The consequence was not a rounding difference: a Serbian store read its stock
 * value, every catalog and markdown price, its protected sales and its recovered
 * capital a hundred times too large, and an Iraqi store a thousand.
 */
describe("minorUnitExponent — ISO 4217, not CLDR display", () => {
  it("★uses ISO for the eleven currencies where CLDR says zero", () => {
    for (const c of ["RSD", "LBP", "ALL", "AFN", "IRR", "LAK", "MMK", "SLL", "SOS", "SYP", "YER"]) {
      expect(minorUnitExponent(c), `${c} is ISO-2`).toBe(2);
    }
  });

  it("★uses ISO 3 for IQD, where CLDR says zero", () => {
    expect(minorUnitExponent("IQD")).toBe(3);
  });

  it("keeps the ordinary cases right", () => {
    expect(minorUnitExponent("USD")).toBe(2);
    expect(minorUnitExponent("INR")).toBe(2);
    expect(minorUnitExponent("JPY")).toBe(0);
    expect(minorUnitExponent("KRW")).toBe(0);
    expect(minorUnitExponent("KWD")).toBe(3);
    expect(minorUnitExponent("BHD")).toBe(3);
  });

  it("is case-insensitive and defaults unknown codes to 2", () => {
    expect(minorUnitExponent("jpy")).toBe(0);
    expect(minorUnitExponent("ZZZ")).toBe(2);
    expect(minorUnitExponent("")).toBe(2);
  });

  it("★mirrors the api table rather than the runtime — which is the whole fix", () => {
    // Stated as an executable contrast so nobody "simplifies" this back to Intl:
    // where the runtime and ISO disagree, we follow ISO, because ISO is what
    // minted the number.
    const cldr = (c: string) =>
      new Intl.NumberFormat("en", { style: "currency", currency: c }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    // Not asserted as a fixed value — CLDR data ships with the runtime and may
    // move. Asserted as a RELATIONSHIP: wherever they differ, ours is ISO.
    for (const c of ["IQD", "RSD", "LBP"]) {
      if (cldr(c) !== minorUnitExponent(c)) {
        expect(minorUnitExponent(c)).toBeGreaterThan(cldr(c));
      }
    }
  });
});

describe("minorToMajor", () => {
  it("★decodes what the api minted, for every currency class", () => {
    expect(minorToMajor(1999, "USD")).toBe(19.99);
    expect(minorToMajor(1500, "JPY")).toBe(1500);
    expect(minorToMajor(1234, "KWD")).toBe(1.234);
    // The two regressions, at the magnitudes they were wrong by.
    expect(minorToMajor(15000, "IQD")).toBe(15); // was 15000 — 1000×
    expect(minorToMajor(150000, "RSD")).toBe(1500); // was 150000 — 100×
  });
});
