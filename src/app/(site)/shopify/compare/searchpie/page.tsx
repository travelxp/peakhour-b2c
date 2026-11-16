import { pageMeta } from "@/lib/seo/metadata";
import { renderCompare } from "../_compare-view";

export const metadata = pageMeta("shopify.compare.searchpie");

export default async function Page() {
  return renderCompare("searchpie");
}
