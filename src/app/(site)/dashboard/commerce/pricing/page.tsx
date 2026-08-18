import type { Metadata } from "next";
import { CommercePricing } from "@/components/commerce/pricing";

export const metadata: Metadata = {
  title: "Pricing & Promotions · Commerce",
};

/**
 * Commerce → Pricing & Promotions (P2.5). The Pricer's guardrail-bounded
 * markdown plan (price grid) plus pricer-owned promotion recommendations as
 * intent cards — projected revenue and approve/reject, with the discount ceiling
 * and margin floor always visible. Platform-agnostic (Shopify + WooCommerce).
 */
export default function CommercePricingPage() {
  return <CommercePricing />;
}
