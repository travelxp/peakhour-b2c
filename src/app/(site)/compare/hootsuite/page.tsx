import { pageMeta } from "@/lib/seo/metadata";
import { renderCompare } from "../_compare-view";

export const metadata = pageMeta("compare.hootsuite");

export default async function Page() {
  return renderCompare("hootsuite");
}
