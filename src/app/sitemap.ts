import type { MetadataRoute } from "next";
import { SITE } from "@/lib/utils";
import { getMarketingSitemapEntries } from "@/lib/marketing-pages";
import { MARKETING_PATHS, isGateOn, pathsThroughTheGate } from "@/lib/seo/gate";
import { isIndexableDeployment } from "@/lib/seo/indexable";

// Read per request: whether this deployment is indexable, and whether the
// coming-soon gate is on, are environment facts, not build facts.
export const dynamic = "force-dynamic";

/**
 * Marketing sitemap. Lists the public, indexable code routes (lib/seo/gate.ts
 * MARKETING_PATHS, the same list the coming-soon gate reads) AND the CMS-authored
 * pages from the Pages Manager (mkt_pages), never the gated app
 * (dashboard/onboarding/auth/cms), which stays out of the index. The API already
 * excludes noindex + draft pages. Absolute URLs from SITE.url.
 *
 * Two honest cases:
 *  - A deployment that is not Production returns an EMPTY list: there is nothing
 *    on dev to submit, and robots.txt there says Disallow: /.
 *  - While COMING_SOON=true it lists only what the gate lets through (plus the
 *    teaser's own "/"). The other pages answer with the teaser, which is not those
 *    pages, so listing them would put 7 teaser URLs in the sitemap. CMS pages are
 *    gated like everything else, so they are left out too.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexableDeployment()) return [];

  const base = SITE.url.replace(/\/$/, "");
  const gated = isGateOn();

  const codeEntries: MetadataRoute.Sitemap = (gated ? pathsThroughTheGate() : MARKETING_PATHS)
    .filter((m) => m.sitemap)
    .map(({ path, sitemap: meta }) => ({
      url: path === "/" ? `${base}/` : `${base}${path}`,
      changeFrequency: meta!.changeFrequency,
      priority: meta!.priority,
    }));
  if (gated) return codeEntries;

  // CMS-authored pages (Pages Manager) — this is the PLATFORM site's sitemap
  // (SITE.url), so no visitor-host forwarding: the API's platform default resolves
  // the platform business's pages, matching the code-route entries above. A proper
  // PER-TENANT sitemap (host-resolved base URL + suppressed platform code-routes) is
  // a follow-up for when b2c actually serves customer custom domains. Degrades to []
  // if the API is down.
  const cmsEntries: MetadataRoute.Sitemap = (await getMarketingSitemapEntries()).map(
    (entry) => ({
      url: `${base}/${entry.slug}`,
      lastModified: entry.updatedAt ? new Date(entry.updatedAt) : undefined,
      changeFrequency: "weekly",
      priority: 0.6,
    }),
  );

  return [...codeEntries, ...cmsEntries];
}
