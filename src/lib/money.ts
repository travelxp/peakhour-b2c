/**
 * Minor-unit money helpers. Amounts from the Commerce API are integer minor
 * units of a store currency; the exponent varies (2 for USD/INR, 0 for JPY, 3
 * for KWD), so never assume ÷100.
 */

/** A currency's minor-unit exponent, derived from Intl (2 if unknown/invalid). */
export function minorUnitExponent(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** Convert integer minor units to a major-unit number for `currency`. */
export function minorToMajor(minor: number, currency: string): number {
  return minor / 10 ** minorUnitExponent(currency);
}
