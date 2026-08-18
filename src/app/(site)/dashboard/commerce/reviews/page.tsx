import type { Metadata } from "next";
import { CommerceReviews } from "@/components/commerce/reviews";

export const metadata: Metadata = {
  title: "Reviews · Commerce",
};

/**
 * Commerce → Reviews (P2.8). The Reputation agent's read-out: top issues,
 * sentiment + rating breakdowns, PDP-fix intents for recurring negative themes,
 * and per-review AI-drafted replies. Platform-agnostic (Shopify + WooCommerce).
 */
export default function CommerceReviewsPage() {
  return <CommerceReviews />;
}
