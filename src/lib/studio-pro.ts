import { ApiError } from "@/lib/api";
import type { ApprovalLink, HistoryItem } from "@/lib/api/creative-studio";
import { studioRefusal } from "@/lib/studio-flow";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** Pure helpers for version history (S17) and approval links (S18). No React, no fetching: tested directly. */

export interface HistoryGroup {
  previewId: string;
  /** The preview's place among the previews of the creative, from 1. */
  number: number;
  headline: string;
  /** Newest first: the current look, then each earlier one. */
  items: HistoryItem[];
}

/**
 * The api lists looks per preview, oldest first, the current look last. The page shows each preview's own timeline, newest first, in the order the previews are shown.
 * A preview with only its first look has nothing to go back to and is left out.
 */
export function groupHistory(items: HistoryItem[], previews: Array<{ id: string; headline: string | null }>): HistoryGroup[] {
  const order = new Map(previews.map((p, i) => [p.id, i]));
  const byPreview = new Map<string, HistoryItem[]>();
  for (const it of items) byPreview.set(it.previewId, [...(byPreview.get(it.previewId) ?? []), it]);
  return [...byPreview.entries()]
    // A preview that is not on the page (skipped, removed, still being made) has no place to go back to: it is left out, not numbered as Preview 1.
    .filter(([previewId, list]) => order.has(previewId) && list.some((i) => i.restorable))
    .map(([previewId, list]) => ({
      previewId,
      number: order.get(previewId)! + 1,
      headline: previews.find((p) => p.id === previewId)?.headline ?? "",
      items: [...list].sort((a, b) => Number(b.current) - Number(a.current) || b.version - a.version),
    }))
    .sort((a, b) => (order.get(a.previewId) ?? 0) - (order.get(b.previewId) ?? 0));
}

/** What a failed restore says. The api's own words for "no longer kept" and a lost race are used; anything else is the shared refusal. */
export function restoreMessage(error: unknown): string {
  const H = STUDIO_COPY.history;
  if (error instanceof ApiError) {
    if (error.code === "VERSION_GONE") return H.gone;
    if (error.code === "VERSION_CONFLICT") return H.conflict;
  }
  const r = studioRefusal(error).text;
  return r === STUDIO_COPY.refusal.wentWrong ? H.failed : r;
}

/** A link still works: waiting for an answer. Answered, stopped and ran-out links stay in the list as the record. */
export const isLinkLive = (l: ApprovalLink): boolean => l.state === "waiting";

/** The newest live link for a preview, so the sheet can say "a link is out for this one". */
export function liveLinkFor(links: ApprovalLink[], previewId: string): ApprovalLink | undefined {
  return links.find((l) => l.previewId === previewId && isLinkLive(l));
}
