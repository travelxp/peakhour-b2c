import { pageMeta } from "@/lib/seo/metadata";
import { SeoPage } from "@/content/pages/render";

export const metadata = pageMeta("integrations.google.search.console");

export default function Page() {
  return <SeoPage pageId="integrations.google.search.console" />;
}
