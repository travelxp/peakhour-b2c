import Link from "next/link";
import { Copy, Download, Image as ImageIcon, ImageOff, Info, RefreshCw, Star, Trash2 } from "lucide-react";
import type { LibraryItem, LibraryPage, LibraryView as LibraryViewKind, ProductPhotoTile, ProductPhotosOne } from "@/lib/api/creative";
import type { ProductImportStatus } from "@/lib/api/media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { QueryError } from "@/components/dashboard/query-error";
import { chipFor, creativeHref, importLines, itemTitle, pageCount, sentTo } from "@/lib/studio-library";
import { STUDIO_ROUTES, type IdeasFeedStatus } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";

const C = STUDIO_COPY.library;

const FORMAT_LABEL: Record<string, string> = STUDIO_COPY.formats;

function Loading() {
  return (
    <div aria-busy="true" aria-label={C.loading} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
      ))}
    </div>
  );
}

/** What a tile can do, as callbacks: the view draws, the container decides. A viewer reads and saves a picture but changes nothing. */
export interface TileActions {
  canChange: boolean;
  /** Pro tools select mode: a checkbox replaces the buttons. */
  selecting?: boolean;
  selected?: ReadonlySet<string>;
  /** The creatives with a change in flight. */
  busyIds?: ReadonlySet<string>;
  onToggle?: (id: string) => void;
  onDownload?: (item: LibraryItem) => void;
  onNewVersion?: (item: LibraryItem) => void;
  onDelete?: (item: LibraryItem) => void;
}

