import { FeaturePage } from "@/components/marketing/seo/templates";
import { RouteShell, renderablePage } from "@/components/marketing/seo/route-shell";
import { PEAKHOUR_SUMMIT } from "@/content/pages/feature-peakhour-summit";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("feature.peakhour.summit");

export default function PeakhourSummitPage() {
  const page = renderablePage("feature.peakhour.summit");
  return (
    <RouteShell>
      <FeaturePage page={page} content={PEAKHOUR_SUMMIT} />
    </RouteShell>
  );
}
