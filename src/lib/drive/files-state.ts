import type { DescribeStateRow, ListMediaParams, MediaItem, MediaKind } from "@/lib/api/media";
import { isBeingDescribed } from "./copy";

/**
 * The Files view's small decisions, free of React: what the person may change, which request a set of filters is, and how an answer from
 * the describing poll lands on the files already on screen.
 */

const LEVEL: Record<string, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

/** What a signed-in role may do in Drive. The api enforces the same rules (editor+ changes the business's own files, admin+ the shared ones). */
export function driveAbilities(role: string | undefined): { canEdit: boolean; isAdmin: boolean } {
  const level = LEVEL[role ?? ""] ?? 0;
  return { canEdit: level >= LEVEL.editor!, isAdmin: level >= LEVEL.admin! };
}

/** May this person change this file? A file shared across the organisation takes an admin. */
export function canChangeFile(item: Pick<MediaItem, "shared">, abilities: { canEdit: boolean; isAdmin: boolean }): boolean {
  return item.shared ? abilities.isAdmin : abilities.canEdit;
}

export interface FilesFilters {
  q: string;
  kind: "all" | MediaKind | "live";
  channel: string;
  used: "any" | "used" | "unused";
  source: "any" | "ai_generated" | "uploaded";
  visibility: "any" | "published" | "private";
  collectionId: string | null;
  /** The id of the "Used in live ads" smart collection, once it exists. */
  liveCollectionId: string | null;
  sort: NonNullable<ListMediaParams["sort"]>;
}

export const NO_FILTERS: FilesFilters = {
  q: "",
  kind: "all",
  channel: "",
  used: "any",
  source: "any",
  visibility: "any",
  collectionId: null,
  liveCollectionId: null,
  sort: "newest",
};

/** The list request for a set of filters. Blank and "any" are left off, so the api sees only what the person chose. */
export function toListParams(f: FilesFilters, page: number, limit = 40): ListMediaParams {
  const live = f.kind === "live";
  return {
    status: "active",
    page,
    limit,
    sort: f.sort,
    ...(f.q.trim() ? { q: f.q.trim() } : {}),
    ...(f.kind !== "all" && !live ? { kind: f.kind as MediaKind } : {}),
    ...(f.channel ? { channel: f.channel } : {}),
    ...(f.used !== "any" ? { used: f.used } : {}),
    ...(f.source !== "any" ? { source: f.source } : {}),
    ...(f.visibility !== "any" ? { visibility: f.visibility } : {}),
    // "Live in ads" is the smart collection of that name; a chosen collection wins over it.
    ...(f.collectionId ? { collectionId: f.collectionId } : live && f.liveCollectionId ? { collectionId: f.liveCollectionId } : {}),
  };
}

/** True when any filter narrows the list (the empty state then says "Nothing matches that" rather than "No files yet"). */
export function isFiltered(f: FilesFilters): boolean {
  return JSON.stringify({ ...f, q: f.q.trim(), sort: "newest", liveCollectionId: null }) !== JSON.stringify({ ...NO_FILTERS });
}

export interface FilesPage {
  items: MediaItem[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}
export interface FilesData {
  pages: FilesPage[];
  pageParams: unknown[];
}

/** Fold the describing poll's rows into the pages on screen: a file's name, description, tags and fit swap in; nothing else moves. */
export function applyDescribeRows(data: FilesData | undefined, rows: DescribeStateRow[]): FilesData | undefined {
  if (!data || rows.length === 0) return data;
  const byId = new Map(rows.map((r) => [r.id, r]));
  let changed = false;
  const pages = data.pages.map((p) => ({
    ...p,
    items: p.items.map((it) => {
      const r = byId.get(it.id);
      if (!r) return it;
      const same =
        it.describeState === r.describeState && it.name === r.name && it.description === r.description && it.altText === r.altText && JSON.stringify(it.tags) === JSON.stringify(r.tags) && JSON.stringify(it.channelFit) === JSON.stringify(r.channelFit);
      if (same) return it;
      changed = true;
      return {
        ...it,
        describeState: r.describeState,
        name: r.name,
        description: r.description,
        altText: r.altText,
        tags: r.tags,
        useCases: r.useCases,
        channelFit: r.channelFit,
        describedAt: r.describedAt,
      };
    }),
  }));
  return changed ? { ...data, pages } : data;
}

/** The ids the page is waiting on: the files on screen that Peakhour is still naming. Empty means the poll sleeps. */
export function waitingIds(items: MediaItem[], now: Date): string[] {
  return items.filter((i) => isBeingDescribed(i, now)).map((i) => i.id);
}
