/**
 * The listing photos panel (PE-11): what to draw, what each state says, and what a person may press. PURE - no React, no fetch.
 *
 * ★THE PANEL IS DRAWN FROM THE NETWORK'S DECLARATION. A network that does not declare photos draws no panel (`drawsPhotos`); the categories,
 * the limits and whether a removal can be brought back all arrive from `GET /v1/presence/media`, and the network's name in every sentence is
 * the adapter's label. Nothing in this file spells a network.
 * ★A CUSTOMER'S PHOTO HAS NO DELETE CONTROL. The api marks each item `removable`; the panel draws a control only where it is true.
 * ★NOTHING GOES PUBLIC UNSAID. A photo change's card carries the api's notes (the private link's life, that the photo becomes visible on the
 * listing); the panel puts them above the Approve button and never hides them.
 */

import type { PresenceCapabilities } from "@/lib/presence-panels";
import type { DriveFile } from "@/lib/drive/files";
import type { ChangeCardData, CapabilitiesResponse } from "@/lib/presence-edit";

// ── Shapes the api returns ───────────────────────────────────────────────────

export interface PhotoLimits {
  formats: string[];
  formatsLabel: string;
  minBytes?: number;
  maxBytes?: number;
  minPixels?: number;
  recommendedPixels?: number;
  maxItems?: number;
  source: string;
}

export interface NetworkPhoto {
  ref: string;
  category: string | null;
  format: "photo" | "video" | "other";
  source: "owner" | "customer";
  url: string | null;
  thumbnailUrl: string | null;
  createdAt: string | null;
  attribution: { name?: string; profileUrl?: string; reportUrl?: string } | null;
  /** False for a customer's photo: there is no delete control for it. */
  removable: boolean;
  notRemovableBecause: string | null;
  /** The Drive file this photo came from, when Peakhour sent it. */
  driveMediaId: string | null;
}

/** `GET /v1/presence/media`. */
export interface PhotosResponse {
  network: string;
  label: string;
  declaration: { categories: string[]; limits: PhotoLimits; removal: { restorable: boolean } };
  writes: { released: boolean; notice: string | null };
  /** False when the network still had photos that were not read: no absence is believed from the list. */
  complete: boolean;
  items: NetworkPhoto[];
  held: number;
}

// ── Which networks draw the panel ────────────────────────────────────────────

/** Only a network that DECLARES photos draws the panel. With no declaration to go by (an older api) it is not drawn: photos are new. */
export function drawsPhotos(entry: { capabilities?: Pick<PresenceCapabilities, "media"> | undefined } | null | undefined): boolean {
  return entry?.capabilities?.media === true;
}

// ── Words ────────────────────────────────────────────────────────────────────

