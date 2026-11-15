import { pageMeta } from "@/lib/seo/metadata";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMeta("presence");

export default function PresencePillar() {
  return <PillarPage slug="presence" />;
}
