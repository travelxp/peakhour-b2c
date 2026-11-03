import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMetadata({
  title: "Commerce — AI storefront assistant | Peakhour.ai",
  description:
    "An AI assistant that knows your whole catalog and sells on WhatsApp and your storefront, 24/7. Included in Peakhour Suite.",
  path: "/commerce",
});

export default function CommercePillar() {
  return (
    <PillarPage
      slug="commerce"
      aside={
        <p className="mt-3 text-sm text-muted-foreground">
          Using Shopify?{" "}
          <Link href="/shopify" className="font-semibold text-brand-strong hover:underline">
            See Peakhour for Shopify &rarr;
          </Link>
        </p>
      }
    />
  );
}
