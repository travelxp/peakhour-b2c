import type { ChannelFitEntry, CleanupGroup, CleanupKind, FileVersion, MediaItem, MediaKind, ReplaceItem, ReplaceResult, UsedInEntry } from "@/lib/api/media";
import { formatBytes } from "@/lib/api/media";

/**
 * The words and small decisions of the Drive page, in one place and free of React, so a test can read exactly what a person would.
 * Plain English. The merchant-facing name is Drive. Cleanup is "Smart Cleanup" and no button of it says "delete".
 */

/** A file still waiting to be named shows the shimmer only for this long after it was added: past it the describer has given up or is
 *  behind, and a tile must not shimmer for ever (nor the page poll for ever). */
export const SHIMMER_WINDOW_MS = 15 * 60_000;

/** The sentence under a tile while Peakhour is working on it. By what the file is: never "AI processing" or "analysing". */
export const DESCRIBING_LINE: Record<MediaKind, string> = {
  image: "Studying your image…",
  video: "Watching your video…",
  document: "Reading your document…",
  font: "Reading your file…",
};

/** Whether the describer is still to name this file, and the page should shimmer it and keep asking. */
export function isBeingDescribed(item: Pick<MediaItem, "describeState" | "createdAt">, now: Date): boolean {
  if (item.describeState !== "pending" && item.describeState !== "describing") return false;
  return now.getTime() - new Date(item.createdAt).getTime() <= SHIMMER_WINDOW_MS;
}

export function placesText(n: number): string {
  return `Used in ${n} ${n === 1 ? "place" : "places"}`;
}

/** The line under a tile's name. */
export function tileLine(item: MediaItem, now: Date): string {
  if (isBeingDescribed(item, now)) return DESCRIBING_LINE[item.kind];
  return item.usedInCount > 0 ? placesText(item.usedInCount) : "Not used yet";
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const MIME_SHORT: Record<string, string> = {
  "application/pdf": "PDF",
  "text/plain": "Text",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.ms-powerpoint": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
};

/** The badge on a tile: "Image", "Video 0:24", "PDF, private". */
export function badgeText(item: Pick<MediaItem, "kind" | "mimeType" | "durationSeconds" | "visibility">): string {
  const priv = item.visibility === "private" ? ", private" : "";
  if (item.kind === "video") return `Video${item.durationSeconds ? ` ${formatDuration(item.durationSeconds)}` : ""}${priv}`;
  if (item.kind === "document") return `${MIME_SHORT[item.mimeType] ?? "Document"}${priv}`;
  if (item.kind === "font") return `Font${priv}`;
  return `Image${priv}`;
}

/** Published (a public address) or Private (a link that expires), said plainly: the word, then what it means. */
export function visibilityName(v: MediaItem["visibility"]): string {
  return v === "private" ? "Private" : "Published";
}
export function visibilityNote(v: MediaItem["visibility"]): string {
  return v === "private" ? "Opens only with a link that expires." : "Anyone with the address can open it.";
}

export function metaLine(item: MediaItem): string {
  const parts = [formatBytes(item.sizeBytes)];
  if (item.width && item.height) parts.push(`${item.width} × ${item.height}`);
  if (item.uploadedBy?.userName) parts.push(`Added by ${item.uploadedBy.userName}`);
  else if (item.source === "ai_generated") parts.push("Made by Peakhour");
  return parts.join(". ");
}

const USED_KIND_LABEL: Record<string, string> = {
  idea: "Content idea",
  draft: "Draft",
  ad_creative: "Ad",
  scheduled_item: "Scheduled post",
  social_post: "Post",
  page: "Page",
  brand: "Brand Kit",
  listing: "Google listing",
};

/** What a "Used in" line says. A kind this page does not know yet (the api is ahead of it) reads "Somewhere in Peakhour", never "undefined". */
export function usedInLabel(e: UsedInEntry): string {
  // The api collapses every live share link of a file into one entry: "Share links (5)", or "Share link" for one.
  if (e.kind === "share") return e.count !== undefined && e.count > 1 ? `Share links (${e.count})` : "Share link";
  const base = USED_KIND_LABEL[e.kind] ?? "Somewhere in Peakhour";
  const where = e.label ? `${base}: ${e.label}` : base;
  return e.published ? `${where}, live` : where;
}

/**
 * Where a "Used in" line goes, or null when it goes nowhere. A kind with no page of its own goes to the screen that lists them. A share link
 * is plain text: the panel below already lists the links, and a link to this same page would only reload it. An unknown kind is plain text too.
 */
export function usedInHref(e: UsedInEntry): string | null {
  switch (e.kind) {
    case "page":
      return `/dashboard/pages/${e.refId}`;
    case "idea":
      return `/dashboard/strategist/${e.refId}`;
    case "ad_creative":
      return "/dashboard/ads";
    case "scheduled_item":
    case "social_post":
      return "/dashboard/calendar";
    case "draft":
      return "/dashboard/content";
    case "brand":
      return "/dashboard/drive?tab=brand";
    case "listing":
      return "/dashboard/presence";
    default:
      return null;
  }
}

const TRASH_FAILED = "That file could not be moved to Trash. Try again.";

/** Why one file did not go to Trash. A 409 carries the api's reason (a share link, ad, post or page still holds it): show it, because "Try again" cannot fix it. */
export function trashFailureText(err: unknown): string {
  const e = err as { status?: number; message?: string } | null;
  return e && e.status === 409 && e.message ? e.message : TRASH_FAILED;
}

/** The sentence for files a bulk move left because something still holds them; empty when none were. */
export function blockedText(n: number): string {
  if (n <= 0) return "";
  return ` ${n} ${n === 1 ? "file was" : "files were"} left because ${n === 1 ? "it is" : "they are"} still in use by a share link, ad, post or page. Take ${n === 1 ? "it" : "them"} out of use, or revoke the share link, then try again.`;
}

const CHANNEL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  threads: "Threads",
  newsletter: "Newsletter",
  googlebusiness: "Google Business",
  wordpress: "WordPress",
  shopify: "Shopify",
  tiktok: "TikTok",
  youtube: "YouTube",
  google: "Google ads",
  meta: "Meta ads",
  pinterest: "Pinterest",
  reddit: "Reddit",
};

