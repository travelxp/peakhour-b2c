import { permanentRedirect } from "next/navigation";

/**
 * Legacy route. X Ads moved into the shared Ads hub (`/dashboard/ads`), which
 * serves every ad channel behind a `?channel=` selector instead of a page per
 * platform. Kept as a redirect so bookmarks, the old catalog `dashboardPath`,
 * and any deep-link in the wild keep working.
 *
 * `permanentRedirect` (308) because the move is permanent, and `account` is
 * forwarded — a bookmark that named an ad account must not silently land on a
 * different one via the panel's first-account auto-select.
 */
export default async function XAdsLegacyRedirect({
  searchParams,
}: {
  searchParams: Promise<{ account?: string | string[] }>;
}) {
  const { account } = await searchParams;
  const one = Array.isArray(account) ? account[0] : account;
  const suffix = one ? `&account=${encodeURIComponent(one)}` : "";
  permanentRedirect(`/dashboard/ads?channel=x${suffix}`);
}
