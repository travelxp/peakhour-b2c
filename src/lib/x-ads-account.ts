/**
 * How X words an ad account in the ad-account choice (MR-G3). Mirrors the api's `x_ads` registry row
 * (`adapters/ads/account-listing.ts`): same ids (case-sensitive, compared as they are), same health words.
 *
 * ★NO CURRENCY. An X ad account has none (the funding source's is the billing currency), so the id line is the number alone.
 */

const BLOCKED = new Set(["REJECTED", "SUSPENDED", "DISABLED", "CLOSED", "DELETED"]);

/** `Account ID 18ce54d4x5t`: the full id as X Ads Manager shows it. */
export function xAdAccountIdLine(a: { id: string }): string {
  return `Account ID ${a.id}`;
}

/** `approvalStatus`: ACCEPTED runs ads; pending or under review still runs or can be fixed; rejected or suspended cannot run ads. */
export function xAdAccountHealth(a: { [field: string]: unknown }): { blocked?: string; warning?: string } {
  const status = typeof a.approvalStatus === "string" ? a.approvalStatus.trim().toUpperCase() : "";
  if (BLOCKED.has(status)) return { blocked: status.toLowerCase().replace(/_/g, " ") };
  if (status.includes("REVIEW") || status.includes("PENDING")) return { warning: "under review" };
  return {};
}

