import { pageMeta } from "@/lib/seo/metadata";
import { SeoPage } from "@/content/pages/render";

export const metadata = pageMeta("features.social.media.content");

export default function Page() {
  return <SeoPage pageId="features.social.media.content" />;
}
