import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { PageBlocks } from "@/components/marketing/page-blocks";
import {
  getMarketingPage,
  type MarketingPage,
  type FaqBlock,
} from "@/lib/marketing-pages";
import { SITE } from "@/lib/utils";

/**
 * Catch-all renderer for CMS-authored marketing pages (Pages Manager, MP-2b).
 *
 * A REQUIRED catch-all (`[...slug]`, one-or-more segments) so it never collides
 * with the homepage (`/`) or the explicit spine routes (`/commerce`, `/pricing`,
 * …) — Next resolves explicit segments before this. Any remaining path is
 * looked up in mkt_pages via the render API; a miss → notFound() (real 404).
 * English-only today (locale fixed to "en").
 */

const LOCALE = "en";

function slugFromParams(slug: string[]): string {
  return slug.join("/");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const path = slugFromParams(slug);
  const page = await getMarketingPage(path, LOCALE);
  if (!page) return {}; // notFound() runs in the component

  const canonicalPath = page.seo.canonicalPath ?? `/${path}`;
  return {
    title: page.seo.title,
    description: page.seo.description,
    alternates: { canonical: canonicalPath },
    robots: page.seo.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title: page.seo.title,
      description: page.seo.description,
      url: canonicalPath,
      locale: LOCALE,
      ...(page.seo.ogImageUrl ? { images: [{ url: page.seo.ogImageUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: page.seo.title,
      description: page.seo.description,
    },
  };
}

/** Build JSON-LD for the page — WebPage/Article, plus FAQPage from faq blocks. */
function jsonLd(page: MarketingPage, url: string): Record<string, unknown>[] {
  const graphs: Record<string, unknown>[] = [];
  const base = {
    "@context": "https://schema.org",
    name: page.seo.title,
    description: page.seo.description,
    url,
  };
  if (page.seo.schemaType === "article") {
    graphs.push({ ...base, "@type": "Article", headline: page.seo.title });
  } else {
    graphs.push({ ...base, "@type": "WebPage" });
  }

  const faqBlocks = page.blocks.filter((b): b is FaqBlock => b.type === "faq");
  const faqItems = faqBlocks.flatMap((b) => b.items);
  if (faqItems.length > 0) {
    graphs.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }
  return graphs;
}

export default async function MarketingCatchAll({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const path = slugFromParams(slug);
  const page = await getMarketingPage(path, LOCALE);
  if (!page) notFound();

  const url = `${SITE.url.replace(/\/$/, "")}/${path}`;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {jsonLd(page, url).map((graph, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
        />
      ))}
      <main>
        <PageBlocks blocks={page.blocks} />
      </main>
      <Footer />
    </div>
  );
}