export function channelLabel(key: string): string {
  return CHANNEL_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** "Fits": the channels the file suits, best first. "Poor" fits are named apart, so the panel says what to avoid plainly. */
export function fitsOf(fit: ChannelFitEntry[] | undefined): { good: string[]; possible: string[]; poor: Array<{ label: string; reason?: string }> } {
  const list = fit ?? [];
  return {
    good: list.filter((f) => f.fit === "good").map((f) => channelLabel(f.channel)),
    possible: list.filter((f) => f.fit === "possible").map((f) => channelLabel(f.channel)),
    poor: list.filter((f) => f.fit === "poor").map((f) => ({ label: channelLabel(f.channel), reason: f.reason })),
  };
}

export const KIND_CHIPS: Array<{ id: "all" | MediaKind | "live"; label: string }> = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "document", label: "Documents" },
  { id: "live", label: "Live in ads" },
];

const DAY_MS = 86_400_000;

/** Whole days until a trashed file is removed for good, never below 0. */
export function daysLeft(hardDeleteAfter: string | undefined, now: Date): number | null {
  if (!hardDeleteAfter) return null;
  return Math.max(0, Math.ceil((new Date(hardDeleteAfter).getTime() - now.getTime()) / DAY_MS));
}

export function daysLeftText(n: number | null): string {
  if (n === null) return "";
  if (n === 0) return "Removed for good today";
  return `${n} ${n === 1 ? "day" : "days"} left`;
}

