"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PackageSearch, Store } from "lucide-react";
import { DataTable } from "@/components/molecules/data-table";
import { EmptyState } from "@/components/molecules/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { useLocale } from "@/hooks/use-locale";
import { minorToMajor } from "@/lib/money";
import {
  useCommerceCatalog,
  LISTING_ISSUE_LABEL,
  type CatalogItem,
} from "@/hooks/use-commerce-catalog";

/**
 * Commerce → Catalog & Listings (Phase 0/1). The canonical catalog with a
 * per-listing quality score (api#837). A health-band filter narrows the list; a
 * row opens a drawer showing the product's issues and the "fix listing" intent
 * (the Merchandiser agent, wired in Phase 2). Gated on `commerce.nav`.
 */

const HEALTHY_THRESHOLD = 0.75;

function healthBand(score: number): "healthy" | "needs_work" {
  return score >= HEALTHY_THRESHOLD ? "healthy" : "needs_work";
}

export function CommerceCatalog() {
  return (
    <FeatureGate feature="commerce.nav" featureName="Commerce">
      <CatalogBody />
    </FeatureGate>
  );
}

type BandFilter = "all" | "needs_work" | "healthy";

function CatalogBody() {
  const { data, isLoading, isError } = useCommerceCatalog();
  const { formatNumber } = useLocale();
  const [band, setBand] = useState<BandFilter>("all");
  const [selected, setSelected] = useState<CatalogItem | null>(null);

  const money = useCallback(
    (minor: number | null, currency: string | null) => {
      if (minor === null) return "—";
      const cur = currency ?? "USD";
      return formatNumber(minorToMajor(minor, cur), {
        style: "currency",
        currency: cur,
        maximumFractionDigits: 0,
      });
    },
    [formatNumber],
  );

  const columns = useMemo<ColumnDef<CatalogItem>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Product",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-3">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="size-9 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <PackageSearch className="size-4 text-muted-foreground" />
                </div>
              )}
              <span className="line-clamp-1 font-medium">{item.title || "Untitled product"}</span>
            </div>
          );
        },
      },
      {
        id: "health",
        header: "Listing health",
        cell: ({ row }) => {
          const { qualityScore, issues } = row.original.health;
          const pct = Math.round(qualityScore * 100);
          const good = healthBand(qualityScore) === "healthy";
          return (
            <div className="flex items-center gap-2">
              <Badge variant={good ? "secondary" : "outline"} className="tabular-nums">
                {pct}%
              </Badge>
              {issues.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {issues.length} issue{issues.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "price",
        header: () => <div className="text-right">Price</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {money(row.original.priceMinor, row.original.currency)}
          </div>
        ),
      },
    ],
    [money],
  );

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (band === "all") return items;
    return items.filter((i) => healthBand(i.health.qualityScore) === band);
  }, [data, band]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Header />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Header />
        <EmptyState
          icon={Store}
          title="Connect a store to see your catalog"
          description="Catalog & Listings lights up once a Shopify or WooCommerce store is connected to this business."
          action={{ label: "Connect a store", href: "/dashboard/integrations" }}
        />
      </div>
    );
  }

  const needsWork = data.items.filter((i) => healthBand(i.health.qualityScore) === "needs_work").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Header />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterPill active={band === "all"} onClick={() => setBand("all")}>
          All ({data.total})
        </FilterPill>
        <FilterPill active={band === "needs_work"} onClick={() => setBand("needs_work")}>
          Needs work ({needsWork})
        </FilterPill>
        <FilterPill active={band === "healthy"} onClick={() => setBand("healthy")}>
          Healthy ({data.items.length - needsWork})
        </FilterPill>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => setSelected(row)}
        emptyMessage="No products in this view."
      />

      <ListingDrawer item={selected} money={money} onClose={() => setSelected(null)} />
    </div>
  );
}

function Header() {
  return (
    <header className="mb-6">
      <h1 className="text-xl font-semibold">Catalog &amp; Listings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your products and how well each one is listed. Fix the weak spots to sell
        more — Peakhour&apos;s Merchandiser can do it for you.
      </p>
    </header>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant={active ? "default" : "outline"} size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}

function ListingDrawer({
  item,
  money,
  onClose,
}: {
  item: CatalogItem | null;
  money: (minor: number | null, currency: string | null) => string;
  onClose: () => void;
}) {
  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle className="line-clamp-2">{item.title || "Untitled product"}</SheetTitle>
              <SheetDescription>
                {money(item.priceMinor, item.currency)} · {item.channel}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="aspect-square w-full rounded-lg object-cover"
                />
              )}

              <div>
                <p className="text-sm font-medium">
                  Listing health — {Math.round(item.health.qualityScore * 100)}%
                </p>
                {item.health.issues.length === 0 ? (
                  <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                    This listing looks great.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {item.health.issues.map((issue) => (
                      <li key={issue} className="text-sm text-muted-foreground">
                        • {LISTING_ISSUE_LABEL[issue] ?? issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Button className="w-full" disabled>
                Fix with Merchandiser — coming soon
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
