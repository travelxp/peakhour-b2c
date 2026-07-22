import type { Metadata } from "next";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata: Metadata = {
  title: "Presence — own how you show up on Google | Peakhour.ai",
  description:
    "Your Google Business Profile — listings, hours, photos, and reviews — managed from one place, always current. Always free — no credit card.",
};

export default function PresencePillar() {
  return <PillarPage slug="presence" />;
}
