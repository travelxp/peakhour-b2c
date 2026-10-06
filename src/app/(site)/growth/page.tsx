import { pageMetadata } from "@/lib/seo";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMetadata({
  title: "Growth — ads & LinkedIn on autopilot | Peakhour.ai",
  description:
    "Campaigns drafted, leads captured, budgets optimized around the clock. Peakhour Growth runs acquisition for you. Included in Peakhour Suite — start with a free trial, no credit card.",
  path: "/growth",
});

export default function GrowthPillar() {
  return <PillarPage slug="growth" />;
}
