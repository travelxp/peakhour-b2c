import { HubRoute } from "@/components/marketing/seo/hub-route";
import { GROWTH } from "@/content/pages/growth";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("growth");

export default function GrowthPage() {
  return <HubRoute pageId="growth" content={GROWTH} />;
}
