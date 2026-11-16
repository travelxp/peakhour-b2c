import { pageMeta } from "@/lib/seo/metadata";
import { renderCompare } from "../_compare-view";

export const metadata = pageMeta("shopify.compare.octane.ai");

export default async function Page() {
  return renderCompare("octane-ai");
}
