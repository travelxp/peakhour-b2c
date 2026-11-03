import { pageMetadata } from "@/lib/seo";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMetadata({
  title: "Growth — ads & LinkedIn, with your approval | Peakhour.ai",
  description:
    "Campaigns drafted, LinkedIn leads captured and budgets reviewed every week, with your approval. Peakhour Growth takes on acquisition work for you. Included in Peakhour Suite.",
  path: "/growth",
});

export default function GrowthPillar() {
  return <PillarPage slug="growth" />;
}
