/**
 * LinkedIn ad accounts as the dashboard words them (MR-G1). The row `AD_ACCOUNT_FORMATS.linkedin_ads` (lib/ad-account-choice.ts)
 * reads these; the api's registry row (`adapters/ads/account-listing.ts`) is the matching one and says the same words.
 */

/** ★THE ONE ID NORMALISER: the bare number, so `123`, ` 123 ` and `urn:li:sponsoredAccount:123` compare equal. */
export function linkedinAdAccountBareId(id: string): string {
  return String(id).trim().replace(/^urn:li:sponsoredAccount:/i, "");
}

/** `Account ID 123456789 · INR`: the full number as Campaign Manager shows it, then the billing currency. */
export function linkedinAdAccountIdLine(a: { id: string; currency?: string }): string {
  return `Account ID ${linkedinAdAccountBareId(a.id)}${a.currency ? ` · ${a.currency}` : ""}`;
}

/**
 * LinkedIn's account `status`: CANCELED and REMOVED cannot run ads (blocked, and cannot be ticked); DRAFT and PENDING_DELETION
 * stay tickable with a warning on the line. ACTIVE, a status LinkedIn adds later, or none, is not flagged.
 */
export function linkedinAdAccountStatus(status: unknown): { blocked?: "cancelled" | "removed"; warning?: string } {
  const s = typeof status === "string" ? status.toUpperCase() : "";
  if (s === "CANCELED") return { blocked: "cancelled" };
  if (s === "REMOVED") return { blocked: "removed" };
  if (s === "DRAFT") return { warning: "draft" };
  if (s === "PENDING_DELETION") return { warning: "being deleted" };
  return {};
}

/** `Name`, else `Account 123`: how an ad account is named where there is room for one word. */
export function linkedinAdAccountLabel(a: { id: string; name?: string | null }): string {
  return a.name ? a.name : `Account ${linkedinAdAccountBareId(a.id)}`;
}

export interface CampaignAccountState {
  /** The campaign's own ad account, bare. Undefined for a row that predates the field. */
  ownAccount?: string;
  /** The enabled account it is in, when it is one. */
  account?: { id: string; name: string | null; currency: string | null };
  /** The business has chosen its accounts and this campaign is in one it does not use: pause only. */
  notUsed: boolean;
  /** The business has chosen its accounts and this campaign names none, so which account it is in cannot be confirmed: no start, no retarget. */
  unconfirmed: boolean;
  /** The account line, once: "Name · Account ID 123 · INR" (name and currency only where known). Undefined without an account. */
  line?: string;
}

/**
 * A campaign's own ad account against the business's enabled ones (MR-G1). The campaign list spans accounts, so a campaign in an
 * account the business does not use stays visible (it can be paused) but is `notUsed`: no Resume, no targeting edit.
 *
 * ★AN EMPTY OR ABSENT `accounts` IS UNKNOWN, NOT "NOT USED": an older api, a connection that did not resolve, or a business that has
 * not chosen yet says nothing about which accounts it uses, so no row is wrongly locked and each keeps its normal controls.
 * A row with no account of its own is `unconfirmed` (only against a known list): the api stores the placed account on the row, so
 * one that still has none is one Peakhour cannot place.
 */
export function campaignAccountState(
  campaign: { adAccountId?: string; platformCampaignId?: string; currency?: string },
  accounts: ReadonlyArray<{ id: string; name: string | null; currency: string | null }> | undefined,
): CampaignAccountState {
  const known = Array.isArray(accounts) && accounts.length > 0;
  const ownAccount = campaign.adAccountId ? linkedinAdAccountBareId(campaign.adAccountId) : undefined;
  const account = ownAccount && known ? accounts!.find((a) => linkedinAdAccountBareId(a.id) === ownAccount) : undefined;
  const currency = account?.currency ?? campaign.currency;
  const line = ownAccount
    ? `${account?.name ? `${account.name} · ` : ""}${linkedinAdAccountIdLine({ id: ownAccount, ...(currency ? { currency } : {}) })}`
    : undefined;
  return {
    ownAccount,
    account,
    notUsed: Boolean(ownAccount && known && !account),
    unconfirmed: Boolean(!ownAccount && known && campaign.platformCampaignId),
    line,
  };
}
