import { redirect } from "next/navigation";

/**
 * Legacy route. X Ads moved into the shared Ads hub (`/dashboard/ads`), which
 * serves every ad channel behind a `?channel=` selector instead of a page per
 * platform. Kept as a redirect so bookmarks, the old catalog `dashboardPath`,
 * and any deep-link in the wild keep working.
 */
export default function XAdsLegacyRedirect() {
  redirect("/dashboard/ads?channel=x");
}
