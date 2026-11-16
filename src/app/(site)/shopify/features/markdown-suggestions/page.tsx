import { ShopifyFeaturePage } from "@/components/marketing/seo/templates";
import { CONTENT } from "@/content/pages/shopify.features.automatic.markdowns";
import { pageMeta } from "@/lib/seo/metadata";
import { FeatureShell, featureRecord } from "../_shell";

export const metadata = pageMeta("shopify.features.automatic.markdowns");

export default function Page() {
  const page = featureRecord("shopify.features.automatic.markdowns");
  return (
    <FeatureShell>
      <ShopifyFeaturePage page={page} content={CONTENT} />
    </FeatureShell>
  );
}
