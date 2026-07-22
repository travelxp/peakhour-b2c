import type { Metadata } from "next";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata: Metadata = {
  title: "Commerce — AI storefront assistant | Peakhour.ai",
  description:
    "An AI assistant that knows your whole catalog and sells on WhatsApp and your storefront, 24/7. Free plan included — no credit card.",
};

export default function CommercePillar() {
  return <PillarPage slug="commerce" />;
}
