import { DirectoryPage } from "@/components/marketing/seo/templates";
import { RouteShell, renderablePage } from "@/components/marketing/seo/route-shell";
import { GUIDES } from "@/content/pages/directories";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("guides");

export default function GuidesPage() {
  const page = renderablePage("guides");
  return (
    <RouteShell>
      <DirectoryPage page={page} content={GUIDES} />
    </RouteShell>
  );
}
