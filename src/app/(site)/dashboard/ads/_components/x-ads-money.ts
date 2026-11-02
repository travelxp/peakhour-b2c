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
  const active = all.filter(isBillableInstrument);
  const pool = active.length > 0 ? active : all;
  const codes = new Set(
    pool.map((f) => normalizeCurrency(f.currency)).filter((c): c is string => c !== null)
  );
  return codes.size === 1 ? [...codes][0] : null;
}

/**
 * The currency a campaign is billed in: its own funding instrument's, falling
 * back to the account's ONLY when that instrument is not in the list. An
 * instrument that IS found but has no readable code stays null (unknown):
 * the card says nothing, and the account's code is a guess about it.
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
 * Look a campaign's currency up in the map built from `campaignCurrency`. A
 * campaign IN the map keeps its value, null included; only one missing from
 * it (an analytics row for a campaign not listed) takes the account's. `??`
 * would wrongly turn a deliberate null into the account's code.
 */
export function currencyForCampaign(
  byCampaign: ReadonlyMap<string, string | null>,
  campaignId: string,
  accountCurrency: string | null
): string | null {
  return byCampaign.has(campaignId) ? byCampaign.get(campaignId)! : accountCurrency;
}

/**
 * The single currency a set of per-campaign spends may be summed in, or
 * "mixed" when they are billed in more than one — adding INR to USD gives a
 * number that is neither. Only campaigns that SPENT decide it: a 0-spend
 * campaign on another currency's card adds nothing to the sum, so it cannot
 * make the sum mixed. Nothing spent → the account's currency. An unknown
 * (null) currency among known ones counts as different: we cannot say it
 * matches.
 */
export function totalsCurrency(
  rows: readonly { currency: string | null; spend: number }[],
  accountCurrency: string | null
): { kind: "single"; currency: string | null } | { kind: "mixed" } {
  const spent = rows.filter((r) => r.spend > 0);
  if (spent.length === 0) return { kind: "single", currency: accountCurrency };
  const distinct = new Set(spent.map((r) => r.currency));
  if (distinct.size > 1) return { kind: "mixed" };
  return { kind: "single", currency: spent[0].currency };
}

/**
 * The dialog's current funding choice, read against the CURRENT list. An id
 * that is not in the list (another account's, or a card X dropped) is no
 * selection at all; one that is listed but no longer ACTIVE is "inactive", so
 * the dialog can say why Create went grey.
 */
export function fundingSelection(
  instruments: readonly Pick<XFundingInstrument, "id" | "status">[] | undefined,
  fundingId: string
): "none" | "billable" | "inactive" {
  const f = fundingId ? instruments?.find((i) => i.id === fundingId) : undefined;
  if (!f) return "none";
  return isBillableInstrument(f) ? "billable" : "inactive";
}

/**
 * Whether a campaign may be billed to this instrument. The api refuses any
 * other status with 400 FUNDING_INSTRUMENT_NOT_ACTIVE (peakhour-api#1557), so
 * the dialog must not offer one — a merchant would fill the whole form first.
 */
export function isBillableInstrument(f: Pick<XFundingInstrument, "status">): boolean {
  return f.status?.trim().toUpperCase() === "ACTIVE";
}

/**
 * The create dialog's funding options. Every instrument is listed so the
 * merchant can see the card they expected, but only an ACTIVE one is
 * selectable; the rest carry "(not active)". Display currency is a separate
 * question (`deriveAccountCurrency` still falls back to inactive cards).
 */
export function fundingOptions(
  instruments: readonly Pick<XFundingInstrument, "id" | "description" | "currency" | "status">[] | undefined
): { id: string; label: string; selectable: boolean }[] {
  return (instruments ?? []).map((f) => {
    const code = normalizeCurrency(f.currency);
    const selectable = isBillableInstrument(f);
    return {
      id: f.id,
      label: `${f.description}${code ? ` (${code})` : ""}${selectable ? "" : " (not active)"}`,
      selectable,
    };
  });
}

/**
 * What the create dialog says under the funding select.
 * - "none-active": instruments are listed but none can be billed. Rows in
 *   hand mean they did load, so this holds even beside a failed refetch.
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
  data: readonly Pick<XFundingInstrument, "status">[] | undefined;
}): "empty" | "none-active" | "error" | "offline" | null {
  if ((query.data?.length ?? 0) > 0) {
    return query.data!.some(isBillableInstrument) ? null : "none-active";
  }
  if (query.isError) return "error";
  if (query.fetchStatus === "paused" && query.data === undefined) return "offline";
  if (query.isSuccess) return "empty";
  return null;
}
