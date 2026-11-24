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
export function chipFor(item: Pick<LibraryItem, "status"> & Partial<Pick<LibraryItem, "publish" | "kind">>, view: "made" | "plans"): string {
  const c = STUDIO_COPY.library.chips;
  if (view === "plans") return c.plan;
  if (item.status === "archived") return c.archived;
  if (item.publish?.state === "scheduled") return c.scheduled;
  if (item.publish?.state === "posted") return c.posted;
  // words are never a "final" (there is no picture to make final): approved is where they stand until they are sent
  return item.kind === "words" ? c.words : c.final;
}

/** The line under a tile's title: a picture's shape, or for words what is in the set (options and how many are approved) and the platform they were written for. */
export function subLine(item: Pick<LibraryItem, "kind" | "format" | "words">, formatLabel: string, platformName: (key: string) => string): string {
  if (item.kind !== "words") return formatLabel;
  const C = STUDIO_COPY.library;
  const count = item.words ? C.wordsCount(item.words.options, item.words.approved) : C.wordsKind;
  return item.words?.platform ? `${count}. ${C.wordsForPlatform(platformName(item.words.platform))}` : count;
}

/** The channels of a creative's sent sizes, as words ("Instagram, LinkedIn"), for the line under its title. Empty when it was not sent anywhere. */
export function sentTo(item: Pick<LibraryItem, "publish">): string {
  const names = STUDIO_COPY.library.channels;
  return item.publish.channels.map((c) => names[c] ?? c).join(", ");
}

/**
 * The filter values the api takes, from what the form holds: an empty one is left out, and a date is the start of that day in the time zone of the screen the
 * merchant is looking at (sent as a full time the api reads exactly). "Until" a day includes that day: the api's end is exclusive, so it is the start of the next one.
 */
export function filterQuery(f: { publish: string; channel: string; from: string; to: string }): LibraryFilter {
  const day = (v: string, add = 0): string | undefined => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return undefined;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + add);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  };
  const publish = f.publish === "none" || f.publish === "scheduled" || f.publish === "posted" ? f.publish : undefined;
  const from = day(f.from);
  const to = day(f.to, 1);
  return { ...(publish ? { publish } : {}), ...(f.channel ? { channel: f.channel } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) };
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

/**
 * What to tell the merchant after a bulk change: what was done, how many were left as they were, and why, in the api's own plain words (each distinct
 * reason once, at most two, so the toast stays short).
 */
export function bulkSummary(r: Pick<BulkResult, "done" | "skipped">): string {
  const base = STUDIO_COPY.library.bulk.result(r.done.length, r.skipped.length);
  const reasons = [...new Set(r.skipped.map((s) => s.message.trim()).filter(Boolean))].slice(0, 2);
  return reasons.length ? `${base} ${reasons.join(" ")}` : base;
}

export const itemTitle = (item: Pick<LibraryItem, "headline">): string => item.headline?.trim() || STUDIO_COPY.library.untitled;

/** Where a Library item opens: the creative's page. */
export const creativeHref = (id: string): string => `/dashboard/studio/c/${encodeURIComponent(id)}`;

export const pageCount = (total: number, pageSize: number): number => Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
