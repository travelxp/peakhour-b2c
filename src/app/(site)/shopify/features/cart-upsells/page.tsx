import { ShopifyFeaturePage } from "@/components/marketing/seo/templates";
import { CONTENT } from "@/content/pages/shopify.features.cart.upsells";
import { pageMeta } from "@/lib/seo/metadata";
import { FeatureShell, featureRecord } from "../_shell";

export const metadata = pageMeta("shopify.features.cart.upsells");

export default function Page() {
  const page = featureRecord("shopify.features.cart.upsells");
  return (
    <FeatureShell>
      <ShopifyFeaturePage page={page} content={CONTENT} />
    </FeatureShell>
  );
}
