import { ShopifyFeaturePage } from "@/components/marketing/seo/templates";
import { CONTENT } from "@/content/pages/shopify.features.bundles";
import { pageMeta } from "@/lib/seo/metadata";
import { FeatureShell, featureRecord } from "../_shell";

export const metadata = pageMeta("shopify.features.bundles");

export default function Page() {
  const page = featureRecord("shopify.features.bundles");
  return (
    <FeatureShell>
      <ShopifyFeaturePage page={page} content={CONTENT} />
    </FeatureShell>
  );
}
