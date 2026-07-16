import type { Metadata } from "next";
import { CommerceCatalog } from "@/components/commerce/catalog";

export const metadata: Metadata = {
  title: "Catalog · Commerce",
};

/**
 * Commerce → Catalog & Listings. Canonical products with per-listing quality
 * health, a health-band filter, and a per-product drawer. Gated on
 * `commerce.nav` inside the component.
 */
export default function CommerceCatalogPage() {
  return <CommerceCatalog />;
}
