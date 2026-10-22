import type { XFundingInstrument } from "@/lib/api/x-ads";

/**
 * Pure helpers for the X Ads panel's money display. Kept out of the panel so
 * they can be unit-tested without a DOM.
 *
 * X's ad-account object carries no currency (its keys, checked live
 * 2026-10-22: approval_status, business_id, business_name, country_code,
 * created_at, deleted, id, industry_type, name, timezone, timezone_switch_at,
 * updated_at). Currency lives on the account's funding instruments, so that is
 * the only place an account's display currency can come from.
 */

/**
 * The account's display currency: the one code every funding instrument
 * agrees on. No instruments, no non-empty codes, or a mix of codes → null
 * (unknown) — spend across mixed currencies has no single symbol, and guessing
 * one is a false claim.
 */
export function deriveAccountCurrency(
  instruments: readonly Pick<XFundingInstrument, "currency">[] | undefined
): string | null {
  const codes = new Set(
    (instruments ?? [])
      .map((f) => f.currency?.trim().toUpperCase())
      .filter((c): c is string => !!c)
  );
  return codes.size === 1 ? [...codes][0] : null;
}

/**
 * Format an amount in `currency`, or as a bare number when the currency is
 * unknown. Never falls back to USD: a "$" on an INR account is wrong.
 */
export function formatCurrency(amount: number, currency: string | null | undefined): string {
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      // An unrecognised code: show it as a label rather than drop it.
      return `${currency} ${formatNumber(amount)}`;
    }
  }
  return formatNumber(amount);
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);
}

/**
 * What the create dialog says under the funding select. "empty" only when the
 * query SUCCEEDED with no rows — react-query v5 reports a paused (offline)
 * query as isLoading false, and that is not a claim the account has none.
 * "error" only when there is nothing to choose from: a failed background
 * refetch keeps the earlier list, which is still usable.
 */
export function fundingNotice(query: {
  isSuccess: boolean;
  isError: boolean;
  data: readonly unknown[] | undefined;
}): "empty" | "error" | null {
  if (query.isError) return (query.data?.length ?? 0) === 0 ? "error" : null;
  if (query.isSuccess && (query.data?.length ?? 0) === 0) return "empty";
  return null;
}
