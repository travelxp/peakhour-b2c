"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { QueryError } from "@/components/dashboard/query-error";
import { HeartButton, PreviewSkeletonTile } from "@/components/studio/preview-card";
import { NotForMeDialog } from "@/components/studio/creative-sections";
import { MakeFinalSheet } from "@/components/studio/make-final";
import { QuoteBlock, usePeaksLeft } from "@/components/studio/studio-quote";
import { MediaImage } from "@/components/shared/media-image";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBatch, useBatchAction } from "@/hooks/use-studio-pro";
import { useFinalQuote, useStudioAbilities } from "@/hooks/use-studio-flow";
import { useStudioAvailability } from "@/hooks/use-studio";
import type { BatchOp, BatchPreview, BatchView, ShortlistItem } from "@/lib/api/creative-studio";
import {
  actionableSelection,
  approvedForFinal,
  BATCH_FILTERS,
  BATCH_PAGE_SIZE,
  filterCounts,
  filterTiles,
  gridTiles,
  isGridActionable,
  liveSelection,
  moveFocus,
  shortcutFor,
  toggleAll,
  toggleSelected,
  undoOf,
  type BatchFilter,
  type GridKey,
} from "@/lib/studio-batch";
import { MAX_FINALS_PER_PRESS, studioRefusal } from "@/lib/studio-flow";
import { STUDIO_ROUTES } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

const B = STUDIO_COPY.batch;

const tileName = (p: BatchPreview) => p.productTitle ?? p.headline ?? `Preview ${p.index + 1}`;

export interface BatchTileProps {
  preview: BatchPreview;
  selected: boolean;
  focusable: boolean;
  canMake: boolean;
  onSelect: () => void;
  onHeart: () => void;
  onSkip: () => void;
}

/**
 * One product's best preview: the small picture, the product and headline, a select box, the heart and "Not for me". The tile itself takes focus (one tab stop for the whole
 * grid, arrow keys move between tiles), so a person can work the grid from the keyboard.
 */
