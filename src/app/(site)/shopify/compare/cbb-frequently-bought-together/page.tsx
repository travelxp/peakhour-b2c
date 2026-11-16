import { pageMeta } from "@/lib/seo/metadata";
import { renderCompare } from "../_compare-view";

export const metadata = pageMeta("shopify.compare.cbb.frequently.bought.together");

export default async function Page() {
  return renderCompare("cbb-frequently-bought-together");
}
