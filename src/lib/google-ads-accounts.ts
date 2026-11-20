/**
 * GOOGLE ADS ACCOUNTS AS A BUSINESS CHOOSES THEM (MR-G2): how an id is spelled and which listed accounts the business enabled.
 * A leaf (no imports from the api client), read by the ad-account format row, the Ads panel and the Growth signal step.
 *
 * The api's Google ad-accounts list answers every account the login reaches (`adAccounts`) AND the business's own
 * (`enabledIds`, `defaultId`: `helpers/business-ad-accounts.ts`). A write is refused for any other account, so the dashboard
 * offers only the enabled ones, the default first.
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

/** The accounts this business enabled, from the api's list answer, its default first (the others keep the listed order). */
export function enabledGoogleAccounts<T extends ListedGoogleAccount>(data: { adAccounts: T[]; enabledIds?: string[]; defaultId?: string | null } | undefined): T[] {
  if (!data) return [];
  const enabled = new Set((data.enabledIds ?? []).map(googleBareId));
  const mine = data.adAccounts.filter((a) => a.id.length > 0 && enabled.has(googleBareId(a.id)));
  const def = data.defaultId ? googleBareId(data.defaultId) : undefined;
  return [...mine].sort((a, b) => Number(googleBareId(b.id) === def) - Number(googleBareId(a.id) === def));
}

/**
 * The account the Ads panel shows: `?customer=` when it is one of the enabled accounts, else the default, else the first enabled
 * (the list is default-first). An id that is not enabled is never trusted.
 */
export function googleSelectedAccountId(enabled: readonly ListedGoogleAccount[], requested: string | null): string | null {
  const wanted = requested ? googleBareId(requested) : undefined;
  const asked = wanted === undefined ? undefined : enabled.find((a) => googleBareId(a.id) === wanted);
  return (asked ?? enabled[0])?.id ?? null;
}
