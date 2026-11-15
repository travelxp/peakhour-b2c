import { pageMeta } from "@/lib/seo/metadata";
import { SeoPage } from "@/content/pages/render";

export const metadata = pageMeta("features.local.listing.health");

export default function Page() {
  return <SeoPage pageId="features.local.listing.health" />;
}
