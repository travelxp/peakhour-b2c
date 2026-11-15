import type { Metadata } from "next";
import { SITE } from "@/lib/utils";
import { getPage } from "./pages";
import { pathFor } from "./resolve";
import { isPublishable } from "./publish";
import { DEFAULT_LOCALE, LOCALES, PUBLISHED_LOCALES, type Locale } from "./types";

/** The canonical origin, from NEXT_PUBLIC_SITE_URL alone (one value, one env var). */
export function siteOrigin(): string {
  return SITE.url.replace(/\/$/, "");
}

/** An absolute URL for a registry page in a locale. */
export function absoluteUrl(pageId: string, locale: Locale = DEFAULT_LOCALE): string {
  return `${siteOrigin()}${pathFor(pageId, locale)}`;
}

/**
 * Per-page metadata from the registry: title, description, an absolute self-referencing
 * canonical, OpenGraph and Twitter tags, robots (index only when publishable) and hreflang
 * from published variants only. Replaces `pageMetadata`; titles and descriptions come from the
 * page record, which carries each page's copy exactly as it was.
 */
export function pageMeta(pageId: string, locale: Locale = DEFAULT_LOCALE): Metadata {
  const page = getPage(pageId);
  const url = absoluteUrl(pageId, locale);
  const { title, description } = page;
  const publishable = isPublishable(page, locale);

  const languages: Record<string, string> = {};
  if (publishable) {
    for (const l of LOCALES) {
      if (!PUBLISHED_LOCALES.includes(l)) continue;
      if (l !== DEFAULT_LOCALE && page.locales?.[l as Exclude<Locale, "en">]?.status !== "published") continue;
      languages[l] = absoluteUrl(pageId, l);
    }
    languages["x-default"] = absoluteUrl(pageId, DEFAULT_LOCALE);
  }

  return {
    title,
    description,
    alternates: { canonical: url, ...(publishable ? { languages } : {}) },
    robots: publishable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "website",
      // Next replaces (not deep-merges) openGraph per page, so siteName must be
      // repeated here or og:site_name is dropped on every page using this.
      siteName: SITE.name,
      title,
      description,
      url,
      locale: locale === DEFAULT_LOCALE ? "en" : locale.replace("-", "_"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
