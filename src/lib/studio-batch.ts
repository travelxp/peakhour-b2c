import type { BatchPreview, BatchView } from "@/lib/api/creative-studio";

/** Pure helpers for the batch grid (UX spec S16). No React, no fetching: tested directly. */

/** 24 cards a page, then "Show more": light enough without a virtual list (spec decision U-grid). */
export const BATCH_PAGE_SIZE = 24;

/** No "Rejected" filter: the api drops a skipped preview from the batch read, so there is nothing to list. */
export type BatchFilter = "all" | "waiting" | "approved" | "changed";
export const BATCH_FILTERS: BatchFilter[] = ["all", "waiting", "approved", "changed"];

/** A tile the grid can act on: it has come through and is not being made final or already final. */
export const isGridActionable = (p: BatchPreview): boolean => p.state === "ready" || p.state === "shortlisted";

/** One tile per preview that came through. A failed or rendering one has nothing to approve. */
export const gridTiles = (b: BatchView): BatchPreview[] => b.previews.filter((p) => p.state !== "failed" && p.state !== "rendering");

export function filterTiles(tiles: BatchPreview[], f: BatchFilter): BatchPreview[] {
  switch (f) {
    case "approved":
      return tiles.filter((p) => p.liked);
    case "changed":
      return tiles.filter((p) => p.lapsed);
    case "waiting":
      return tiles.filter((p) => isGridActionable(p) && !p.liked && !p.lapsed);
    default:
      return tiles;
  }
}

export function filterCounts(tiles: BatchPreview[]): Record<BatchFilter, number> {
  return Object.fromEntries(BATCH_FILTERS.map((f) => [f, filterTiles(tiles, f).length])) as Record<BatchFilter, number>;
}

/** The ids a bulk action reaches: selected AND actionable, in grid order. */
export function actionableSelection(tiles: BatchPreview[], selected: ReadonlySet<string>): string[] {
  return tiles.filter((p) => selected.has(p.id) && isGridActionable(p)).map((p) => p.id);
}

/** Selected ids that are still on this page: a tile that left (skipped, remade) drops out of the count. */
export function liveSelection(tiles: BatchPreview[], selected: ReadonlySet<string>): Set<string> {
  const ids = new Set(tiles.map((p) => p.id));
  return new Set([...selected].filter((id) => ids.has(id)));
}

export function toggleSelected(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Select all on the visible page, or clear them when they are all selected already. */
export function toggleAll(visible: BatchPreview[], selected: ReadonlySet<string>): Set<string> {
  const ids = visible.filter(isGridActionable).map((p) => p.id);
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  const next = new Set(selected);
  for (const id of ids) {
    if (all) next.delete(id);
    else next.add(id);
  }
  return next;
}

/** The hearted ones that can be made final: liked, not lapsed, not already being made. */
export const approvedForFinal = (tiles: BatchPreview[]): BatchPreview[] => tiles.filter((p) => p.liked && p.state === "shortlisted");

export type GridKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/** Where an arrow key moves the focus: along a row, or a row up or down (`columns` tiles to a row). Stays put at the edges. */
export function moveFocus(index: number, key: GridKey, columns: number, count: number): number {
  if (count <= 0) return 0;
  const next = key === "ArrowLeft" ? index - 1 : key === "ArrowRight" ? index + 1 : key === "ArrowUp" ? index - columns : index + columns;
  return next < 0 || next >= count ? index : next;
}

export type ShortcutAction = "approve" | "reject" | "undo" | "select" | "help" | null;

/** The grid's keyboard shortcuts (spec S16). Ignores a key typed with a modifier, so the browser's own shortcuts still work. */
export function shortcutFor(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): ShortcutAction {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case "a":
    case "A":
      return "approve";
    case "x":
    case "X":
      return "reject";
    case "z":
    case "Z":
      return "undo";
    case " ":
      return "select";
    case "?":
      return "help";
    default:
      return null;
  }
}

/** The undo of the last bulk change: approve is undone by clearing the same previews, and a clear by approving them again. A skip cannot be undone from here. */
export function undoOf(op: "approve" | "reject" | "clear"): "clear" | "approve" | null {
  return op === "approve" ? "clear" : op === "clear" ? "approve" : null;
}
