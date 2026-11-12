import { notFound } from "next/navigation";

/**
 * Any /dashboard URL no route matches lands here and hands over to
 * dashboard/not-found.tsx. Next renders a segment's not-found file only for an
 * explicit notFound() call, so without this catch-all an old bookmark (for
 * example a deleted route such as /dashboard/content/x-ads) fell through to
 * the site-wide 404: no sidebar, no suggested destinations, no search.
 * Specific routes always win over a catch-all, so this shadows nothing.
 */
export default function MissingDashboardPage() {
  notFound();
}
