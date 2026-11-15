import { pageMeta } from "@/lib/seo/metadata";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMeta("content");

export default function ContentPillar() {
  return <PillarPage slug="content" />;
}
