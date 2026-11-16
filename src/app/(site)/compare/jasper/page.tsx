import { pageMeta } from "@/lib/seo/metadata";
import { renderCompare } from "../_compare-view";

export const metadata = pageMeta("compare.jasper");

export default async function Page() {
  return renderCompare("jasper");
}