export function gbText(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** The copy of a Smart Cleanup group. `count` is the whole group's size. */
export function cleanupCopy(kind: CleanupKind, count: number): { title: string; why: string } {
  const n = (word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  switch (kind) {
    case "duplicate_content_hash":
      return { title: "Exact duplicates", why: `${n("file")} ${count === 1 ? "is a copy" : "are copies"} of another. We keep the newest one.` };
    case "orphan_generated":
      return { title: "AI drafts never used", why: `${n("image")} Peakhour made that nobody picked.` };
    case "unused_90d":
      return { title: "Unused for 90 days", why: `${n("file")} with no use anywhere for three months.` };
    case "large_5mb_plus":
      return { title: "Large files worth shrinking", why: `${n("file")} over 5 MB that could be much smaller. Nothing is removed for this.` };
  }
}

/** What Smart Cleanup can move to the Trash: the groups that are not advice only, with the files and bytes they hold. */
export function cleanupTotals(groups: CleanupGroup[], chosen: ReadonlySet<CleanupKind>): { count: number; bytes: number } {
  return groups
    .filter((g) => g.trashable && chosen.has(g.kind))
    .reduce((t, g) => ({ count: t.count + g.count, bytes: t.bytes + g.reclaimableBytes }), { count: 0, bytes: 0 });
}

// ── Replace everywhere, version history and Save to Drive (D8) ──────────────────────────────

const PLACE_NOUN: Record<string, [string, string]> = {
  idea: ["content idea", "content ideas"],
  draft: ["draft", "drafts"],
  ad_creative: ["ad", "ads"],
  scheduled_item: ["scheduled post", "scheduled posts"],
  social_post: ["post", "posts"],
  page: ["page", "pages"],
  brand: ["Brand Kit setting", "Brand Kit settings"],
  listing: ["Google listing", "Google listings"],
  share: ["share link", "share links"],
};

/** "2 drafts, 1 scheduled post": the places in a list, counted by what they are. A kind this page does not know yet reads "other places". */
export function placesSummary(items: Pick<ReplaceItem, "kind">[]): string {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.kind, (counts.get(it.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([kind, n]) => {
      const noun = PLACE_NOUN[kind];
      return noun ? `${n} ${n === 1 ? noun[0] : noun[1]}` : `${n} other ${n === 1 ? "place" : "places"}`;
    })
    .join(", ");
}

/** One line of the confirm dialog: what an item is, by name when it has one. */
export function placeLine(it: ReplaceItem): string {
  const noun = PLACE_NOUN[it.kind]?.[0] ?? "place";
  const base = it.label ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)}: ${it.label}` : `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
  return it.reason ? `${base}. ${it.reason}.` : base;
}

/** The sentence over the two lists, before the person confirms. */
export function replaceIntro(willChange: ReplaceItem[], stays: ReplaceItem[]): string {
  if (willChange.length === 0 && stays.length === 0) return "Nothing uses this file yet, so only the file itself changes. The old one stays in its version history for 30 days.";
  const change = willChange.length > 0 ? `${placesSummary(willChange)} will use the new file.` : "Nothing will change anywhere it is used.";
  const stay = stays.length > 0 ? ` ${placesSummary(stays)} already went out, or are being sent, and stay exactly as they were.` : "";
  return `${change}${stay}`;
}

/** What the result of a replace says. `notChanged` is never hidden, and says what to do about it. */
export function replaceOutcome(r: Pick<ReplaceResult, "changed" | "staysAsSent" | "notChanged">): { headline: string; failed: boolean } {
  if (r.notChanged.length > 0) {
    return { headline: `The file was replaced, but ${placesSummary(r.notChanged)} could not be changed. They still show the old file. Try again to finish.`, failed: true };
  }
  const moved = r.changed.length > 0 ? `${placesSummary(r.changed)} now use the new file.` : "The new file is in place.";
  return { headline: `${moved} The old file is in version history for 30 days.`, failed: false };
}

const REPLACE_FAILED = "The file could not be replaced. Nothing that was already published changed. Try again.";

/** Why a replace stopped. The api's own sentence is shown when it has one (a kind or visibility mismatch cannot be fixed by trying again). */
export function replaceFailureText(err: unknown): string {
  const e = err as { status?: number; message?: string } | null;
  if (e && (e.status === 409 || e.status === 403 || e.status === 402) && e.message) return e.message;
  return REPLACE_FAILED;
}

/** The line under a version: when it was replaced, and how long it is kept. */
export function versionLine(v: FileVersion, now: Date): string {
  const parts = [formatBytes(v.sizeBytes)];
  if (v.replacedAt) {
    const days = Math.floor((now.getTime() - new Date(v.replacedAt).getTime()) / DAY_MS);
    parts.push(days <= 0 ? "Replaced today" : `Replaced ${days} ${days === 1 ? "day" : "days"} ago`);
  }
  const left = daysLeftText(daysLeft(v.hardDeleteAfter, now));
  if (left) parts.push(left);
  return parts.join(". ");
}

/** What the toast says after Save to Drive. An Inbox file is Private and the person is told so. */
export function savedText(r: { name: string; visibility: "published" | "private"; deduped: boolean; alreadyInDrive: boolean }): string {
  if (r.alreadyInDrive) return `"${r.name}" is already in Drive.`;
  if (r.deduped) return `Drive already had this exact file, as "${r.name}".`;
  return r.visibility === "private" ? `Saved to Drive as "${r.name}". It is Private: it opens only with a link that expires.` : `Saved to Drive as "${r.name}".`;
}

export function saveFailureText(err: unknown): string {
  const e = err as { status?: number; message?: string } | null;
  if (e && e.message && [402, 404, 415, 422, 503].includes(e.status ?? 0)) return e.message;
  return "That could not be saved to Drive. Try again.";
}
