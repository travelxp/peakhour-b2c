import { pageMetadata } from "@/lib/seo";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMetadata({
  title: "Commerce — AI storefront assistant | Peakhour.ai",
  description:
    "An AI assistant that knows your whole catalog and sells on WhatsApp and your storefront, 24/7. Free plan included — no credit card.",
  path: "/commerce",
});

export default function CommercePillar() {
  return <PillarPage slug="commerce" />;
}
