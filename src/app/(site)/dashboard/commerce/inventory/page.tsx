import type { Metadata } from "next";
import { InventoryPanel } from "@/components/commerce/inventory-panel";

export const metadata: Metadata = {
  title: "Inventory · Commerce",
};

/**
 * Commerce → Inventory intelligence (WS3). Stock-health breakdown
 * (Healthy / Watchlist / Slow / At-risk) over the connected store's catalog +
 * recent sell-through, with a Peaks-metered AI "recommended actions" diagnosis.
 * Platform-agnostic — the same view serves Shopify and WooCommerce stores.
 */
export default function CommerceInventoryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Inventory intelligence</h1>
        <p className="mt-1 text-sm text-neutral-500">
          See which products are at risk of stocking out, which are tying up
          capital, and what to do about it — graded from your live stock and the
          last 30 days of sales.
        </p>
      </header>
      <InventoryPanel />
    </div>
  );
}
