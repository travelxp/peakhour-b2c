import { pageMeta } from "@/lib/seo/metadata";
import { renderCompare } from "../_compare-view";

export const metadata = pageMeta("compare.birdeye");

export default async function Page() {
  return renderCompare("birdeye");
}
