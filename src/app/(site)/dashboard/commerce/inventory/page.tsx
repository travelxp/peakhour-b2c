import type { Metadata } from "next";
import { InventoryPanel } from "@/components/commerce/inventory-panel";
import { ReplenisherPanel } from "@/components/commerce/replenisher-panel";
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";

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
    <PageShell width="standard">
      <PageHeader
        title="Inventory & Supply"
        description="See which products are at risk of stocking out, which are tying up capital, and exactly what to reorder — graded from your live stock and the last 30 days of sales."
      />
      {/* `space-y-10` was the only 40px rhythm in the dashboard; tracks the
          shell's pair like everything else now. */}
      <div className="space-y-4 sm:space-y-6">
        <InventoryPanel />
        <ReplenisherPanel />
      </div>
    </PageShell>
  );
}
