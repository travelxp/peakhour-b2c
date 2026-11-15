import { getMarketingSitemapEntries } from "@/lib/marketing-pages";
import { SITE } from "@/lib/utils";
import { isGateOn, isListedThroughGate } from "./gate";
import { isIndexableDeployment } from "./indexable";
import { PAGES } from "./pages";
import { isPublishable } from "./publish";
import { pathFor } from "./resolve";
import type { PageRecord } from "./types";

/*
 * The sitemap, built from the registry alone (SEO-6). A page is listed when `isPublishable` says so
 * (published, indexable, a published locale, its capabilities satisfied), and, with the coming-soon gate
 * on, only when the gate lets its path through. There is no second list: lastmod is the page's
 * `lastReviewedAt`, and CMS pages (Pages Manager) keep their own group.
 *
 * /sitemap.xml is the INDEX; each named sitemap is /sitemaps/<name>.xml. Next's `generateSitemaps` emits
 * /sitemap/<id>.xml and no index, so these are two route handlers over this module.
 *
 * Two honest cases, as before:
 *  - A deployment that is not Production lists nothing: robots.txt there says Disallow: /.
 *  - With COMING_SOON=true only what the gate lets through is listed ("/" is the teaser itself), and CMS
 *    pages are left out: the gate answers them with the teaser, which is not those pages.
 */

export const SITEMAP_NAMES = ["core", "shopify", "features", "integrations", "cms"] as const;
export type SitemapName = (typeof SITEMAP_NAMES)[number];

export type SitemapEntry = { url: string; lastModified?: string };

type Env = Record<string, string | undefined>;

/** Which named sitemap a registry page belongs to: its family, with the Shopify surface first. */
export function sitemapNameFor(page: Pick<PageRecord, "family" | "scope" | "surface">): Exclude<SitemapName, "cms"> {
  if (page.scope === "shopify" || page.surface === "shopify" || page.family.startsWith("shopify")) return "shopify";
  if (page.family === "feature") return "features";
  if (page.family === "integration") return "integrations";
  return "core";
}

/** An ISO timestamp, or undefined for a value that is not a date: one bad row must not take the whole sitemap down. */
function iso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function base(): string {
  return SITE.url.replace(/\/$/, "");
}

/** The absolute URL of a named sitemap. */
export function sitemapUrl(name: SitemapName): string {
  return `${base()}/sitemaps/${name}.xml`;
}

/** The entries of one named sitemap, in registry order. Empty off Production. */
export async function sitemapEntries(name: SitemapName, env: Env = process.env): Promise<SitemapEntry[]> {
  if (!isIndexableDeployment(env)) return [];
  const gated = isGateOn(env);

  if (name === "cms") {
    if (gated) return [];
    // The PLATFORM site's sitemap (SITE.url): no visitor-host forwarding. A per-tenant sitemap is a follow-up for
    // when b2c serves customer custom domains. Degrades to [] if the API is down.
    return (await getMarketingSitemapEntries()).map((e) => {
      const lastModified = iso(e.updatedAt);
      return { url: `${base()}/${e.slug}`, ...(lastModified ? { lastModified } : {}) };
    });
  }

  return PAGES.flatMap((page) => {
    if (sitemapNameFor(page) !== name) return [];
    if (!isPublishable(page)) return [];
    if (gated && !isListedThroughGate(page.path)) return [];
    const path = pathFor(page.pageId);
    const lastModified = iso(page.lastReviewedAt);
    return [{ url: path === "/" ? `${base()}/` : `${base()}${path}`, ...(lastModified ? { lastModified } : {}) }];
  });
}

/** The names the index lists: the non-empty ones, so a crawler is never sent to an empty file. */
export async function sitemapIndexNames(env: Env = process.env): Promise<SitemapName[]> {
  const sizes = await Promise.all(SITEMAP_NAMES.map(async (name) => (await sitemapEntries(name, env)).length));
  return SITEMAP_NAMES.filter((_, i) => sizes[i] > 0);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderUrlset(entries: readonly SitemapEntry[]): string {
  const rows = entries.map((e) => `<url><loc>${esc(e.url)}</loc>${e.lastModified ? `<lastmod>${e.lastModified}</lastmod>` : ""}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join("")}</urlset>\n`;
}

export function renderIndex(names: readonly SitemapName[]): string {
  const rows = names.map((n) => `<sitemap><loc>${esc(sitemapUrl(n))}</loc></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join("")}</sitemapindex>\n`;
}
