import { ShopifyFeaturePage } from "@/components/marketing/seo/templates";
import { CONTENT } from "@/content/pages/shopify.features.whatsapp.cod.confirmation";
import { pageMeta } from "@/lib/seo/metadata";
import { FeatureShell, featureRecord } from "../_shell";

export const metadata = pageMeta("shopify.features.whatsapp.cod.confirmation");

export default function Page() {
  const page = featureRecord("shopify.features.whatsapp.cod.confirmation");
  return (
    <FeatureShell>
      <ShopifyFeaturePage page={page} content={CONTENT} />
    </FeatureShell>
  );
}
