import { describe, it, expect } from "vitest";
import { deriveAccountCurrency, formatCurrency, fundingNotice } from "./x-ads-money";

describe("deriveAccountCurrency", () => {
  it("uses the one code every funding instrument agrees on", () => {
    expect(deriveAccountCurrency([{ currency: "INR" }, { currency: "inr " }])).toBe("INR");
  });

  it("ignores instruments with an empty code", () => {
    expect(deriveAccountCurrency([{ currency: "" }, { currency: "EUR" }])).toBe("EUR");
  });

  it("is unknown with no instruments", () => {
    expect(deriveAccountCurrency([])).toBeNull();
    expect(deriveAccountCurrency(undefined)).toBeNull();
    expect(deriveAccountCurrency([{ currency: "" }])).toBeNull();
  });

  it("is unknown when instruments disagree", () => {
    expect(deriveAccountCurrency([{ currency: "INR" }, { currency: "USD" }])).toBeNull();
  });
});

describe("formatCurrency", () => {
  it("never shows a guessed $ when the currency is unknown", () => {
    for (const unknown of [null, undefined, ""]) {
      const out = formatCurrency(1234.5, unknown);
      expect(out).not.toMatch(/\$|USD/);
      expect(out.replace(/\D/g, "")).toBe("12345");
    }
  });

  it("uses the given code when known", () => {
    expect(formatCurrency(10, "USD")).toMatch(/\$|USD/);
    expect(formatCurrency(10, "INR")).not.toMatch(/\$/);
  });

  it("labels an unrecognised code instead of dropping it", () => {
    expect(formatCurrency(10, "NOTACODE")).toMatch(/^NOTACODE /);
  });
});

describe("fundingNotice", () => {
  it("says empty only after a successful load with no rows", () => {
    expect(fundingNotice({ isSuccess: true, isError: false, data: [] })).toBe("empty");
  });

  it("says nothing for a paused or loading query (no data yet, not success)", () => {
    expect(fundingNotice({ isSuccess: false, isError: false, data: undefined })).toBeNull();
  });

  it("says nothing when instruments exist", () => {
    expect(fundingNotice({ isSuccess: true, isError: false, data: [{}] })).toBeNull();
  });

  it("reports an error instead of an empty list", () => {
    expect(fundingNotice({ isSuccess: false, isError: true, data: undefined })).toBe("error");
  });

  it("keeps a usable list when only a background refetch failed", () => {
    expect(fundingNotice({ isSuccess: false, isError: true, data: [{}] })).toBeNull();
  });
});
