import { navCopy } from "@/lib/nav-copy";

/**
 * The five places most merchants are looking for when a link is stale.
 * Labels and hints come from nav-copy, so the 404 names each destination
 * exactly as the sidebar does.
 */
const HREFS = [
  "/dashboard/overview",
  "/dashboard/strategist",
  "/dashboard/content",
  "/dashboard/growth",
  "/dashboard/integrations",
] as const;

export const NOT_FOUND_DESTINATIONS = HREFS.map((href) => {
  const copy = navCopy(href);
  if (!copy) throw new Error(`nav-copy has no entry for ${href}`);
  return { href, label: copy.label, hint: copy.description };
});
