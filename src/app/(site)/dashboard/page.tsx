import { redirect } from "next/navigation";

import { HOME_ROUTE } from "@/lib/nav-home";

/**
 * `/dashboard` has no page of its own. Without this, bare `/dashboard` links
 * (the WordPress claim page's "Go to dashboard", the Shopify surface,
 * not-found, plus any server-issued dashboard_url) 404.
 *
 * ★WHERE IT GOES IS THE FLAG'S DECISION, READ FROM ONE PLACE. The sidebar's
 * logo reads the same constant, because a mark that lands somewhere other than
 * where the app opened is the shape of two copies of one decision.
 */
export default function DashboardIndex() {
  redirect(HOME_ROUTE);
}
