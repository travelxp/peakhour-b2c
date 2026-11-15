import { pageMeta } from "@/lib/seo/metadata";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMeta("growth");

export default function GrowthPillar() {
  return <PillarPage slug="growth" />;
}
