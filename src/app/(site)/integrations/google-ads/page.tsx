import { pageMeta } from "@/lib/seo/metadata";
import { SeoPage } from "@/content/pages/render";

export const metadata = pageMeta("integrations.google.ads");

export default function Page() {
  return <SeoPage pageId="integrations.google.ads" />;
}
