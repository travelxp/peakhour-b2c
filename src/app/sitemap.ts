import type { MetadataRoute } from "next";
import { SITE } from "@/lib/utils";
import { PILLAR_ORDER } from "@/lib/pillars";
import { getMarketingSitemapEntries } from "@/lib/marketing-pages";

/**
 * Marketing sitemap. Lists the public, indexable code routes AND the
 * CMS-authored pages from the Pages Manager (mkt_pages) — never the gated app
 * (dashboard/onboarding/auth/cms), which stays out of the index. The API
 * already excludes noindex + draft pages. Absolute URLs from SITE.url.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, "");

  const staticPaths: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
    { path: "/peaks", priority: 0.7, changeFrequency: "monthly" },
    { path: "/how-it-works", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
    { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/cookie-policy", priority: 0.3, changeFrequency: "yearly" },
  ];

  const pillarPaths = PILLAR_ORDER.map((slug) => ({
    path: `/${slug}`,
    priority: 0.8,
    changeFrequency: "weekly" as const,
  }));

  const codeEntries: MetadataRoute.Sitemap = [...staticPaths, ...pillarPaths].map(
    ({ path, priority, changeFrequency }) => ({
      url: `${base}${path}`,
      changeFrequency,
      priority,
    }),
  );

  // CMS-authored pages (Pages Manager) — this is the PLATFORM site's sitemap
  // (peakhour.ai / SITE.url), so no visitor-host forwarding: the API's platform
  // default resolves the platform business's pages, matching the code-route
  // entries above (all peakhour.ai). A proper PER-TENANT sitemap (host-resolved
  // base URL + suppressed platform code-routes) is a follow-up for when b2c
  // actually serves customer custom domains. Degrades to [] if the API is down.
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
