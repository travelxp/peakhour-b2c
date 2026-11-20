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
