/**
 * Server-side client for the Pages Manager render API (peakhour-api
 * /v1/marketing/pages — MP-2a). Fetches published marketing pages as
 * content-as-data blocks for the `[...slug]` catch-all renderer.
 *
 * Cached with a revalidate window + tags so a CMS publish can push a fresh
 * render via revalidateTag("mkt-pages") / revalidateTag(`mkt-page:${slug}`)
 * (MP-3). The (site) layout forces dynamic rendering for the CSP nonce, so the
 * *page* is SSR'd per request; this fetch's data cache is the ISR-equivalent.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const REVALIDATE_SECONDS = 300;

// ── Block content model (mirrors mkt_pages.zod.ts / the API projection) ──────
export interface HeroBlock {
  type: "hero";
  eyebrow?: string;
  headline: string;
  accent?: string;
  lede?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
  imageAlt?: string;
}
export interface PainPointsBlock {
  type: "pain_points";
  heading: string;
  intro?: string;
  items: { title: string; body: string }[];
}
export interface PillarOutcomesBlock {
  type: "pillar_outcomes";
  heading: string;
  items: { pillar: string; outcome: string }[];
}
export interface LearnsWithYouBlock {
  type: "learns_with_you";
  heading: string;
  body?: string;
  timeline: { when: string; what: string }[];
  footnote?: string;
}
export interface FeatureGridBlock {
  type: "feature_grid";
  heading: string;
  features: { title: string; description: string }[];
}
export interface CtaBlock {
  type: "cta";
  headline: string;
  accent?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}
export interface CrossLinksBlock {
  type: "cross_links";
  heading: string;
  intro?: string;
  links: { label: string; href: string }[];
}
export interface RichTextBlock {
  type: "rich_text";
  heading?: string;
  html: string;
}
export interface FaqBlock {
  type: "faq";
  heading?: string;
  items: { question: string; answer: string }[];
}
export interface MediaBlock {
  type: "media";
  imageUrl: string;
  alt: string;
  caption?: string;
}

export type PageBlock =
  | HeroBlock
  | PainPointsBlock
  | PillarOutcomesBlock
  | LearnsWithYouBlock
  | FeatureGridBlock
  | CtaBlock
  | CrossLinksBlock
  | RichTextBlock
  | FaqBlock
  | MediaBlock;

export interface MarketingPageSeo {
  title: string;
  description: string;
  ogImageUrl?: string;
  canonicalPath?: string;
  schemaType?: "web_page" | "article" | "faq_page";
  noindex?: boolean;
}

export interface MarketingPage {
  slug: string;
  locale: string;
  kind: string;
  taxonomy: { industry?: string; persona?: string; pillar?: string };
  seo: MarketingPageSeo;
  blocks: PageBlock[];
  translationGroupId?: string;
  publishedAt?: string;
  updatedAt?: string;
}

export interface MarketingSitemapEntry {
  slug: string;
  locale: string;
  updatedAt?: string;
}

/**
 * Fetch a published page by slug (path may be multi-segment) + locale. Returns
 * null when unconfigured, 404 (no published page), or on any error — the
 * caller renders notFound().
 */
export async function getMarketingPage(
  slug: string,
  locale = "en",
): Promise<MarketingPage | null> {
  if (!API_URL) return null;
  // Encode each path segment (keeps "/" separators, but escapes ? # & etc. so a
  // slug segment can't inject into the API query string).
  const encodedSlug = slug.split("/").map(encodeURIComponent).join("/");
  try {
    const res = await fetch(
      `${API_URL}/v1/marketing/pages/${encodedSlug}?locale=${encodeURIComponent(locale)}`,
      {
        next: {
          revalidate: REVALIDATE_SECONDS,
          tags: ["mkt-pages", `mkt-page:${slug}`],
        },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: MarketingPage };
    if (!json.ok || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

/** Published pages for the sitemap; [] on any failure (sitemap degrades). */
export async function getMarketingSitemapEntries(): Promise<MarketingSitemapEntry[]> {
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/v1/marketing/pages`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["mkt-pages"] },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { ok?: boolean; data?: { pages?: MarketingSitemapEntry[] } };
    return json.ok && json.data?.pages ? json.data.pages : [];
  } catch {
    return [];
  }
}
