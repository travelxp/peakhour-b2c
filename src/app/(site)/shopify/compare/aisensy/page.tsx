import { pageMeta } from "@/lib/seo/metadata";
import { CompareView } from "../_compare-view";

export const metadata = pageMeta("shopify.compare.aisensy");

export default function Page() {
  return <CompareView slug="aisensy" />;
}
