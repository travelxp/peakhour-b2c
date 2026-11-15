import { renderIndex, renderUrlset, sitemapIndexNames } from "@/lib/seo/sitemap";

// Read per request: whether this deployment is indexable, and whether the coming-soon gate is on, are
// environment facts, not build facts.
export const dynamic = "force-dynamic";

const HEADERS = { "Content-Type": "application/xml; charset=utf-8" };

/**
 * /sitemap.xml: the sitemap INDEX, listing the named sitemaps (/sitemaps/core.xml, shopify, features,
 * integrations, cms) that have pages. Off Production it is an empty urlset: nothing there is meant to be found.
 */
export async function GET() {
  const names = await sitemapIndexNames();
  if (names.length === 0) return new Response(renderUrlset([]), { headers: HEADERS });
  return new Response(renderIndex(names), { headers: HEADERS });
}
