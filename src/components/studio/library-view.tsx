import Link from "next/link";
import { Image as ImageIcon, ImageOff, Info, RefreshCw } from "lucide-react";
import type { LibraryItem, LibraryPage, LibraryView as LibraryViewKind } from "@/lib/api/creative";
import type { ProductImageItem, ProductImportStatus } from "@/lib/api/media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { QueryError } from "@/components/dashboard/query-error";
import { chipFor, creativeHref, groupProductPhotos, importLines, itemTitle, pageCount } from "@/lib/studio-library";
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

function CreativeTile({ item, view }: { item: LibraryItem; view: LibraryViewKind }) {
  const title = itemTitle(item);
  const format = FORMAT_LABEL[item.format] ?? item.format;
  return (
    <li className="min-w-0">
      <Link
        href={creativeHref(item.id)}
        aria-label={`${C.open}: ${C.itemLabel(title, format)}`}
        className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <p className="text-xs text-muted-foreground">{format}</p>
        </div>
      </Link>
    </li>
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
}) {
  const what = view === "plans" ? C.error.plans : C.error.made;
  const pages = data ? pageCount(data.total, data.pageSize) : 1;
  const empty = status === "ready" && data !== undefined && data.items.length === 0;
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
      {status === "ready" && data && data.items.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">{C.total(data.total)}</p>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.items.map((it) => (
              <CreativeTile key={it.id} item={it} view={view} />
            ))}
          </ul>
          {pages > 1 && (
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

type RenderPrivate = (media: ProductImageItem["media"], alt: string) => React.ReactNode;

function PhotoTile({ item, count, title, renderPrivate }: { item: ProductImageItem; count: number; title: string; renderPrivate?: RenderPrivate }) {
  const alt = C.mainPhotoAlt(title);
  const url = item.media.publicUrl;
  return (
    <li className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <div className="aspect-square bg-muted">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- merchant media stays off the optimiser; see MediaImage
          <img src={url} alt={alt} loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          (renderPrivate?.(item.media, alt) ?? (
            <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageOff aria-hidden="true" className="size-6" />
              <span className="text-xs">{C.noPhotoPreview}</span>
            </div>
          ))
        )}
      </div>
      <div className="space-y-0.5 p-3">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{C.photoCount(count)}</p>
      </div>
    </li>
  );
}

/**
 * "Product photos": where each store's import stands, then one tile per product with its photo count. A store's own photos arrive on their
 * own; "Add photo" opens Drive, where the merchant's own are uploaded.
 */
export function ProductPhotosView({
  status,
  items,
  imports,
  hasMore,
  loadingMore,
  onRetry,
  onMore,
  renderPrivate,
  locale,
}: {
  status: IdeasFeedStatus;
  items: ProductImageItem[];
  imports: ProductImportStatus[];
  hasMore: boolean;
  loadingMore: boolean;
  onRetry: () => void;
  onMore: () => void;
  renderPrivate?: RenderPrivate;
  locale?: string;
}) {
  const groups = groupProductPhotos(items);
  const running = imports.some((i) => i.status === "running");
  return (
    <div className="space-y-4">
      {status === "loading" && <Loading />}
      {status === "offline" && <QueryError what={C.error.photos} kind="offline" />}
      {status === "error" && <QueryError what={C.error.photos} onRetry={onRetry} />}
      {status === "ready" && (
        <>
          <ImportStatusList imports={imports} locale={locale} />
          {groups.length === 0 && !running && (
            <EmptyState icon={ImageIcon} title={C.photosEmpty.title} description={C.photosEmpty.description} action={{ label: C.photosEmpty.action, href: C.uploadHref }} />
          )}
          {groups.length > 0 && (
            <>
              <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {groups.map((g) => (
                  <PhotoTile key={g.key} item={g.main} count={g.count} title={g.title} renderPrivate={renderPrivate} />
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                {hasMore && (
                  <Button type="button" variant="outline" className="h-11" disabled={loadingMore} onClick={onMore}>
                    {loadingMore ? C.loadingMore : C.morePhotos}
                  </Button>
                )}
                <Button asChild variant="outline" className="h-11">
                  <Link href={C.uploadHref}>{C.addPhoto}</Link>
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
