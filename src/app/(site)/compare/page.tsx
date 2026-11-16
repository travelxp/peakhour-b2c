import { connection } from "next/server";
import { DirectoryPage } from "@/components/marketing/seo/templates";
import { RouteShell, renderablePage } from "@/components/marketing/seo/route-shell";
import { directoryContent } from "@/content/seo/competitors/hub";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("compare");

/** /compare: the comparisons that are not about Shopify, grouped by job. Draft-aware the same way as /shopify/compare. */
export default async function Page() {
  await connection();
  const page = renderablePage("compare");
  return (
    <RouteShell>
      <DirectoryPage page={page} content={directoryContent("global")} />
    </RouteShell>
  );
}
