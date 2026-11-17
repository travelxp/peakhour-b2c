import { HubRoute } from "@/components/marketing/seo/hub-route";
import { COMMERCE } from "@/content/pages/commerce";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("commerce");

export default function CommercePage() {
  return <HubRoute pageId="commerce" content={COMMERCE} />;
}