function CreativeTile({ item, view, actions }: { item: LibraryItem; view: LibraryViewKind; actions?: TileActions }) {
  const title = itemTitle(item);
  const format = FORMAT_LABEL[item.format] ?? item.format;
  const A = C.actions;
  const busy = actions?.busyIds?.has(item.id) ?? false;
  const sent = view === "made" ? sentTo(item) : "";
  const canChange = actions?.canChange ?? false;
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card" data-publish={view === "made" ? item.publish.state : undefined}>
      <Link
        href={creativeHref(item.id)}
        aria-label={`${C.open}: ${C.itemLabel(title, format)}`}
        className="group flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-[4/5] bg-muted">
          {item.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed Drive link; see MediaImage for why this stays off the optimiser
            <img src={item.thumbUrl} alt={C.thumbAlt(title)} loading="lazy" decoding="async" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageOff aria-hidden="true" className="size-6" />
              <span className="text-xs">{C.noThumb}</span>
            </div>
          )}
          <Badge variant="secondary" className="absolute start-2 top-2">
            {chipFor(item, view)}
          </Badge>
        </div>
        <div className="space-y-0.5 p-3">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{sent ? `${format}. ${sent}` : format}</p>
        </div>
      </Link>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 border-t p-2">
          {actions.selecting && canChange ? (
            <label className="flex min-h-11 flex-1 items-center gap-2 text-sm">
              <Checkbox checked={actions.selected?.has(item.id) ?? false} onCheckedChange={() => actions.onToggle?.(item.id)} aria-label={C.bulk.selectLabel(title)} />
              {C.bulk.selectLabel(title)}
            </label>
          ) : (
            <>
              {item.actions.download && (
                <Button type="button" variant="outline" className="h-11 gap-1.5" aria-label={A.downloadLabel(title)} disabled={busy} onClick={() => actions.onDownload?.(item)}>
                  <Download aria-hidden="true" className="size-4" />
                  {A.download}
                </Button>
              )}
              {canChange && item.actions.newVersion && (
                <Button type="button" variant="outline" className="h-11 gap-1.5" aria-label={A.newVersionLabel(title)} disabled={busy} onClick={() => actions.onNewVersion?.(item)}>
                  <Copy aria-hidden="true" className="size-4" />
                  {A.newVersion}
                </Button>
              )}
              {canChange && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-1.5 text-destructive"
                  aria-label={A.deleteLabel(title)}
                  disabled={busy || !item.actions.delete}
                  onClick={() => actions.onDelete?.(item)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  {item.actions.deleteBlock === "making" ? A.stillMaking : A.delete}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** Pro tools: what is selected, and what to do with it. Hidden until something is selected. */
export function BulkBar({ count, busy, onDelete, onArchive, onClear }: { count: number; busy: boolean; onDelete: () => void; onArchive: () => void; onClear: () => void }) {
  const B = C.bulk;
  if (count === 0) return null;
  return (
    <div role="region" aria-label={B.selected(count)} className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-md">
      <p role="status" aria-live="polite" className="me-auto text-sm font-medium">
        {B.selected(count)}
      </p>
      <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={onArchive}>
        {B.archiveSelected}
      </Button>
      <Button type="button" variant="outline" className="h-11 gap-1.5 text-destructive" disabled={busy} onClick={onDelete}>
        <Trash2 aria-hidden="true" className="size-4" />
        {B.deleteSelected}
      </Button>
      <Button type="button" variant="ghost" className="h-11" disabled={busy} onClick={onClear}>
        {B.clear}
      </Button>
    </div>
  );
}

/**
 * "Made in Studio" and "Saved plans": the grid of what Studio made, drawn from what it is told. Loading, offline, error (never an empty
 * list), the designed empty states (nothing yet, nothing matches the search) and the grid with its pages.
 */
export function CreativesView({
  view,
  status,
  data,
  filtered,
  onRetry,
  onClearFilters,
  onPage,
  announcement = "",
  actions,
}: {
  view: LibraryViewKind;
  status: IdeasFeedStatus;
  data?: LibraryPage;
  /** A search or filter is on: an empty answer then says "nothing matches", not "nothing made". */
  filtered: boolean;
  onRetry: () => void;
  onClearFilters: () => void;
  onPage: (page: number) => void;
  announcement?: string;
  actions?: TileActions;
}) {
  const what = view === "plans" ? C.error.plans : C.error.made;
  const pages = data ? pageCount(data.total, data.pageSize) : 1;
  // Nothing at all. A page past the end (the list shrank under the reader) has a total but no items: it keeps its pager, so the way back is there.
  const empty = status === "ready" && data !== undefined && data.items.length === 0 && data.total === 0;
  const pastEnd = status === "ready" && data !== undefined && data.items.length === 0 && data.total > 0;
  return (
    <div className="space-y-4">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {status === "loading" && <Loading />}
      {status === "offline" && <QueryError what={what} kind="offline" />}
      {status === "error" && <QueryError what={what} onRetry={onRetry} />}
      {empty && filtered && (
        <EmptyState icon={ImageIcon} title={C.emptyFiltered.title} description={C.emptyFiltered.description} action={{ label: C.emptyFiltered.action, onClick: onClearFilters }} />
      )}
      {empty && !filtered && view === "made" && (
        <EmptyState
          icon={ImageIcon}
          title={STUDIO_COPY.shells.library.emptyTitle}
          description={STUDIO_COPY.shells.library.emptyDescription}
          action={{ label: STUDIO_COPY.shells.library.emptyAction, href: STUDIO_ROUTES.home }}
        />
      )}
      {empty && !filtered && view === "plans" && (
        <EmptyState icon={ImageIcon} title={C.plansEmpty.title} description={C.plansEmpty.description} action={{ label: C.plansEmpty.action, href: STUDIO_ROUTES.home }} />
      )}
      {status === "ready" && data && (data.items.length > 0 || pastEnd) && (
        <>
          <p className="text-sm text-muted-foreground">{pastEnd ? C.pastEnd : C.total(data.total)}</p>
          {data.items.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {data.items.map((it) => (
                <CreativeTile key={it.id} item={it} view={view} actions={actions} />
              ))}
            </ul>
          )}
          {(pages > 1 || data.page > 1) && (
            <nav aria-label={C.pagesLabel} className="flex items-center justify-between gap-3">
              <Button type="button" variant="outline" className="h-11" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
                {C.previous}
              </Button>
              <span className="text-sm text-muted-foreground">{C.pageOf(data.page, pages)}</span>
              <Button type="button" variant="outline" className="h-11" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>
                {C.next}
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

/** One line per connected store: running (with progress), up to date, or paused with the api's plain reason. */
export function ImportStatusList({ imports, locale }: { imports: ProductImportStatus[]; locale?: string }) {
  const lines = importLines(imports, locale);
  if (lines.length === 0) return null;
  return (
    <section aria-label={C.imports.heading}>
      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.source} data-import-state={l.state} className="rounded-lg border bg-card p-3 text-sm">
            {l.state === "running" && (
              <div role="status" aria-live="polite" className="space-y-2">
                <p className="flex items-center gap-2">
                  <RefreshCw aria-hidden="true" className="size-4 motion-safe:animate-spin" />
                  {l.text}
                </p>
                <Progress aria-label={C.imports.progressLabel(C.imports.stores[l.source] ?? l.source)} className="h-1.5" />
              </div>
            )}
            {l.state === "stopped" && (
              <div role="alert" className="space-y-1">
                <p className="flex items-center gap-2 font-medium">
                  <Info aria-hidden="true" className="size-4" />
                  {l.text}
                </p>
                <p className="text-muted-foreground">{l.reason}</p>
              </div>
            )}
            {l.state === "done" && <p className="text-muted-foreground">{l.text}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProductTile({ tile, addSlot, onOpen }: { tile: ProductPhotoTile; addSlot?: React.ReactNode; onOpen?: (t: ProductPhotoTile) => void }) {
  const alt = C.photoAlt(tile.title);
  const url = tile.main?.thumbUrl;
  return (
    <li className="min-w-0 overflow-hidden rounded-lg border bg-card" data-product-photos={tile.count}>
      <div className="aspect-square bg-muted">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed Drive link; see MediaImage for why this stays off the optimiser
          <img src={url} alt={alt} loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-6" />
            <span className="text-xs">{tile.count === 0 ? C.noPhotosYet : C.noPhotoPreview}</span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="space-y-0.5">
          <p className="truncate text-sm font-medium">{tile.title}</p>
          <p className="text-xs text-muted-foreground">{tile.count === 0 ? C.noPhotosYet : C.photoCount(tile.count)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tile.count > 0 && onOpen && (
            <Button type="button" variant="outline" className="h-11" aria-label={C.photosOf(tile.title)} onClick={() => onOpen(tile)}>
              {C.seePhotos}
            </Button>
          )}
          {addSlot}
        </div>
      </div>
    </li>
  );
}

/**
 * "Product photos": where each store's import stands, then one tile per product with its photo count and main photo. "Add photo" links a photo that is
 * already in the Library (nothing is uploaded to the store); "See photos" opens the product's photos so one can be set as the main one. The api pages by
 * product, and each tile's count is that product's own exact total.
 */
export function ProductPhotosView({
  status,
  tiles,
  imports,
  hasMore,
  loadingMore,
  onRetry,
  onMore,
  onOpen,
  renderAdd,
  locale,
}: {
  status: IdeasFeedStatus;
  tiles: ProductPhotoTile[];
  imports: ProductImportStatus[];
  hasMore: boolean;
  loadingMore: boolean;
  onRetry: () => void;
  onMore: () => void;
  /** Open a product's photos (a sheet in the container). Left off, the button is not drawn. */
  onOpen?: (t: ProductPhotoTile) => void;
  /** The "Add photo" control of one product (an editor's; a viewer gets none). */
  renderAdd?: (t: ProductPhotoTile) => React.ReactNode;
  locale?: string;
}) {
  const running = imports.some((i) => i.status === "running");
  return (
    <div className="space-y-4">
      {status === "loading" && <Loading />}
      {status === "offline" && <QueryError what={C.error.photos} kind="offline" />}
      {status === "error" && <QueryError what={C.error.photos} onRetry={onRetry} />}
      {status === "ready" && (
        <>
          <ImportStatusList imports={imports} locale={locale} />
          {tiles.length === 0 && !running && (
            <EmptyState icon={ImageIcon} title={C.photosEmpty.title} description={C.photosEmpty.description} action={{ label: C.photosEmpty.action, href: C.uploadHref }} />
          )}
          {tiles.length > 0 && (
            <>
              <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {tiles.map((t) => (
                  <ProductTile key={t.productId} tile={t} onOpen={onOpen} addSlot={renderAdd?.(t)} />
                ))}
              </ul>
              {hasMore && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" className="h-11" disabled={loadingMore} onClick={onMore}>
                    {loadingMore ? C.loadingMore : C.morePhotos}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** One product's photos, main first: where each came from, and "Set as main photo" on the others (an editor's). */
export function ProductPhotoList({
  status,
  data,
  canChange,
  busyId,
  onRetry,
  onSetMain,
}: {
  status: IdeasFeedStatus;
  data?: ProductPhotosOne;
  canChange: boolean;
  /** The photo whose change is in flight. */
  busyId?: string | null;
  onRetry: () => void;
  onSetMain: (mediaId: string) => void;
}) {
  if (status === "loading") {
    return (
      <div aria-busy="true" aria-label={C.photosLoading} className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }
  if (status === "offline") return <QueryError what={C.photosError} kind="offline" />;
  if (status === "error" || !data) return <QueryError what={C.photosError} onRetry={onRetry} />;
  return (
    <ul className="grid grid-cols-2 gap-3">
      {data.photos.map((p, i) => (
        <li key={p.mediaId} data-main={p.isMain} className="overflow-hidden rounded-lg border bg-card">
          <div className="aspect-square bg-muted">
            {p.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a signed Drive link; see MediaImage for why this stays off the optimiser
              <img src={p.thumbUrl} alt={C.photoNAlt(data.title, i + 1, data.photos.length)} loading="lazy" decoding="async" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-muted-foreground">{C.noPhotoPreview}</div>
            )}
          </div>
          <div className="space-y-2 p-3">
            <div className="flex flex-wrap gap-1.5">
              {p.isMain && (
                <Badge variant="secondary" className="gap-1">
                  <Star aria-hidden="true" className="size-3" />
                  {C.mainChip}
                </Badge>
              )}
              <Badge variant="outline">{p.source === "store" ? C.sourceStore : C.sourceLibrary}</Badge>
            </div>
            {canChange && !p.isMain && (
              <Button type="button" variant="outline" className="h-11 w-full" aria-label={C.setMainLabel(data.title, i + 1, data.photos.length)} disabled={busyId === p.mediaId} onClick={() => onSetMain(p.mediaId)}>
                {C.setMain}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
