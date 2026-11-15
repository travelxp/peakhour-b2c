import { pageMeta } from "@/lib/seo/metadata";
import { SeoPage } from "@/content/pages/render";

export const metadata = pageMeta("features.ai.blog.writer");

export default function Page() {
  return <SeoPage pageId="features.ai.blog.writer" />;
}
