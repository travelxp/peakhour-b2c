import { pageMeta } from "@/lib/seo/metadata";
import { CompareView } from "../_compare-view";

export const metadata = pageMeta("shopify.compare.interakt");

export default function Page() {
  return <CompareView slug="interakt" />;
}
