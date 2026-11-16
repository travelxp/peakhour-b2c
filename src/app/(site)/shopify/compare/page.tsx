import { connection } from "next/server";
import { DirectoryPage } from "@/components/marketing/seo/templates";
import { RouteShell, renderablePage } from "@/components/marketing/seo/route-shell";
import { directoryContent } from "@/content/seo/competitors/hub";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("shopify.compare");

/**
 * /shopify/compare: every Shopify comparison, grouped by the job the other product is chosen for. 404 on production until a
 * comparison is published; on dev it lists the drafts too, each marked. The request-time read keeps that decision out of the build.
 */
export default async function Page() {
  await connection();
  const page = renderablePage("shopify.compare");
  return (
    <RouteShell>
      <DirectoryPage page={page} content={directoryContent("shopify")} />
    </RouteShell>
  );
}
