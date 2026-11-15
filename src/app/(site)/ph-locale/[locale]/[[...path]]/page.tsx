import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { PAGE_CONTENT } from "@/content/pages";
import { LOCALE_HEADER, PATH_HEADER, isLocale } from "@/i18n/config";
import { pageMeta } from "@/lib/seo/metadata";
import { contentFor } from "@/lib/seo/page-content";
import { pageAtPath } from "@/lib/seo/locale-route";
import { isPublishable } from "@/lib/seo/publish";
import type { Locale } from "@/lib/seo/types";

/**
 * The internal route every published non-English marketing page renders through. NOT a public URL: the
 * middleware rewrites "/fr-ca/shopify" here (lib/seo/locale-route.ts), only when that page's variant passed
 * the publish gate, and stamps LOCALE_HEADER and PATH_HEADER on the request. Asked for directly
 * ("/ph-locale/fr-CA/x") there is no header, so it is a 404.
 *
 * The page is looked up by the path the visitor typed (PATH_HEADER), the publish gate is asked again (the
 * route does not trust the rewrite alone), and the copy comes from the page's own locale entry with NO
 * English fallback: a published variant with no copy is a 404, not English under another language's URL.
 */

type Params = { locale: string; path?: string[] };

async function resolve(params: Promise<Params>) {
  const { locale } = await params;
  const h = await headers();
  if (!isLocale(locale) || h.get(LOCALE_HEADER) !== locale) return null;
  const page = pageAtPath(h.get(PATH_HEADER) ?? "", locale);
  if (!page || !isPublishable(page, locale)) return null;
  const content = contentFor(PAGE_CONTENT[page.pageId], locale);
  if (!content) return null;
  return { page, locale: locale as Locale, content };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  return pageMeta(found.page.pageId, found.locale, found.content);
}

export default async function LocalizedPage({ params }: { params: Promise<Params> }) {
  const found = await resolve(params);
  if (!found) notFound();
  const { content } = found;
  return (
    <div className="theme-daylight flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="text-4xl font-black leading-[1.05] tracking-[-0.04em] text-balance sm:text-6xl">{content.h1}</h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">{content.lead}</p>
        {content.sections?.map((s) => (
          <section key={s.heading} className="mt-10">
            <h2 className="text-2xl font-extrabold tracking-tight">{s.heading}</h2>
            <p className="mt-3 text-[15px] text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
