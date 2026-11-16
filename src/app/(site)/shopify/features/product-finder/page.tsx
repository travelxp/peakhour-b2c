import { ShopifyFeaturePage } from "@/components/marketing/seo/templates";
import { CONTENT } from "@/content/pages/shopify.features.product.finder";
import { pageMeta } from "@/lib/seo/metadata";
import { FeatureShell, featureRecord } from "../_shell";

export const metadata = pageMeta("shopify.features.product.finder");

export default function Page() {
  const page = featureRecord("shopify.features.product.finder");
  return (
    <FeatureShell>
      <ShopifyFeaturePage page={page} content={CONTENT} />
    </FeatureShell>
  );
}
