import { RouteShell, renderablePage } from "@/components/marketing/seo/route-shell";
import { AboutView } from "@/content/pages/about-view";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("about");

export default function AboutPage() {
  const page = renderablePage("about");
  return (
    <RouteShell>
      <AboutView page={page} />
    </RouteShell>
  );
}
