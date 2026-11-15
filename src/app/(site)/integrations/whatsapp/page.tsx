import { pageMeta } from "@/lib/seo/metadata";
import { SeoPage } from "@/content/pages/render";

export const metadata = pageMeta("integrations.whatsapp");

export default function Page() {
  return <SeoPage pageId="integrations.whatsapp" />;
}
