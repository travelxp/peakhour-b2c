"use client";

import { Store } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { EmptyState } from "@/components/molecules/empty-state";
import { PendingItemsCard } from "@/components/molecules/pending-items-card";
import { useCommerceSummary } from "@/hooks/use-commerce-summary";

/**
 * Commerce → Channels (Phase 0). The four channel archetypes. Only D2C
 * (Shopify / WooCommerce) is live today; Marketplace, Quick Commerce and
 * General Trade show an honest "on the roadmap" placeholder — never a fake tile
 * with invented data (the certification-firewall / ground-in-catalog rule).
 * Each archetype gets the same page skeleton; the adapters land per market.
 */
export function CommerceChannels() {
  return (
    <FeatureGate feature="commerce.nav" featureName="Commerce">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Channels</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where you sell. Peakhour runs the same engine across every channel —
            connect them here as each one comes online.
          </p>
        </header>

        <Tabs defaultValue="d2c">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="d2c">D2C storefront</TabsTrigger>
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
            <TabsTrigger value="quick">Quick Commerce</TabsTrigger>
            <TabsTrigger value="gt">General Trade</TabsTrigger>
          </TabsList>

          <TabsContent value="d2c">
            <D2CTab />
          </TabsContent>
          <TabsContent value="marketplace">
            <PendingItemsCard
              title="Marketplace — on the roadmap"
              items={[
                { title: "Amazon", caption: "Listing quality, buy-box and retail-media, managed by the engine." },
                { title: "Flipkart", caption: "Share-of-search and price competitiveness — coming as an adapter." },
                { title: "Myntra · Nykaa", caption: "Category marketplaces for fashion & beauty — on the roadmap." },
              ]}
            />
          </TabsContent>
          <TabsContent value="quick">
            <PendingItemsCard
              title="Quick Commerce — on the roadmap"
              items={[
                { title: "Blinkit", caption: "Dark-store availability, fill-rate and visibility — coming as an adapter." },
                { title: "Zepto", caption: "Per-dark-store assortment and demand — on the roadmap." },
                { title: "Swiggy Instamart", caption: "Q-commerce listings and ads — on the roadmap." },
              ]}
            />
          </TabsContent>
          <TabsContent value="gt">
            <PendingItemsCard
              title="General Trade — on the roadmap"
              items={[
                { title: "Distributor ordering", caption: "Secondary sales and distributor stock — coming as an adapter." },
                { title: "Retailer coverage", caption: "Beat coverage and WhatsApp ordering — on the roadmap." },
              ]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </FeatureGate>
  );
}

/** Channel labels for the connected D2C store platform. */
const PLATFORM_LABEL: Record<string, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
};

function D2CTab() {
  const { data, isLoading, isError } = useCommerceSummary();

  if (isLoading) return <Skeleton className="h-28 w-full rounded-lg" />;

  if (isError || !data) {
    return (
      <EmptyState
        icon={Store}
        title="Connect your storefront"
        description="Connect a Shopify or WooCommerce store to this business to bring your D2C channel online."
        action={{ label: "Connect a store", href: "/dashboard/integrations" }}
      />
    );
  }

  const platform = data.store.platform ?? "";
  // `||` (not `??`) so an empty platform also falls through to "Your store".
  const label = PLATFORM_LABEL[platform] || platform || "Your store";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{label}</CardTitle>
        <Badge variant="secondary" className="gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Connected
        </Badge>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Your direct storefront — catalog, inventory and the assistant are live.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href="/dashboard/integrations">Manage</a>
        </Button>
      </CardContent>
    </Card>
  );
}
