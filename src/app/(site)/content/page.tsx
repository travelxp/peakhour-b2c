import { HubRoute } from "@/components/marketing/seo/hub-route";
import { CONTENT } from "@/content/pages/content";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("content");

export default function ContentPage() {
  return <HubRoute pageId="content" content={CONTENT} />;
}
