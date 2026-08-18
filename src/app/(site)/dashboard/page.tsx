import { redirect } from "next/navigation";

/**
 * `/dashboard` has no page of its own — the app's home is `/dashboard/overview`.
 * Without this, bare `/dashboard` links (the WordPress claim page's "Go to
 * dashboard", the Shopify surface, not-found, plus any server-issued
 * dashboard_url) 404. Redirect to the canonical overview.
 */
export default function DashboardIndex() {
  redirect("/dashboard/overview");
}
