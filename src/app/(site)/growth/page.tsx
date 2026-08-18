import { pageMetadata } from "@/lib/seo";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMetadata({
  title: "Growth — ads & LinkedIn on autopilot | Peakhour.ai",
  description:
    "Campaigns drafted, leads captured, budgets optimized around the clock. The Growth pillar runs acquisition for you. Free plan included — no credit card.",
  path: "/growth",
});

export default function GrowthPillar() {
  return <PillarPage slug="growth" />;
}
