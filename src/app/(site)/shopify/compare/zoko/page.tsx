import { pageMeta } from "@/lib/seo/metadata";
import { renderCompare } from "../_compare-view";

export const metadata = pageMeta("shopify.compare.zoko");

export default async function Page() {
  return renderCompare("zoko");
}
