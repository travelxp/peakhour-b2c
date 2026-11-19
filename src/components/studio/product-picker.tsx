"use client";

import { useMemo, useState } from "react";
import { Camera, Check, ImageOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/molecules/empty-state";
import { QueryError } from "@/components/dashboard/query-error";
import { MediaImage } from "@/components/shared/media-image";
import { useProductImages } from "@/hooks/use-studio-flow";
import { useIsMobile } from "@/hooks/use-mobile";
import { MAX_BATCH_PRODUCTS, MAX_BRIEF_PRODUCTS, type PickerProduct } from "@/lib/studio-flow";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

const P = STUDIO_COPY.picker;
const B = STUDIO_COPY.batchStart;

export type PickerStatus = "loading" | "offline" | "error" | "ready";

/**
 * The picker's body (UX spec S4), drawn from what it is told so every state can be rendered and tested on its own: loading tiles, an error
 * with Retry (never an empty list), no products, no match for the search, the over-limit line, and the tiles with a tick.
 * Tiles are checkboxes named by the product's title; the counter is a polite live region.
 */
export function ProductPickerView({
  status,
  products,
  selected,
  max = MAX_BRIEF_PRODUCTS,
  query,
  onQuery,
  onToggle,
  onRetry,
  importing,
  importStopped,
  overLimit,
  hasMore,
  onLoadMore,
  batch,
}: {
  status: PickerStatus;
  products: PickerProduct[];
  selected: string[];
  max?: number;
  query: string;
  onQuery: (q: string) => void;
  onToggle: (id: string) => void;
  onRetry: () => void;
  importing?: boolean;
  importStopped?: string;
  /** The last tick was refused because three are already chosen. */
  overLimit?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** Batch mode (Pro tools): "{n} chosen", up to the batch cap, no "of 3". */
  batch?: boolean;
}) {
  const q = query.trim().toLowerCase();
  const shown = q ? products.filter((p) => p.title.toLowerCase().includes(q)) : products;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-slot="studio-product-picker">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={P.search}
          aria-label={P.search}
          className="h-11 ps-9"
        />
      </div>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {batch ? B.counter(selected.length) : P.counter(selected.length, max)}
        {overLimit && <span className="block text-foreground">{batch ? B.over(max) : P.over(max)}</span>}
      </p>
      {importing && <p className="text-sm text-muted-foreground">{P.importing}</p>}
      {importStopped && <p className="text-sm text-muted-foreground">{importStopped}</p>}
      {status === "loading" && (
        <div aria-busy="true" aria-label={P.loading} className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      )}
      {status === "offline" && <QueryError what={P.error.what} kind="offline" />}
      {status === "error" && <QueryError what={P.error.what} onRetry={onRetry} />}
      {status === "ready" && products.length === 0 && (
        <EmptyState icon={Camera} title={P.noProducts.title} description={P.noProducts.description} className="min-h-48" />
      )}
      {status === "ready" && products.length > 0 && shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{P.noMatch(query.trim())}</p>}
      {status === "ready" && shown.length > 0 && (
        <ul aria-label={P.list} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((p) => {
            const on = selected.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => onToggle(p.id)}
                  className={cn(
                    "relative flex w-full flex-col gap-1 overflow-hidden rounded-lg border bg-card p-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on && "border-primary ring-2 ring-primary",
                  )}
                >
                  <span className="relative block aspect-square overflow-hidden rounded-md bg-muted">
                    {p.photo?.url ? (
                      <MediaImage src={p.photo.url} alt="" width={p.photo.width ?? 256} height={p.photo.height ?? 256} className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                        <ImageOff aria-hidden="true" className="me-1 size-4 shrink-0" />
                        {p.title}
                      </span>
                    )}
                    {on && (
                      <span className="absolute end-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check aria-hidden="true" className="size-4" />
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 px-0.5 text-sm font-medium">{p.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {status === "ready" && hasMore && onLoadMore && (
        <Button type="button" variant="outline" className="h-11 self-center" onClick={onLoadMore}>
          {P.loadMore}
        </Button>
      )}
    </div>
  );
}

/**
 * The sheet around the picker: a full-height bottom sheet on a phone and a side sheet on a larger screen. Changes are local to the plan
 * (the plan saves them); "Done" closes it. A fourth tick is refused inline, not silently.
 */
export function ProductPicker({
  open,
  onOpenChange,
  selected,
  onChange,
  max,
  batch = false,
  doneLabel,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: string[];
  onChange: (ids: string[], products: PickerProduct[]) => void;
  max?: number;
  /** Batch mode (Pro tools, UX spec S4): up to the batch cap, and the footer button carries on to the price. */
  batch?: boolean;
  doneLabel?: string;
  /** Pressed instead of closing, when the footer button carries on (batch mode). */
  onDone?: () => void;
}) {
  const limit = max ?? (batch ? MAX_BATCH_PRODUCTS : MAX_BRIEF_PRODUCTS);
  const mobile = useIsMobile();
  const images = useProductImages(open);
  const [query, setQuery] = useState("");
  const [over, setOver] = useState(false);
  const status: PickerStatus =
    images.data !== undefined ? "ready" : images.isError ? "error" : images.fetchStatus === "paused" ? "offline" : "loading";
  const stopped = images.imports.find((i) => i.status === "stopped");
  const products = useMemo(() => images.products, [images.products]);
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setOver(false);
      onChange(
        selected.filter((x) => x !== id),
        products,
      );
    } else if (selected.length >= limit) {
      setOver(true);
    } else {
      setOver(false);
      onChange([...selected, id], products);
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setOver(false);
        onOpenChange(o);
      }}
    >
      <SheetContent side={mobile ? "bottom" : "right"} className={cn("gap-3 p-4", mobile ? "h-[92dvh]" : "sm:max-w-lg")}>
        <SheetHeader className="p-0">
          <SheetTitle>{batch ? B.pickerTitle : P.title}</SheetTitle>
          <SheetDescription>{batch ? B.pickerDescription : P.description}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <ProductPickerView
            status={status}
            products={products}
            selected={selected}
            max={limit}
            batch={batch}
            query={query}
            onQuery={setQuery}
            onToggle={toggle}
            onRetry={() => void images.refetch()}
            importing={images.imports.some((i) => i.status === "running")}
            importStopped={stopped ? (stopped.stoppedReason ?? P.importStopped) : undefined}
            overLimit={over}
            hasMore={images.hasNextPage}
            onLoadMore={() => void images.fetchNextPage()}
          />
        </div>
        <SheetFooter className="p-0 pb-[env(safe-area-inset-bottom)]">
          <Button type="button" className="h-11 w-full" disabled={!!onDone && selected.length === 0} onClick={() => (onDone ? onDone() : onOpenChange(false))}>
            {doneLabel ?? P.done}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
