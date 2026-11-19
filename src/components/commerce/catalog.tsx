"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ColumnDef } from "@tanstack/react-table";
import { PackageSearch, Store } from "lucide-react";
import { DataTable } from "@/components/molecules/data-table";
import { EmptyState } from "@/components/molecules/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { STUDIO_COPY } from "@/lib/studio-copy";
import { MAX_BATCH_PRODUCTS } from "@/lib/studio-flow";
import { atBatchCap } from "@/lib/studio-batch-start";
import { PageShell } from "@/components/dashboard/page-shell";
import { SearchVisibilityPanel } from "@/components/commerce/search-visibility";
import {
  useCommerceCatalog,
  LISTING_ISSUE_LABEL,
  type CatalogItem,
} from "@/hooks/use-commerce-catalog";

// Studio's batch start (Pro tools) is its own chunk, kept out of the catalog's own bundle; only the button shows for a person with Pro tools.
const BatchStartFlow = dynamic(() => import("@/components/studio/batch-start").then((m) => m.BatchStartFlow), { ssr: false });
const MakeForSeveralButton = dynamic(() => import("@/components/studio/batch-start").then((m) => m.MakeForSeveralButton), { ssr: false });

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
  // "Make previews for several" (Studio, Pro tools): a choosing mode with a tick per row, then the one price in a sheet.
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [overCap, setOverCap] = useState(false);
  const [pricing, setPricing] = useState(false);
  // The latest list lives in a ref as well, so two ticks before a re-render both count and the cap is judged on the true length.
  const chosenRef = useRef<string[]>([]);
  const setPicks = useCallback((next: string[]) => {
    chosenRef.current = next;
    setChosen(next);
  }, []);
  const toggleChosen = useCallback(
    (id: string) => {
      const cur = chosenRef.current;
      if (cur.includes(id)) {
        setOverCap(false);
        setPicks(cur.filter((x) => x !== id));
      } else if (atBatchCap(cur.length)) {
        setOverCap(true);
      } else {
        setOverCap(false);
        setPicks([...cur, id]);
      }
    },
    [setPicks],
  );

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
      ...(choosing
        ? [
            {
              id: "choose",
              header: () => <span className="sr-only">{STUDIO_COPY.batchStart.catalogSelect}</span>,
              cell: ({ row }: { row: { original: CatalogItem } }) => (
                <Checkbox
                  checked={chosen.includes(row.original.productId)}
                  onCheckedChange={() => toggleChosen(row.original.productId)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={STUDIO_COPY.batchStart.rowLabel(row.original.title || "Untitled product")}
                />
              ),
            } satisfies ColumnDef<CatalogItem>,
          ]
        : []),
      {
        accessorKey: "title",
        header: "Product",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-3">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img width={36} height={36} loading="lazy"
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
    [money, choosing, chosen, toggleChosen],
  );

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (band === "all") return items;
    return items.filter((i) => healthBand(i.health.qualityScore) === band);
  }, [data, band]);

  if (isLoading) {
    return (
      <PageShell width="standard">
        <Header />
        <Skeleton className="h-64 w-full rounded-lg" />
      </PageShell>
    );
  }

  if (isError || !data) {
    return (
      <PageShell width="standard">
        <Header />
        <EmptyState
          icon={Store}
          title="Connect a store to see your catalog"
          description="Catalog & Listings lights up once a Shopify or WooCommerce store is connected to this business."
          action={{ label: "Connect a store", href: "/dashboard/integrations" }}
        />
      </PageShell>
    );
  }

  const loaded = data.items.length;
  const needsWork = data.items.filter((i) => healthBand(i.health.qualityScore) === "needs_work").length;
  // Counts are over the LOADED set (a single page), so they always reconcile;
  // surface the cap explicitly when the store has more than we fetched.
  const capped = data.total > loaded;

  return (
    <PageShell width="standard">
      <Header />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterPill active={band === "all"} onClick={() => setBand("all")}>
          All ({loaded})
        </FilterPill>
        <FilterPill active={band === "needs_work"} onClick={() => setBand("needs_work")}>
          Needs work ({needsWork})
        </FilterPill>
        <FilterPill active={band === "healthy"} onClick={() => setBand("healthy")}>
          Healthy ({loaded - needsWork})
        </FilterPill>
      </div>

      {capped && (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing the first {loaded} of {data.total} products.
        </p>
      )}

      {!choosing && (
        <MakeForSeveralButton
          className="mb-3 h-11"
          onPress={() => {
            setPicks([]);
            setOverCap(false);
            setChoosing(true);
          }}
        />
      )}
      {choosing && (
        <div role="group" aria-label={STUDIO_COPY.batchStart.catalogSelect} className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-2">
          <p role="status" aria-live="polite" className="me-auto text-sm">
            {STUDIO_COPY.batchStart.catalogSelected(chosen.length)}
            {overCap && <span className="block text-muted-foreground">{STUDIO_COPY.batchStart.over(MAX_BATCH_PRODUCTS)}</span>}
          </p>
          <Button type="button" variant="ghost" className="h-11" onClick={() => setChoosing(false)}>
            {STUDIO_COPY.batchStart.catalogDone}
          </Button>
          <Button type="button" className="h-11" disabled={chosen.length === 0} onClick={() => setPricing(true)}>
            {STUDIO_COPY.batchStart.next(chosen.length)}
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => (choosing ? toggleChosen(row.productId) : setSelected(row))}
        emptyMessage="No products in this view."
      />

      {pricing && (
        <BatchStartFlow
          open
          initialIds={chosen}
          onClose={() => setPricing(false)}
        />
      )}

      <ListingDrawer item={selected} money={money} onClose={() => setSelected(null)} />

      {/* ★THE THIRD QUESTION ABOUT THE SAME PRODUCTS: not "is this listing
          complete" but "does Google show it at all". Below the table because
          the table is what a merchant came to this route for, and it renders
          NOTHING at all when there is no catalog to report on — this panel is
          additive to the page, never a blocker on it. */}
      <SearchVisibilityPanel />
    </PageShell>
  );
}

function Header() {
  return (
    <header className="mb-6">
      <h1 className="text-xl font-semibold">Products</h1>
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
                <img loading="lazy"
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
                  <p className="mt-1 text-sm text-success-on-tint">
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
