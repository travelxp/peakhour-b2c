import { DirectoryPage } from "@/components/marketing/seo/templates";
import { CONTENT } from "@/content/pages/shopify.features";
import { pageMeta } from "@/lib/seo/metadata";
import { FeatureShell, featureRecord } from "./_shell";

export const metadata = pageMeta("shopify.features");

export default function Page() {
  const page = featureRecord("shopify.features");
  return (
    <FeatureShell>
      <DirectoryPage page={page} content={CONTENT} />
    </FeatureShell>
  );
}
