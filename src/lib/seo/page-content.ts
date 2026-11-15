import { isIndexableDeployment } from "./indexable";
import { DEFAULT_LOCALE, type Locale } from "./types";

/*
 * Per-locale page copy (SEO-4). The pattern the registry pages (SEO-7 to SEO-11) follow.
 *
 * A page's copy lives in a typed object with one entry per locale: English always, the others once they are
 * written and reviewed. The objects are registered in src/content/pages/index.ts under the pageId.
 *
 *   export const content: ByLocale<PageContent> = {
 *     en: { title: "...", description: "...", h1: "...", lead: "..." },
 *     "fr-CA": { ... },     // added with the translation, reviewed by a native reader
 *   };
 *
 * English is the fallback ONLY for a development preview: `previewFallback` is honoured off Production, so a
 * reviewer on dev can open a page whose translation is not written yet. The localized route never asks for
 * it, and a non-English URL never shows English copy (Bible 10, T19): a page with no copy in its locale
 * 404s. Whether a locale's variant may be seen at all is decided before this, by lib/seo/publish.ts.
 */

/** The copy a localized page renders. SEO-7 onward extend it as the templates need; English is the reference. */
export type PageContent = {
  /** <= 60 characters */
  title: string;
  /** <= 160 characters */
  description: string;
  h1: string;
  /** The direct answer, first paragraph. */
  lead: string;
  sections?: { heading: string; body: string }[];
};

export type ByLocale<T> = { en: T } & Partial<Record<Exclude<Locale, "en">, T>>;

/**
 * The copy for `locale`, or undefined. Falls back to English only when `previewFallback` is true AND the
 * deployment is not Production; on Production the fallback never fires, whatever the caller asks.
 */
export function contentFor<T>(
  byLocale: ByLocale<T> | undefined,
  locale: Locale,
  opts: { previewFallback?: boolean; env?: Record<string, string | undefined> } = {},
): T | undefined {
  if (!byLocale) return undefined;
  if (locale === DEFAULT_LOCALE) return byLocale.en;
  const own = byLocale[locale as Exclude<Locale, "en">];
  if (own) return own;
  if (opts.previewFallback && !isIndexableDeployment(opts.env)) return byLocale.en;
  return undefined;
}
