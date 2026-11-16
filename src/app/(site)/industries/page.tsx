import { DirectoryPage } from "@/components/marketing/seo/templates";
import { RouteShell, renderablePage } from "@/components/marketing/seo/route-shell";
import { INDUSTRIES } from "@/content/pages/directories";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("industries");

export default function IndustriesPage() {
  const page = renderablePage("industries");
  return (
    <RouteShell>
      <DirectoryPage page={page} content={INDUSTRIES} />
    </RouteShell>
  );
}
