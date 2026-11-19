import type { BulkResult, LibraryFilter, LibraryItem } from "@/lib/api/creative";
import type { ProductImageSource, ProductImportStatus } from "@/lib/api/media";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** Pure helpers for the Library and the memory page (UX spec S14, S15). No React, no fetching: tested directly. */

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

/**
 * The state chip on a creative in the Library. What the list can truthfully say: a saved plan, an archived one, or (from the handoff records) scheduled or
 * posted; anything else with a final is plain "Final".
 */
export function chipFor(item: Pick<LibraryItem, "status"> & Partial<Pick<LibraryItem, "publish">>, view: "made" | "plans"): string {
  const c = STUDIO_COPY.library.chips;
  if (view === "plans") return c.plan;
  if (item.status === "archived") return c.archived;
  if (item.publish?.state === "scheduled") return c.scheduled;
  if (item.publish?.state === "posted") return c.posted;
  return c.final;
}

/** The channels of a creative's sent sizes, as words ("Instagram, LinkedIn"), for the line under its title. Empty when it was not sent anywhere. */
export function sentTo(item: Pick<LibraryItem, "publish">): string {
  const names = STUDIO_COPY.library.channels;
  return item.publish.channels.map((c) => names[c] ?? c).join(", ");
}

/** The filter values the api takes, from what the form holds: an empty one is left out, and a date is sent as the start of that day (UTC). */
export function filterQuery(f: { publish: string; channel: string; from: string; to: string }): LibraryFilter {
  const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00.000Z`).toISOString() : undefined);
  const publish = f.publish === "none" || f.publish === "scheduled" || f.publish === "posted" ? f.publish : undefined;
  const to = f.to ? day(f.to) : undefined;
  return {
    ...(publish ? { publish } : {}),
    ...(f.channel ? { channel: f.channel } : {}),
    ...(f.from && day(f.from) ? { from: day(f.from)! } : {}),
    // "until" a day includes that day: the api's end is exclusive, so it is the start of the next one.
    ...(to ? { to: new Date(Date.parse(to) + 86_400_000).toISOString() } : {}),
  };
}

const size = (w: number | null | undefined, h: number | null | undefined) => (w && h ? `${w} x ${h}` : null);

export interface DownloadChoice {
  key: string;
  label: string;
  query: { finalId?: string; versionId?: string };
}

/** What can be saved from a creative: its full-size picture, then each platform size that is made. */
export function downloadChoices(item: Pick<LibraryItem, "master" | "versions">): DownloadChoice[] {
  const A = STUDIO_COPY.library.actions;
  const names = STUDIO_COPY.library.channels;
  const out: DownloadChoice[] = [];
  if (item.master) out.push({ key: "master", label: A.downloadMaster(size(item.master.width, item.master.height)), query: { finalId: item.master.finalId } });
  for (const v of item.versions) out.push({ key: v.id, label: A.downloadSize(v.label, names[v.channel] ?? v.channel, `${v.width} x ${v.height}`), query: { versionId: v.id } });
  return out;
}

/** What to tell the merchant after a bulk change: what was done and, plainly, how many were left as they were. */
export const bulkSummary = (r: Pick<BulkResult, "done" | "skipped">): string => STUDIO_COPY.library.bulk.result(r.done.length, r.skipped.length);

export const itemTitle = (item: Pick<LibraryItem, "headline">): string => item.headline?.trim() || STUDIO_COPY.library.untitled;

/** Where a Library item opens: the creative's page. */
export const creativeHref = (id: string): string => `/dashboard/studio/c/${encodeURIComponent(id)}`;

export const pageCount = (total: number, pageSize: number): number => Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
