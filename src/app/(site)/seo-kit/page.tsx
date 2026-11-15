import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import {
  ComparisonPage,
  DirectoryPage,
  FeaturePage,
  GuidePage,
  HubPage,
  IndustryPage,
  IntegrationPage,
  PlatformPage,
  ShopifyFeaturePage,
  SolutionPage,
} from "@/components/marketing/seo/templates";
import { isIndexableDeployment } from "@/lib/seo/indexable";
import { COMMERCE } from "@/content/pages/commerce";
import { getPage } from "@/lib/seo/pages";
import * as fx from "./fixtures";

// A review surface, never a public page: it is out of the index on every deployment that can be indexed (404 there)
// and noindex everywhere else, and it is not in the sitemap.
export const metadata: Metadata = { title: "Template kit", robots: { index: false, follow: false } };

/**
 * /seo-kit renders the Daylight SEO template kit with fixture content, for design review on dev. `?template=` picks
 * one template (each has its own H1, so each is its own page); with none it shows the directory of them. It 404s on
 * the Production deployment.
 */
export default async function SeoKitPage({ searchParams }: { searchParams: Promise<{ template?: string | string[] }> }) {
  if (isIndexableDeployment()) notFound();
  const t = (await searchParams).template;
  const key = Array.isArray(t) ? t[0] : t;

  let body: React.ReactNode;
  switch (key) {
    case "feature":
      body = <FeaturePage page={fx.FEATURE_PAGE} content={fx.FEATURE} />;
      break;
    case "shopify-feature":
      body = <ShopifyFeaturePage page={fx.SHOPIFY_FEATURE_PAGE} content={fx.SHOPIFY_FEATURE} />;
      break;
    case "solution":
      body = <SolutionPage page={fx.SOLUTION_PAGE} content={fx.SOLUTION} />;
      break;
    case "industry":
      body = <IndustryPage page={fx.INDUSTRY_PAGE} content={fx.INDUSTRY} />;
      break;
    case "platform":
      body = <PlatformPage page={fx.PLATFORM_PAGE} content={fx.PLATFORM} />;
      break;
    case "integration":
      body = <IntegrationPage page={fx.INTEGRATION_PAGE} content={fx.INTEGRATION} />;
      break;
    case "comparison":
      body = <ComparisonPage page={fx.COMPARISON_PAGE} content={fx.COMPARISON} />;
      break;
    case "hub":
      // The module hub, rendered with the real /commerce content (its statuses come from the capability records).
      body = <HubPage page={getPage("commerce")} content={COMMERCE} />;
      break;
    case "guide":
      body = <GuidePage page={fx.GUIDE_PAGE} content={fx.GUIDE} />;
      break;
    default:
      body = <DirectoryPage page={fx.DIRECTORY_PAGE} content={fx.DIRECTORY} />;
  }

  return (
    <div className="theme-daylight flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <Header />
      {body}
      <Footer />
    </div>
  );
}
