/**
 * Minor-unit money helpers. Amounts from the Commerce API are integer minor
 * units of a store currency; the exponent varies (2 for USD/INR, 0 for JPY, 3
 * for KWD), so never assume ÷100.
 *
 * ★THE EXPONENT MUST BE THE ONE THE api MINTED WITH, AND IT IS NOT `Intl`'s.
 * Every minor amount on the Commerce endpoints is written by `toMinor` in
 * peakhour-api `helpers/money.ts`, from a `currencyDecimals` table that follows
 * **ISO 4217**. This file derived it from `Intl.NumberFormat`, which reports a
 * **CLDR display convention** — how a currency is customarily shown, not how
 * many minor units make one major.
 *
 * They disagree for **IQD** (ISO 3, CLDR 0) and for **RSD, LBP, ALL, AFN, IRR,
 * LAK, MMK, SLL, SOS, SYP, YER** (ISO 2, CLDR 0). So a Serbian store's stock
 * value, every catalog and markdown price, the replenisher's protected sales and
 * the recovered-capital figure were each shown a hundred times too large, and an
 * Iraqi store's a thousand. Not a rounding difference — an order of magnitude, in
 * the numbers a merchant makes decisions on.
 *
 * ★A COPY OF THE api's TABLE, AND DELIBERATELY A COPY. A decoder is only correct
 * with respect to the encoder, so this must track `currencyDecimals` in
 * peakhour-api rather than any local notion of tidiness — the browser has no way
 * to import it, and deriving it "cleverly" from the runtime is precisely the
 * mistake being fixed. ISO 4217 minor units change about once a decade.
 */

/** Currencies whose minor unit IS the whole unit (no decimals). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY", "KRW", "VND", "CLP", "ISK", "XAF", "XOF", "XPF", "BIF", "DJF",
  "GNF", "KMF", "MGA", "PYG", "RWF", "UGX", "VUV", "XAG", "XAU",
]);
/** Currencies with three minor digits. */
const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

/** A currency's minor-unit exponent per ISO 4217 (2 if unknown) — mirroring
 *  peakhour-api `helpers/money.ts` `currencyDecimals`, which is what minted the
 *  amounts this decodes. */
export function minorUnitExponent(currency: string): number {
  const c = (currency ?? "").toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(c)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(c)) return 3;
  return 2;
}

/** Convert integer minor units to a major-unit number for `currency`. */
export function minorToMajor(minor: number, currency: string): number {
  return minor / 10 ** minorUnitExponent(currency);
}
