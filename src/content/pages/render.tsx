import { notFound } from "next/navigation";
import { RouteShell, renderablePage } from "@/components/marketing/seo/route-shell";
import { DirectoryPage, FeaturePage, IntegrationPage } from "@/components/marketing/seo/templates";
import { featuresDirectory, integrationsDirectory } from "./seo9-directories";
import { FEATURE_CONTENT } from "./features";
import { INTEGRATION_CONTENT } from "./integrations";

/**
 * Renders one registry page from its typed content (SEO-9). A page that is neither publishable nor, on dev, previewable
 * is a real 404, so a page held in review never reaches production. Server component, no client JS.
 */
export function SeoPage({ pageId }: { pageId: string }) {
  const page = renderablePage(pageId);

  let body: React.ReactNode;
  if (pageId === "integrations.index") body = <DirectoryPage page={page} content={integrationsDirectory()} />;
  else if (pageId === "features.index") body = <DirectoryPage page={page} content={featuresDirectory()} />;
  else if (INTEGRATION_CONTENT[pageId]) body = <IntegrationPage page={page} content={INTEGRATION_CONTENT[pageId].content} />;
  else if (FEATURE_CONTENT[pageId]) body = <FeaturePage page={page} content={FEATURE_CONTENT[pageId].content} />;
  else notFound();

  return <RouteShell>{body}</RouteShell>;
}
