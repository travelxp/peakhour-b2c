import { pageMetadata } from "@/lib/seo";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMetadata({
  title: "Presence — own how you show up on Google | Peakhour.ai",
  description:
    "Your Google Business Profile — listings, hours, photos, and reviews — managed from one place, always current. Included in Peakhour Suite — start with a free trial, no credit card.",
  path: "/presence",
});

export default function PresencePillar() {
  return <PillarPage slug="presence" />;
}
