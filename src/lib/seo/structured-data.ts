import { LOCKUP_SRC } from "@/components/shared/peakhour-logo";
import { SITE } from "@/lib/utils";
import type { PageRecord } from "./types";

/*
 * JSON-LD builders (SEO-6, Bible 9.2 and 9.3). The rule: structured data states only what the
 * page SHOWS. So every builder takes the same data the page renders (the crumbs the Breadcrumbs
 * component draws, the FAQ items the FaqSection draws, the H1 the hero draws) and nothing else:
 * there is no second copy to drift. No aggregateRating, no review, no price unless the page shows
 * one. Render a block with `<JsonLd>` (components/marketing/seo/json-ld.tsx), which escapes it
 * through `safeJsonLd`.
 */

export type JsonLdNode = Record<string, unknown>;

const CONTEXT = "https://schema.org";

/** The canonical origin, without a trailing slash. */
function origin(): string {
  return SITE.url.replace(/\/$/, "");
}

/** An absolute URL for a site path ("/" gives the origin with its slash). */
export function absolute(path: string): string {
  return path === "/" ? `${origin()}/` : `${origin()}${path}`;
}

/**
 * Social profiles the site already links to. None today: the footer carries no social link, and a
 * profile the site does not show is not asserted here. Add a URL here only in the same change that
 * links it on the page.
 */
export const SOCIAL_PROFILES: readonly string[] = [];

/**
 * The company, on "/". The logo is the official lockup file (SVG; Google Images reads SVG, and asks
 * for 112 x 112 px at least, which a vector exceeds).
 */
export function organizationLd(): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    name: SITE.name,
    url: absolute("/"),
    logo: absolute(LOCKUP_SRC),
    ...(SOCIAL_PROFILES.length > 0 ? { sameAs: [...SOCIAL_PROFILES] } : {}),
  };
}

/** The site, on "/". No SearchAction: the site has no search to point at. */
export function webSiteLd(): JsonLdNode {
  return { "@context": CONTEXT, "@type": "WebSite", name: SITE.name, url: absolute("/") };
}

/** The trail the Breadcrumbs component renders, the same array, as a BreadcrumbList. */
export function breadcrumbListLd(crumbs: readonly { label: string; href: string }[]): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      // A site path becomes absolute; a full URL stays as it is.
      item: c.href.startsWith("/") ? absolute(c.href) : c.href,
    })),
  };
}

/** A FAQPage from the items the FAQ section shows; every answer is visible HTML on the page. */
export function faqPageLd(faqs: readonly { q: string; a: string }[]): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** The Shopify app. No rating, review or price: the page shows none of them as the app's own. */
export function softwareApplicationLd(app: { name: string; url: string; description: string; installUrl?: string }): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "SoftwareApplication",
    name: app.name,
    url: app.url,
    description: app.description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    ...(app.installUrl ? { installUrl: app.installUrl } : {}),
  };
}

/**
 * A guide. `author` and `dateModified` are the values the page shows ("Written by", "Updated");
 * an empty one is left out rather than invented. There is no datePublished: the template shows
 * only an update date.
 */
export function articleLd(a: { headline: string; path: string; author?: string; dateModified?: string }): JsonLdNode {
  const author = a.author?.trim();
  return {
    "@context": CONTEXT,
    "@type": "Article",
    headline: a.headline,
    mainEntityOfPage: absolute(a.path),
    ...(author ? { author: { "@type": author === SITE.name ? "Organization" : "Person", name: author } } : {}),
    // Only an ISO date: Google rejects any other format, and the page's own <time dateTime> needs one too.
    ...(a.dateModified && /^\d{4}-\d{2}-\d{2}/.test(a.dateModified) ? { dateModified: a.dateModified } : {}),
    publisher: { "@type": "Organization", name: SITE.name, url: absolute("/") },
  };
}

/** A page's own absolute URL. */
export function pageUrl(page: Pick<PageRecord, "path">): string {
  return absolute(page.path);
}