/** A category as a person reads it: `FOOD_AND_DRINK` is "Food and drink". Any network's list, with no table to keep in step. */
export function categoryLabel(category: string): string {
  const words = category.toLowerCase().split(/[_\s]+/).filter(Boolean);
  const text = words.join(" ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : category;
}

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${+(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

/** What the network accepts, as one sentence, from its declaration. A limit it does not state is not mentioned. */
export function limitsSentence(l: PhotoLimits, label: string): string {
  const parts = [l.formatsLabel];
  if (l.minBytes !== undefined && l.maxBytes !== undefined) parts.push(`${kb(l.minBytes)} to ${kb(l.maxBytes)}`);
  else if (l.maxBytes !== undefined) parts.push(`up to ${kb(l.maxBytes)}`);
  if (l.minPixels !== undefined) parts.push(`at least ${l.minPixels} x ${l.minPixels} pixels${l.recommendedPixels ? ` (${l.recommendedPixels} x ${l.recommendedPixels} is better)` : ""}`);
  if (l.maxItems !== undefined) parts.push(`up to ${l.maxItems} photos`);
  return `${label} takes photos that are ${parts.join(", ")}.`;
}

/** Plain words for why a file cannot be picked, mirroring the api's check so nobody picks what will be refused. The api checks again. Null: usable. */
export function unusableReason(file: Pick<DriveFile, "mimeType" | "sizeBytes" | "width" | "height">, l: PhotoLimits): string | null {
  if (!l.formats.includes(file.mimeType)) return `Not a ${l.formatsLabel} file`;
  if (l.minBytes !== undefined && file.sizeBytes < l.minBytes) return `Under ${kb(l.minBytes)}`;
  if (l.maxBytes !== undefined && file.sizeBytes > l.maxBytes) return `Over ${kb(l.maxBytes)}`;
  if (l.minPixels !== undefined && file.width !== undefined && file.height !== undefined && (file.width < l.minPixels || file.height < l.minPixels)) {
    return `Under ${l.minPixels} x ${l.minPixels} pixels`;
  }
  return null;
}

// ── What the panel shows ─────────────────────────────────────────────────────

export type PhotosView =
  | { kind: "loading" }
  | { kind: "paused" }
  | { kind: "failed" }
  | { kind: "ready"; stale: boolean; empty: boolean };

/** `isLoading` misses a paused query, so this reads `fetchStatus` through the shared `fetchView` states. */
export function photosView(v: "loading" | "paused" | "failed" | "data" | "data_stale", itemCount: number): PhotosView {
  if (v === "loading") return { kind: "loading" };
  if (v === "paused") return { kind: "paused" };
  if (v === "failed") return { kind: "failed" };
  return { kind: "ready", stale: v === "data_stale", empty: itemCount === 0 };
}

// ── What a person may press ──────────────────────────────────────────────────

type Can = CapabilitiesResponse["can"];

/**
 * What this person can do with photos. `can` undefined is a read that has not answered or has failed, which is NOT "your role cannot": the
 * first says "checking", the second says the check failed, and only an answer that says no says the role cannot.
 */
export type PhotoAccess = { mode: "edit" } | { mode: "view"; why: string };

export function photoAccess(view: "loading" | "paused" | "failed" | "data" | "data_stale", can: Pick<Can, "propose"> | undefined): PhotoAccess {
  if (can) return can.propose ? { mode: "edit" } : { mode: "view", why: "Your role can look at your photos but not change them. Ask an editor, admin or owner." };
  if (view === "loading" || view === "paused") return { mode: "view", why: "Checking what you can do here..." };
  return { mode: "view", why: "We could not check what your role can do, so photos cannot be changed from here right now. Reload the page to try again." };
}

/** Statuses in which a photo change is still open: nothing has been sent, and the api's one-open-per-photo rule is in force. */
const OPEN = ["proposed", "validated", "approved", "applying"];

/** The photo changes of a change list, newest first. */
export function photoChanges(items: readonly ChangeCardData[] | undefined): ChangeCardData[] {
  return (items ?? []).filter((c) => c.field === "media");
}

export function openPhotoChanges(items: readonly ChangeCardData[] | undefined): ChangeCardData[] {
  return photoChanges(items).filter((c) => OPEN.includes(c.status));
}

/** The open change about one network photo (a removal of it), from the change list: the ONE source of what is waiting. */
export function pendingFor(items: readonly ChangeCardData[] | undefined, ref: string): ChangeCardData | undefined {
  return openPhotoChanges(items).find((c) => (c.after as { op?: string; ref?: string } | null)?.op === "remove" && (c.after as { ref?: string }).ref === ref);
}

/**
 * Whether a photo change has just LEFT the open statuses (it was sent, failed, declined or expired), so the photo list is stale and is read
 * again. `before` is the ids that were open at the last look.
 */
export function settledSince(before: ReadonlySet<string>, items: readonly ChangeCardData[] | undefined): boolean {
  const open = new Set(openPhotoChanges(items).map((c) => c.id));
  for (const id of before) if (!open.has(id)) return true;
  return false;
}

/** What the tile of a photo with a waiting removal says, by the change's own status, so nobody is told to approve what has no button. */
export function pendingNote(status: string, can: Pick<Can, "approve"> | undefined): string {
  if (status === "approved") return "Approved, waiting to be sent. It will be removed once it is sent.";
  if (status === "applying") return "Being removed now.";
  return can?.approve ? "A removal is waiting below. Approve or decline it there." : "A removal is waiting below for an admin or owner to approve.";
}

export function photoControls(
  access: PhotoAccess,
  photo: Pick<NetworkPhoto, "removable">,
  pending: ChangeCardData | undefined,
): { remove: boolean; note: string | null } {
  if (access.mode !== "edit") return { remove: false, note: photo.removable ? access.why : null };
  if (!photo.removable) return { remove: false, note: null };
  if (pending) return { remove: false, note: null };
  return { remove: true, note: null };
}

/** How many more photos can be chosen at once: the network's cap less what it holds and what is already being added, never more than ten. */
export function pickLimit(p: Pick<PhotosResponse, "declaration" | "held" | "items">, openAdds: number): number {
  const max = p.declaration.limits.maxItems;
  const left = max === undefined ? 10 : max - Math.max(p.held, p.items.length) - openAdds;
  return Math.max(0, Math.min(10, left));
}

export function canAddPhoto(access: PhotoAccess, p: Pick<PhotosResponse, "declaration" | "held" | "items">, openAdds: number): { ok: boolean; why: string | null } {
  if (access.mode !== "edit") return { ok: false, why: access.why };
  if (pickLimit(p, openAdds) === 0) return { ok: false, why: `A listing can hold at most ${p.declaration.limits.maxItems} photos. Remove one first.` };
  return { ok: true, why: null };
}

/** The picture to draw for a photo, or none: a video with no thumbnail draws no (broken) image. */
export function previewOf(p: Pick<NetworkPhoto, "thumbnailUrl" | "url" | "format">): string | null {
  return p.thumbnailUrl ?? (p.format === "photo" ? p.url : null);
}

/** Words for each photo that could not be prepared out of a batch chosen together. */
export function batchSummary(prepared: number, failed: ReadonlyArray<{ name: string; message: string }>): string {
  const head = prepared > 0 ? `${prepared} ${prepared === 1 ? "photo is" : "photos are"} prepared below. ` : "";
  if (failed.length === 0) return `${head}Review each one, then approve it.`.trim();
  return `${head}${failed.length} could not be prepared: ${failed.map((f) => `${f.name} (${f.message})`).join("; ")}`.trim();
}

/** A photo change as lines for its before-and-after card. */
export function photoValueLines(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const v = value as { op?: string; category?: string; file?: { name?: string }; ref?: string };
  if (v.op === "add") return [v.file?.name ? `Add "${v.file.name}"` : "Add a photo", ...(v.category ? [`Category: ${categoryLabel(v.category)}`] : [])];
  if (v.op === "remove") return ["Remove this photo", ...(v.category ? [`Category: ${categoryLabel(v.category)}`] : [])];
  if (v.op === "keep") return ["On your listing", ...(v.category ? [`Category: ${categoryLabel(v.category)}`] : [])];
  return [];
}
