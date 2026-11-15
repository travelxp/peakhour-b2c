import { IndustryPage } from "@/components/marketing/seo/templates";
import { RouteShell, renderablePage } from "@/components/marketing/seo/route-shell";
import { FASHION_APPAREL } from "@/content/pages/industry-fashion-apparel";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("industries.fashion.apparel");

export default function FashionApparelPage() {
  const page = renderablePage("industries.fashion.apparel");
  return (
    <RouteShell>
      <IndustryPage page={page} content={FASHION_APPAREL} />
    </RouteShell>
  );
}
