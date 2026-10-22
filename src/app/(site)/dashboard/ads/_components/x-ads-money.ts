import type { XCampaign, XFundingInstrument } from "@/lib/api/x-ads";

/**
 * Pure helpers for the X Ads panel's money display. Kept out of the panel so
 * they can be unit-tested without a DOM. Formatting itself is the shared
 * `formatMoneyOrNumber` in `@/lib/outcome-value`.
 *
 * X's ad-account object carries no currency (its keys, checked live
 * 2026-10-22: approval_status, business_id, business_name, country_code,
 * created_at, deleted, id, industry_type, name, timezone, timezone_switch_at,
 * updated_at). Currency lives on the account's funding instruments, so that is
 * the only place an account's display currency can come from.
 */

/** One spelling for every currency code we read: trimmed, upper-case, empty → null. */
export function normalizeCurrency(code: string | null | undefined): string | null {
  const c = code?.trim().toUpperCase();
  return c ? c : null;
}

/**
 * The account's display currency: the one code its funding instruments agree
 * on. Only ACTIVE instruments count — a cancelled USD card beside a live INR
 * card is an INR account. With no ACTIVE instrument, every instrument counts:
 * an account whose only card was cancelled still billed its history in that
 * card's currency. No codes, or a mix of codes → null (unknown); spend across
 * currencies has no single symbol, and guessing one is a false claim.
 */
export function deriveAccountCurrency(
  instruments: readonly Pick<XFundingInstrument, "currency" | "status">[] | undefined
): string | null {
  const all = instruments ?? [];
  const active = all.filter((f) => f.status?.trim().toUpperCase() === "ACTIVE");
  const pool = active.length > 0 ? active : all;
  const codes = new Set(
    pool.map((f) => normalizeCurrency(f.currency)).filter((c): c is string => c !== null)
  );
  return codes.size === 1 ? [...codes][0] : null;
}

/**
 * The currency a campaign is billed in: its own funding instrument's, falling
 * back to the account's only when that instrument is not in the list.
 */
export function campaignCurrency(
  campaign: Pick<XCampaign, "fundingInstrumentId">,
  instruments: readonly Pick<XFundingInstrument, "id" | "currency">[] | undefined,
  accountCurrency: string | null
): string | null {
  const own = instruments?.find((f) => f.id === campaign.fundingInstrumentId);
  return own ? normalizeCurrency(own.currency) : accountCurrency;
}

/**
 * The single currency a set of per-campaign amounts may be summed in, or
 * "mixed" when they are billed in more than one — adding INR to USD gives a
 * number that is neither. No campaigns → the account's currency. An unknown
 * (null) currency among known ones counts as different: we cannot say it
 * matches.
 */
export function totalsCurrency(
  currencies: readonly (string | null)[],
  accountCurrency: string | null
): { kind: "single"; currency: string | null } | { kind: "mixed" } {
  if (currencies.length === 0) return { kind: "single", currency: accountCurrency };
  const distinct = new Set(currencies);
  if (distinct.size > 1) return { kind: "mixed" };
  return { kind: "single", currency: currencies[0] };
}

/**
 * What the create dialog says under the funding select.
 * - "error": the load failed and there is nothing to choose from (a failed
 *   background refetch keeps the earlier list, which is still usable).
 * - "offline": react-query v5 PAUSES a query while offline, and a paused
 *   query is isLoading false — without this the select is silently empty.
 * - "empty": only when the query SUCCEEDED with no rows; a paused or loading
 *   query is not a claim the account has none.
 */
export function fundingNotice(query: {
  isSuccess: boolean;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  data: readonly unknown[] | undefined;
}): "empty" | "error" | "offline" | null {
  const hasRows = (query.data?.length ?? 0) > 0;
  if (query.isError) return hasRows ? null : "error";
  if (query.fetchStatus === "paused" && query.data === undefined) return "offline";
  if (query.isSuccess && !hasRows) return "empty";
  return null;
}
