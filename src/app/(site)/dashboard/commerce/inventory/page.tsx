import type { Metadata } from "next";
import { InventoryPanel } from "@/components/commerce/inventory-panel";
import { ReplenisherPanel } from "@/components/commerce/replenisher-panel";

export const metadata: Metadata = {
  title: "Inventory & Supply · Commerce",
};

/**
 * Commerce → Inventory & Supply (WS3 + P2.3). Two halves over the connected
 * store's catalog + recent sell-through, platform-agnostic (Shopify + Woo):
 *   • Inventory health — Healthy / Watchlist / Slow / At-risk breakdown with a
 *     Peaks-metered AI "recommended actions" diagnosis.
 *   • Restock plan — the Replenisher's per-location SKU × location restock plan
 *     (days of cover, suggested quantity, revenue-at-risk) with inline restock
 *     intents and a Peaks-metered AI restock brief.
 */
export default function CommerceInventoryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Inventory &amp; Supply</h1>
        <p className="mt-1 text-sm text-neutral-500">
          See which products are at risk of stocking out, which are tying up
          capital, and exactly what to reorder — graded from your live stock and
          the last 30 days of sales.
        </p>
      </header>
      <div className="space-y-10">
        <InventoryPanel />
        <ReplenisherPanel />
      </div>
    </div>
  );
}
