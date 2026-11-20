/**
 * GOOGLE ADS ACCOUNTS AS A BUSINESS CHOOSES THEM (MR-G2): how an id is spelled and which listed accounts the business enabled.
 * A leaf (no imports from the api client), read by the ad-account format row, the Ads panel and the Growth signal step.
 *
 * The api's Google ad-accounts list answers every account the login reaches (`adAccounts`) AND the business's own
 * (`enabledIds`, `defaultId`: `helpers/business-ad-accounts.ts`). A write is refused for any other account, so the dashboard
 * offers the enabled ones (default first) and, for the login's other accounts, a pause-only view.
 */

/** A customer id as one comparable string: ten digits, no dashes, no `customers/` (the api's `normaliseCustomerId`). */
export function googleBareId(id: string): string {
  return id.replace(/-/g, "").replace(/^customers\//, "");
}

/** "123-456-7890" for a ten-digit id (the form Google Ads shows); anything else as it is. */
export function googleDashedId(id: string): string {
  const bare = googleBareId(id);
  return /^\d{10}$/.test(bare) ? `${bare.slice(0, 3)}-${bare.slice(3, 6)}-${bare.slice(6)}` : id;
}

/** The line under an account's name: "Account ID 123-456-7890 · INR". */
export function googleIdLine(a: { id: string; currency?: string; currencyCode?: string }): string {
  const currency = a.currency ?? a.currencyCode;
  return `Account ID ${googleDashedId(a.id)}${currency ? ` · ${currency}` : ""}`;
}

interface ListedGoogleAccount {
  id: string;
}

/** The accounts of the login this business did NOT enable (still on the login, in the listed order). */
export function otherGoogleAccounts<T extends ListedGoogleAccount>(
  data: { adAccounts: T[]; enabledIds?: string[] } | undefined,
): T[] {
  if (!data) return [];
  const enabled = new Set((data.enabledIds ?? []).map(googleBareId));
  return data.adAccounts.filter((a) => a.id.length > 0 && !enabled.has(googleBareId(a.id)));
}

/**
 * The account the Ads panel shows: `?customer=` when it is an enabled account OR one of the login's other accounts (the
 * pause-only view, so a running campaign in an unticked account can still be stopped), else the business default (`enabled` is
 * default-first), else (nothing enabled) the first other account. One comparison rule, either spelling.
 */
export function googleSelectedAccountId(
  enabled: readonly ListedGoogleAccount[],
  others: readonly ListedGoogleAccount[],
  requested: string | null,
): string | null {
  const wanted = requested ? googleBareId(requested) : undefined;
  const asked = wanted === undefined ? undefined : [...enabled, ...others].find((a) => googleBareId(a.id) === wanted);
  // With nothing enabled there is no default: the login's first other account opens the pause-only view (it can only reduce spend).
  return (asked ?? enabled[0] ?? others[0])?.id ?? null;
}
