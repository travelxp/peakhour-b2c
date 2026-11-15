import { pageMeta } from "@/lib/seo/metadata";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMeta("support");

export default function SupportPillar() {
  return <PillarPage slug="support" />;
}
