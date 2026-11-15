import Link from "next/link";
import { pageMeta } from "@/lib/seo/metadata";
import { PillarPage } from "@/components/marketing/pillar-page";

export const metadata = pageMeta("commerce");

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
