import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import { ComparisonPage } from "@/components/marketing/seo/templates";
import { buildComparisonContent } from "@/content/seo/competitors/build";
import { getBrief } from "@/content/seo/competitors";
import { getPage } from "@/lib/seo/pages";
import { isPreviewable, isPublishable } from "@/lib/seo/publish";

/**
 * The body of a /shopify/compare/<vendor> page, from its competitor brief. notFound() unless the page is publishable
 * (production, once Growth has signed off) or previewable (dev and previews, with the draft ribbon). The decision reads
 * the deployment at request time, so it is never baked into a build.
 */
export async function renderCompare(slug: string) {
  await connection();
  const brief = getBrief(slug);
  if (!brief) notFound();
  const page = getPage(brief.pageId);
  if (!isPublishable(page) && !isPreviewable(page)) notFound();
  return (
    <div className="theme-daylight flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <Header />
      <ComparisonPage page={page} content={buildComparisonContent(brief)} />
      <Footer />
    </div>
  );
}
