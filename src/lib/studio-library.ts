import type { LibraryItem } from "@/lib/api/creative";
import type { ProductImageItem, ProductImageSource, ProductImportStatus } from "@/lib/api/media";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** Pure helpers for the Library and the memory page (UX spec S14, S15). No React, no fetching: tested directly. */

export interface ProductGroup {
  /** Stable key: the product's own id, else the store's. */
  key: string;
  title: string;
  /** The store's main photo (lowest position) when there is one. */
  main: ProductImageItem;
  count: number;
}

/**
 * One row per product: its title, how many photos, and the main one (position 0, else the lowest position). Photos without a product link
 * group by the store's product id, so none is dropped. Order follows the first photo seen, which is the api's order.
 */
export function groupProductPhotos(items: ProductImageItem[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const it of items) {
    // The store's own product id, always: a photo whose product link arrives later still belongs to the same tile.
    const key = `${it.source}:${it.sourceProductId}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { key, title: it.productTitle?.trim() || STUDIO_COPY.library.photoFallbackTitle, main: it, count: 1 });
      continue;
    }
    g.count += 1;
    // A later photo may carry the title the first one lacked.
    if (g.title === STUDIO_COPY.library.photoFallbackTitle && it.productTitle?.trim()) g.title = it.productTitle.trim();
    if (it.position < g.main.position) g.main = it;
  }
  return [...groups.values()];
}

/** Merge a next page into the pages before it, by photo id, so a retried or overlapping page never shows a photo twice. */
export function mergeProductPages(pages: Array<{ items: ProductImageItem[] }>): ProductImageItem[] {
  const seen = new Set<string>();
  const out: ProductImageItem[] = [];
  for (const p of pages) for (const it of p.items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
  return out;
}

export type ImportLine = { source: ProductImageSource; state: "running" | "done" | "stopped"; text: string; reason?: string };

const storeName = (s: ProductImageSource) => STUDIO_COPY.library.imports.stores[s] ?? s;

/**
 * What to say about each connected store's import. A stopped import carries the api's plain reason; if the api sent none, a plain fallback,
 * never a blank. A time that cannot be read is left out rather than shown as "Invalid Date".
 */
export function importLines(imports: ProductImportStatus[], locale?: string): ImportLine[] {
  const C = STUDIO_COPY.library.imports;
  return imports.map((i) => {
    const store = storeName(i.source);
    if (i.status === "running") return { source: i.source, state: "running", text: C.running(store) };
    if (i.status === "stopped") return { source: i.source, state: "stopped", text: C.stopped(store), reason: i.stoppedReason?.trim() || C.stoppedFallback };
    const t = i.lastRunAt ? Date.parse(i.lastRunAt) : NaN;
    const when = Number.isNaN(t) ? null : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(t));
    return { source: i.source, state: "done", text: C.done(store, when) };
  });
}

/** The state chip on a creative in the Library. Only what the list can truthfully say: a final, or an archived one. */
export function chipFor(item: Pick<LibraryItem, "status">, view: "made" | "plans"): string {
  const c = STUDIO_COPY.library.chips;
  if (view === "plans") return c.plan;
  return item.status === "archived" ? c.archived : c.final;
}

export const itemTitle = (item: Pick<LibraryItem, "headline">): string => item.headline?.trim() || STUDIO_COPY.library.untitled;

/** Where a Library item opens: the creative's page. */
export const creativeHref = (id: string): string => `/dashboard/studio/c/${encodeURIComponent(id)}`;

export const pageCount = (total: number, pageSize: number): number => Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
