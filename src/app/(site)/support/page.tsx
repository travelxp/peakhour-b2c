import { HubRoute } from "@/components/marketing/seo/hub-route";
import { SUPPORT } from "@/content/pages/support";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("support");

export default function SupportPage() {
  return <HubRoute pageId="support" content={SUPPORT} />;
}
