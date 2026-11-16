import { isPublishable } from "./publish";
import { DEFAULT_LOCALE, LOCALES, type Locale, type PageRecord } from "./types";

/**
 * The hreflang cluster of a page: every locale the page is publishable in (so a published variant, a published
 * locale, a published page), keyed by locale, plus `x-default` (the English URL). `undefined` when there is no
 * real cluster (English alone would be two identical entries). The ONE place the cluster is decided: the page's
 * `<link rel="alternate">` (metadata.ts) and the sitemap's `xhtml:link` (sitemap.ts) both read it, so they cannot
 * disagree (Bible 9.4: canonical and hreflang agree across HTML and sitemap).
 *
 * `urlOf` builds the absolute URL of the page in a locale (both callers have their own origin helper).
 */
export function hreflangCluster(page: PageRecord, urlOf: (locale: Locale) => string): Record<string, string> | undefined {
  const locales = LOCALES.filter((l) => isPublishable(page, l));
  if (locales.length < 2 || !locales.includes(DEFAULT_LOCALE)) return undefined;
  const cluster: Record<string, string> = {};
  for (const l of locales) cluster[l] = urlOf(l);
  cluster["x-default"] = urlOf(DEFAULT_LOCALE);
  return cluster;
}