export function BatchTile({ preview: p, selected, focusable, canMake, onSelect, onHeart, onSkip }: BatchTileProps) {
  const name = tileName(p);
  const actionable = isGridActionable(p);
  return (
    <div
      role="group"
      aria-label={name}
      data-slot="studio-batch-tile"
      data-selected={selected}
      data-tile-id={p.id}
      tabIndex={focusable ? 0 : -1}
      className={cn("flex h-full flex-col overflow-hidden rounded-lg border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && "border-primary ring-2 ring-primary")}
    >
      <div className="relative aspect-4/5 w-full bg-muted">
        {p.thumbUrl ? (
          <MediaImage src={p.thumbUrl} alt={[p.productTitle, p.headline].filter(Boolean).join(": ")} width={256} height={320} className="size-full object-cover" />
        ) : null}
        <Checkbox
          checked={selected}
          disabled={!actionable}
          onCheckedChange={onSelect}
          aria-label={B.selectTile(name)}
          className="absolute start-2 top-2 size-6 bg-background"
        />
        {p.liked && <Badge className="absolute end-2 top-2">{B.approvedBadge}</Badge>}
        {p.lapsed && (
          <Badge variant="secondary" className="absolute end-2 top-2">
            {B.changedBadge}
          </Badge>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2">
        <div className="min-w-0">
          {p.productTitle && <p className="truncate text-xs text-muted-foreground">{p.productTitle}</p>}
          <p className="truncate text-sm font-medium">{p.headline ?? ""}</p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <HeartButton pressed={p.liked} label={B.heart(name)} onToggle={onHeart} disabled={!canMake || !actionable} className="shrink-0" />
          <Button type="button" variant="ghost" className="h-12" disabled={!canMake || !actionable} aria-label={B.skip(name)} onClick={onSkip}>
            {STUDIO_COPY.creative.notForMe}
          </Button>
        </div>
      </div>
    </div>
  );
}

export interface BatchGridViewProps {
  batch: BatchView;
  canMake: boolean;
  /** "coming_soon": the count shows, the button reads that Make final opens soon and there is no price. */
  final: "on" | "coming_soon" | "unknown";
  finalQuote: { state: "loading" | "quote" | "unavailable"; peaks?: number; free?: boolean };
  left: number | null;
  pending: boolean;
  onAction: (op: BatchOp, ids: string[]) => void;
  onSkip: (ids: string[]) => void;
  onMakeFinal: () => void;
  onRetryQuote: () => void;
  lastBulk: { op: BatchOp; ids: string[] } | null;
  onUndo: () => void;
}

/**
 * The grid for approving many at once (UX spec S16). One best preview per product, 24 to a page. A bar of bulk actions (approve, not for me, make final) stays at the bottom
 * of the screen, where a thumb reaches it. Every Peaks figure is the api's quote of the approved ones: nothing here knows a price.
 */
export function BatchGridView(p: BatchGridViewProps) {
  const { batch } = p;
  const mobile = useIsMobile();
  const [filter, setFilter] = useState<BatchFilter>("all");
  const [pages, setPages] = useState(1);
  const [selectedRaw, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [active, setActive] = useState(0);
  const [help, setHelp] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const gridRef = useRef<HTMLUListElement>(null);

  const all = gridTiles(batch);
  const counts = filterCounts(all);
  const matching = filterTiles(all, filter);
  const visible = matching.slice(0, pages * BATCH_PAGE_SIZE);
  const selected = liveSelection(all, selectedRaw);
  // Only what is on screen: a tile hidden by the filter or the page is never changed by a press the person cannot see the effect of.
  const picked = actionableSelection(visible, selected);
  const approved = approvedForFinal(all);
  const columns = mobile ? 2 : 4;
  const makingMore = batch.status === "making";
  const pendingTiles = makingMore ? Math.max(0, batch.products - batch.done) : 0;

  const focusTile = (i: number) => {
    setActive(i);
    const id = visible[i]?.id;
    if (id) gridRef.current?.querySelector<HTMLElement>(`[data-tile-id="${id}"]`)?.focus();
  };

  const act = (op: BatchOp, ids: string[]) => {
    if (ids.length === 0) return;
    if (op === "reject") {
      p.onSkip(ids);
      return;
    }
    p.onAction(op, ids);
    setAnnouncement(op === "approve" ? B.approvedDone(ids.length) : B.clearedDone(ids.length));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const target = e.target as HTMLElement;
    // Only when the tile itself has focus: a key typed on its checkbox or buttons is theirs.
    if (!target.matches('[data-slot="studio-batch-tile"]')) return;
    const i = visible.findIndex((t) => t.id === target.dataset.tileId);
    if (i < 0) return;
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      focusTile(moveFocus(i, e.key as GridKey, columns, visible.length));
      return;
    }
    const action = shortcutFor(e);
    if (!action) return;
    e.preventDefault();
    const here = visible[i]!;
    // With a selection the keys act on it; with none they act on the tile in focus.
    const ids = picked.length > 0 ? picked : isGridActionable(here) ? [here.id] : [];
    if (p.pending && action !== "select" && action !== "help") return;
    if (action === "select") setSelected(toggleSelected(selected, here.id));
    else if (action === "approve" && p.canMake) act("approve", ids);
    else if (action === "reject" && p.canMake) act("reject", ids);
    else if (action === "undo" && p.canMake && p.lastBulk) p.onUndo();
    else if (action === "help") setHelp((h) => !h);
  };

  if (all.length === 0 && !makingMore) {
    return <EmptyState icon={LayoutGrid} title={B.empty.title} description={B.empty.description} />;
  }

  return (
    <div className="space-y-4 pb-44 md:pb-32" data-slot="studio-batch">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {makingMore && (
        <section className="space-y-2 rounded-lg border bg-card p-4" aria-label={B.making(batch.done, batch.products)}>
          <p className="text-sm font-medium">{B.making(batch.done, batch.products)}</p>
          <Progress value={Math.round((batch.done / Math.max(batch.products, 1)) * 100)} aria-label={B.making(batch.done, batch.products)} />
          <p className="text-sm text-muted-foreground">{STUDIO_COPY.creative.youCanLeave}</p>
        </section>
      )}
      {batch.failedProducts > 0 && (
        <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
          {B.failedBanner(batch.failedProducts)}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={B.filterLabel} className="flex flex-wrap gap-1">
          {BATCH_FILTERS.map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={filter === f ? "default" : "outline"}
              aria-pressed={filter === f}
              className="h-11 sm:h-9"
              onClick={() => {
                setFilter(f);
                setPages(1);
                setActive(0);
              }}
            >
              {B.filters[f]} ({counts[f]})
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => setSelected(toggleAll(visible, selected))}>
            {B.selectAll}
          </Button>
          <Button type="button" variant="ghost" className="hidden h-9 md:inline-flex" aria-expanded={help} onClick={() => setHelp((h) => !h)}>
            {B.shortcuts}
          </Button>
        </div>
      </div>
      {help && <p className="rounded-lg border bg-muted/40 p-3 text-sm">{B.shortcutsList}</p>}

      <ul ref={gridRef} aria-label={B.region} onKeyDown={onKeyDown} className="grid grid-cols-2 gap-3 md:grid-cols-4" data-slot="studio-batch-grid">
        {visible.map((t, i) => (
          <li key={t.id}>
            <BatchTile
              preview={t}
              selected={selected.has(t.id)}
              focusable={i === Math.min(active, visible.length - 1)}
              canMake={p.canMake}
              onSelect={() => setSelected(toggleSelected(selected, t.id))}
              onHeart={() => act(t.liked ? "clear" : "approve", [t.id])}
              onSkip={() => act("reject", [t.id])}
            />
          </li>
        ))}
        {Array.from({ length: pendingTiles }, (_, k) => (
          <li key={`pending-${k}`}>
            <PreviewSkeletonTile index={visible.length + k} ratio="4 / 5" />
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">{B.count(visible.length, matching.length)}</p>
        {matching.length > visible.length && (
          <Button type="button" variant="outline" className="h-11" onClick={() => setPages((n) => n + 1)}>
            {B.loadMore(Math.min(BATCH_PAGE_SIZE, matching.length - visible.length))}
          </Button>
        )}
      </div>

      <div
        role="region"
        aria-label={B.barLabel}
        data-slot="studio-batch-bar"
        className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t bg-background px-3 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:bottom-0 md:start-(--sidebar-width,0px)"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm font-medium" aria-live="polite">
              {B.selected(picked.length)}
            </span>
            <Button type="button" className="h-11 px-3" aria-label={B.approve(picked.length)} disabled={!p.canMake || picked.length === 0 || p.pending} onClick={() => act("approve", picked)}>
              {B.approveShort(picked.length)}
            </Button>
            <Button type="button" variant="outline" className="h-11 px-3" aria-label={B.reject(picked.length)} disabled={!p.canMake || picked.length === 0 || p.pending} onClick={() => act("reject", picked)}>
              {B.rejectShort(picked.length)}
            </Button>
            {p.lastBulk && undoOf(p.lastBulk.op) && (
              <Button type="button" variant="ghost" className="h-11" disabled={p.pending} onClick={p.onUndo}>
                {B.undo}
              </Button>
            )}
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              {p.final === "on" && approved.length > 0 && (
                <QuoteBlock
                  state={p.finalQuote.state}
                  peaks={p.finalQuote.peaks}
                  kind="finals"
                  units={Math.min(approved.length, MAX_FINALS_PER_PRESS)}
                  free={p.finalQuote.free}
                  left={p.left}
                  help
                  onRetry={p.onRetryQuote}
                />
              )}
              {approved.length === 0 && <p className="text-sm text-muted-foreground">{B.makeFinalNone}</p>}
            </div>
            <Button type="button" className="h-auto min-h-12 w-32 shrink-0 whitespace-normal py-2 sm:w-44" disabled={p.final !== "on" || !p.canMake || approved.length === 0} onClick={p.onMakeFinal}>
              {p.final === "coming_soon" ? B.soon : B.makeFinal(approved.length)}
            </Button>
          </div>
          {!p.canMake && <p className="text-xs text-muted-foreground">{STUDIO_COPY.refusal.askAnEditorToMake}</p>}
        </div>
      </div>
    </div>
  );
}

/** The batch screen: the read, the bulk actions, the one quote for the approved ones, and the Make final sheet. */
export function BatchScreen({ id }: { id: string }) {
  const q = useBatch(id);
  const qc = useQueryClient();
  const bulk = useBatchAction(id);
  const { canMake } = useStudioAbilities();
  const availability = useStudioAvailability();
  const left = usePeaksLeft();
  const [skipIds, setSkipIds] = useState<string[] | null>(null);
  const [lastBulk, setLastBulk] = useState<{ op: BatchOp; ids: string[] } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [offNow, setOffNow] = useState(false);
  const batch = q.data;
  const approved = batch ? approvedForFinal(gridTiles(batch)) : [];
  const final: "on" | "coming_soon" | "unknown" = availability.loading ? "unknown" : availability.capabilities.final === "on" && !offNow ? "on" : "coming_soon";
  const quote = useFinalQuote(Math.min(approved.length, MAX_FINALS_PER_PRESS), final === "on" && canMake && approved.length > 0);

  if (q.isPending && q.errorUpdatedAt === 0) {
    return <Skeleton aria-busy="true" aria-label={B.region} className="h-80 rounded-lg" />;
  }
  if (!batch) {
    if (q.error instanceof ApiError && q.error.status === 404) {
      return <EmptyState icon={LayoutGrid} title={B.notFound.title} description={B.notFound.description} action={{ label: B.back, href: STUDIO_ROUTES.home }} />;
    }
    return <QueryError what={B.error} onRetry={() => void q.refetch()} />;
  }

  const run = (op: BatchOp, ids: string[], reasons?: string[], isUndo = false) => {
    bulk.mutate(
      { op, previewIds: ids, ...(reasons ? { reasons } : {}) },
      {
        onSuccess: (r) => {
          if (r.skipped > 0) toast(B.partial(r.skipped));
          if (isUndo) {
            setLastBulk(null);
            toast(B.undone);
            return;
          }
          // Only a heart can be taken back from here (a skip is final), and only for the previews this press actually changed: one that was already
          // hearted before an approve keeps its heart when the press is undone.
          const changed = ids.filter((id) => {
            const t = batch.previews.find((x) => x.id === id);
            return t ? (op === "approve" ? !t.liked : t.liked) : false;
          });
          setLastBulk(undoOf(op) && changed.length > 0 ? { op, ids: changed } : null);
          if (op === "reject") toast(B.rejectedDone(ids.length));
        },
        onError: (e) => toast.error(studioRefusal(e).text),
      },
    );
  };

  const items: ShortlistItem[] = approved.map((t) => ({
    creativeId: t.creativeId,
    previewId: t.id,
    state: "shortlisted",
    headline: t.headline ?? "",
    productTitle: t.productTitle,
    thumbUrl: t.thumbUrl,
    likedAt: null,
    lapsed: false,
    waitingLong: false,
  }));

  return (
    <>
      <BatchGridView
        batch={batch}
        canMake={canMake}
        final={final}
        finalQuote={{ state: quote.quote ? "quote" : quote.unavailable ? "unavailable" : "loading", peaks: quote.quote?.peaks, free: quote.quote?.free }}
        left={left}
        pending={bulk.isPending}
        lastBulk={lastBulk}
        onAction={(op, ids) => run(op, ids)}
        onSkip={(ids) => setSkipIds(ids)}
        onUndo={() => {
          const back = lastBulk ? undoOf(lastBulk.op) : null;
          if (lastBulk && back) run(back, lastBulk.ids, undefined, true);
        }}
        onMakeFinal={() => setSheetOpen(true)}
        onRetryQuote={() => void qc.invalidateQueries({ queryKey: ["peaks-quote"] })}
      />
      <NotForMeDialog
        open={skipIds !== null}
        onOpenChange={(o) => !o && setSkipIds(null)}
        pending={bulk.isPending}
        onConfirm={(reasons) => {
          if (!skipIds) return;
          run("reject", skipIds, reasons);
          setSkipIds(null);
        }}
      />
      <MakeFinalSheet open={sheetOpen} onOpenChange={setSheetOpen} items={items} onNotReleased={() => setOffNow(true)} />
      <p className="text-xs text-muted-foreground">
        <Link href={STUDIO_ROUTES.home} className="underline underline-offset-2">
          {B.back}
        </Link>
      </p>
    </>
  );
}
