import { HubRoute } from "@/components/marketing/seo/hub-route";
import { PRESENCE } from "@/content/pages/presence";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("presence");

export default function PresencePage() {
  return <HubRoute pageId="presence" content={PRESENCE} />;
}
