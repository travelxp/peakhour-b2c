"use client";

import {
  Boxes,
  AlertTriangle,
  MessageSquareText,
  MousePointerClick,
  Receipt,
  ClipboardCheck,
  Store,
} from "lucide-react";
import { KpiCard } from "@/components/molecules/kpi-card";
import { EmptyState } from "@/components/molecules/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { useLocale } from "@/hooks/use-locale";
import { useCommerceSummary } from "@/hooks/use-commerce-summary";

/**
 * Commerce → Command Center (Phase 0). The outcome home for the Commerce pillar:
 * what the store is doing and what the engine has done, grounded in live catalog
 * + inventory + our own assisted-order / storefront data. Order-derived outcomes
 * (GMV / AOV / sell-through) show a "Switching on" state until order access lands
 * — never a fabricated number (Shopify certification firewall).
 *
 * Composition-first: reuses KpiCard, EmptyState, Skeleton, FeatureGate. The
 * "engine did this" digest + NeedsYouRail land in P0.5; the channel switcher
 * arrives with the Channels hub (P0.9) — today there is a single D2C channel.
 */
export function CommandCenter() {
  return (
    <FeatureGate feature="commerce.command_center" featureName="Commerce Command Center">
      <CommandCenterBody />
    </FeatureGate>
  );
}

/** A currency's minor-unit exponent (2 for USD/INR, 0 for JPY, 3 for KWD). */
function minorUnitExponent(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2; // unknown/invalid currency code → assume 2-decimal
  }
}

function CommandCenterBody() {
  const { data, isLoading, isError } = useCommerceSummary();
  const { formatNumber } = useLocale();

  const money = (minor: number, currency: string | null) => {
    const cur = currency ?? "USD";
    const major = minor / 10 ** minorUnitExponent(cur);
    return formatNumber(major, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Command Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What your store is doing and what Peakhour has done for it — grounded in
          your live catalog, inventory and conversations.
        </p>
      </header>

      {isLoading && <SummarySkeleton />}

      {isError && !isLoading && (
        <EmptyState
          icon={Store}
          title="Connect a store to get started"
          description="Command Center lights up once a Shopify or WooCommerce store is connected to this business."
          action={{ label: "Connect a store", href: "/dashboard/integrations" }}
        />
      )}

      {data && !isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Stock value (retail)"
            value={money(data.inventory.stockValueRetailMinor, data.store.currency)}
            description="On-hand inventory at retail price"
            icon={Boxes}
          />
          <KpiCard
            title="Needs attention"
            value={data.inventory.atRisk}
            description={`${data.inventory.atRisk} product${
              data.inventory.atRisk === 1 ? "" : "s"
            } at risk of stocking out or tying up capital`}
            icon={AlertTriangle}
          />
          <KpiCard
            title="Assisted-order revenue"
            value={money(data.assistedOrders.revenueMinor, data.store.currency)}
            description={`${data.assistedOrders.count} order${
              data.assistedOrders.count === 1 ? "" : "s"
            } the assistant helped close`}
            icon={MessageSquareText}
          />
          <KpiCard
            title="Storefront engagement"
            value={formatNumber(data.storefront.impressions)}
            description={`${data.storefront.clicks} clicks · ${data.storefront.addToCart} add-to-cart (30d)`}
            icon={MousePointerClick}
          />
          <KpiCard
            title="Sales from orders"
            value={data.orderDerived.switchingOn ? "Switching on" : "Connected"}
            description={
              data.orderDerived.switchingOn
                ? "Connect order access to see GMV, AOV & sell-through"
                : "Order-based revenue is being wired into your reports"
            }
            icon={Receipt}
          />
          <KpiCard
            title="Pending approvals"
            value={data.pendingApprovals}
            description="Agent actions waiting for your go-ahead"
            icon={ClipboardCheck}
          />
        </div>
      )}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}
