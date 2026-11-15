import type { MetadataRoute } from "next";
import { SITE } from "@/lib/utils";
import { getMarketingSitemapEntries } from "@/lib/marketing-pages";
import { MARKETING_PATHS, isGateOn, pathsThroughTheGate } from "@/lib/seo/gate";
import { isIndexableDeployment } from "@/lib/seo/indexable";
import { PAGES } from "@/lib/seo/pages";
import { isPublishable } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/seo/types";

// Read per request: whether this deployment is indexable, and whether the
// coming-soon gate is on, are environment facts, not build facts.
export const dynamic = "force-dynamic";

/**
 * Marketing sitemap. Lists the PUBLISHABLE pages of the registry (lib/seo/pages.ts + publish.ts),
 * within the coming-soon gate's rules (lib/seo/gate.ts MARKETING_PATHS), each with lastmod = its
 * lastReviewedAt, AND the CMS-authored
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

  // The registry decides WHICH pages are listed (publishable only). MARKETING_PATHS carries the
  // priority and frequency, and, with the gate on, which pages the gate lets through. A page it
  // lists without `sitemap` meta is public but deliberately not in the sitemap. A registry page
  // MARKETING_PATHS does not know (a page added after SEO-2) gets a default, but only with the gate
  // off: with it on, an unknown page answers 404 or the teaser, and is not listed.
  const known = new Map(MARKETING_PATHS.map((m) => [m.path, m.sitemap]));
  const throughGate = new Set(pathsThroughTheGate().map((m) => m.path));
  const DEFAULT_META = { priority: 0.5, changeFrequency: "monthly" } as const;
  const codeEntries: MetadataRoute.Sitemap = PAGES.flatMap((page) => {
    if (!isPublishable(page)) return [];
    if (gated && !throughGate.has(page.path)) return [];
    const meta = known.has(page.path) ? known.get(page.path) : gated ? undefined : DEFAULT_META;
    if (!meta) return [];
    const entry = (locale: Locale): MetadataRoute.Sitemap[number] => {
      const path = pathFor(page.pageId, locale);
      return {
        url: path === "/" ? `${base}/` : `${base}${path}`,
        lastModified: new Date(page.lastReviewedAt),
        changeFrequency: meta.changeFrequency,
        priority: meta.priority,
      };
    };
    const english = entry(DEFAULT_LOCALE);
    // Published non-English variants are listed with their alternates (hreflang, self and x-default): the same
    // cluster pageMeta emits on the page, so the sitemap and the page agree. None is published today, so this
    // adds nothing. With the gate on none is listed: a locale path is never one the gate lets through.
    const variants = gated ? [] : LOCALES.filter((l) => l !== DEFAULT_LOCALE && isPublishable(page, l));
    if (variants.length === 0) return [english];
    const cluster: Record<string, string> = {};
    for (const l of [DEFAULT_LOCALE, ...variants]) cluster[l] = entry(l).url;
    cluster["x-default"] = english.url;
    return [DEFAULT_LOCALE, ...variants].map((l) => ({ ...entry(l), alternates: { languages: cluster } }));
  });
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
