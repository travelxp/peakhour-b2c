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
  /** False when the business's own list still had photos that were not read: no absence is believed from the list. */
  complete: boolean;
  /** False when the customers' photos could not be read: the panel says so and nothing else stops. */
  customersComplete: boolean;
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
/** Open, or sent and not yet shown or failed: the photo list is stale until each of these settles. */
const IN_FLIGHT = [...OPEN, "submitted"];

/**
 * The photo changes of a change list, newest first, FOR ONE NETWORK: a change belongs to the network it was prepared for, and another network's
 * changes stay under that network.
 */
export function photoChanges(items: readonly ChangeCardData[] | undefined, network: string): ChangeCardData[] {
  return (items ?? []).filter((c) => c.field === "media" && c.network === network);
}

export function openPhotoChanges(items: readonly ChangeCardData[] | undefined, network: string): ChangeCardData[] {
  return photoChanges(items, network).filter((c) => OPEN.includes(c.status));
}

/** Open or sent-not-yet-shown: what the photo list has not caught up with. Adds among these count against the cap. */
export function inFlightPhotoChanges(items: readonly ChangeCardData[] | undefined, network: string): ChangeCardData[] {
  return photoChanges(items, network).filter((c) => IN_FLIGHT.includes(c.status));
}

/**
 * The photo changes to list: EVERY one that has not settled (open, or sent and not yet shown) and only the most recent `settledCap` of the settled
 * history. Capping what is listed must never hide a change somebody can still act on.
 */
export function listedPhotoChanges(items: readonly ChangeCardData[] | undefined, network: string, settledCap: number): ChangeCardData[] {
  const all = photoChanges(items, network);
  const settled = all.filter((c) => !IN_FLIGHT.includes(c.status)).slice(0, settledCap);
  const keep = new Set([...all.filter((c) => IN_FLIGHT.includes(c.status)), ...settled].map((c) => c.id));
  return all.filter((c) => keep.has(c.id));
}

/** The change about one network photo (a removal of it) that has not settled, from the change list: the ONE source of what is waiting. */
export function pendingFor(items: readonly ChangeCardData[] | undefined, network: string, ref: string): ChangeCardData | undefined {
  return inFlightPhotoChanges(items, network).find((c) => (c.after as { op?: string; ref?: string } | null)?.op === "remove" && (c.after as { ref?: string }).ref === ref);
}

/**
 * Whether a photo change has just LEFT the in-flight statuses (it went live or failed after being sent, or was declined or expired before), so the
 * photo list is stale and is read again. `before` is the ids that were in flight at the last look.
 */
export function settledSince(before: ReadonlySet<string>, items: readonly ChangeCardData[] | undefined, network: string): boolean {
  const flying = new Set(inFlightPhotoChanges(items, network).map((c) => c.id));
  for (const id of before) if (!flying.has(id)) return true;
  return false;
}

/** What the tile of a photo with a removal on its way says, by the change's own status, so nobody is told to approve what has no button. */
export function pendingNote(status: string, can: Pick<Can, "approve"> | undefined): string {
  if (status === "submitted") return "Removal sent. Waiting for it to show.";
  if (status === "approved") return "Approved, waiting to be sent. It will be removed once it is sent.";
  if (status === "applying") return "Being removed now.";
  return can?.approve ? "A removal is waiting below. Approve or decline it there." : "A removal is waiting below for an admin or owner to approve.";
}

/**
 * Whether the change list, which says what is waiting, has answered. Until it has, adding and removing are withheld and the reason is said:
 * a Remove drawn beside a removal nobody has seen yet would be a second change for the same photo.
 */
export function withChangesKnown(access: PhotoAccess, changes: "loading" | "paused" | "failed" | "data" | "data_stale"): PhotoAccess {
  if (access.mode !== "edit") return access;
  if (changes === "data" || changes === "data_stale") return access;
  if (changes === "failed") return { mode: "view", why: "We could not load your photo changes, so adding and removing are off until they load. Try again." };
  return { mode: "view", why: "Checking your waiting photo changes..." };
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
export function pickLimit(p: Pick<PhotosResponse, "declaration" | "held" | "items">, waitingAdds: number): number {
  const max = p.declaration.limits.maxItems;
  const left = max === undefined ? 10 : max - Math.max(p.held, p.items.length) - waitingAdds;
  return Math.max(0, Math.min(10, left));
}

/**
 * Whether more photos can be added, and if not why. The cap and the photos ALREADY WAITING are different reasons: the first says remove one, the
 * second says finish the ones that are waiting.
 */
export function canAddPhoto(access: PhotoAccess, p: Pick<PhotosResponse, "declaration" | "held" | "items">, waitingAdds: number): { ok: boolean; why: string | null } {
  if (access.mode !== "edit") return { ok: false, why: access.why };
  if (pickLimit(p, waitingAdds) > 0) return { ok: true, why: null };
  const max = p.declaration.limits.maxItems;
  const holds = Math.max(p.held, p.items.length);
  if (max !== undefined && holds < max && waitingAdds > 0) {
    return { ok: false, why: `The photos already waiting would fill the ${max} this listing can hold. Approve or decline them first.` };
  }
  return { ok: false, why: `A listing can hold at most ${max} photos. Remove one first.` };
}

/** The picture to draw for a photo, or none: a video with no thumbnail draws no (broken) image. */
export function previewOf(p: Pick<NetworkPhoto, "thumbnailUrl" | "url" | "format">): string | null {
  return p.thumbnailUrl ?? (p.format === "photo" ? p.url : null);
}

/** What a batch chosen together came to. `prepared` are the ids of the changes that were stored and checked. */
export interface Batch {
  prepared: string[];
  /** Blocked by the checks, or refused: not prepared. */
  failed: Array<{ name: string; message: string }>;
  /** Stored but the network could not check them just now: waiting, but NOT counted as prepared. */
  notChecked: Array<{ name: string; message: string }>;
}

/**
 * Words for a batch, or null when there is nothing left to say. The "review and approve" line is for the changes of the batch that are STILL
 * open, says who approves, and goes once they settle; a photo that could not be prepared or checked stays named until the next batch.
 */
export function batchSummary(batch: Batch | null, openIds: ReadonlySet<string>, can: Pick<Can, "approve"> | undefined): string | null {
  if (!batch) return null;
  const waiting = batch.prepared.filter((id) => openIds.has(id)).length;
  const parts: string[] = [];
  if (waiting > 0) {
    parts.push(`${waiting} ${waiting === 1 ? "photo is" : "photos are"} prepared below. ${can?.approve ? "Review each one, then approve it." : "An admin or owner has to approve each one."}`);
  }
  if (batch.notChecked.length > 0) {
    parts.push(`${batch.notChecked.length} could not be checked just now and ${batch.notChecked.length === 1 ? "is" : "are"} waiting unchecked: ${batch.notChecked.map((f) => `${f.name} (${f.message})`).join("; ")}.`);
  }
  if (batch.failed.length > 0) {
    parts.push(`${batch.failed.length} could not be prepared: ${batch.failed.map((f) => `${f.name} (${f.message})`).join("; ")}.`);
  }
  return parts.length ? parts.join(" ") : null;
}

/** What one proposal answered: prepared and checked, blocked by the checks (with the reason), or stored unchecked. NEVER "prepared" for the last two. */
export function outcomeOf(r: { items: Array<Pick<ChangeCardData, "id" | "status" | "reason">>; notChecked: Array<{ id: string; message: string }> }):
  | { kind: "prepared"; id: string }
  | { kind: "blocked"; message: string }
  | { kind: "not_checked"; message: string } {
  const row = r.items[0];
  if (!row) return { kind: "blocked", message: "Nothing was prepared." };
  if (row.status === "blocked") return { kind: "blocked", message: row.reason?.message ?? "It was blocked." };
  const unchecked = r.notChecked.find((n) => n.id === row.id);
  if (unchecked) return { kind: "not_checked", message: unchecked.message };
  return { kind: "prepared", id: row.id };
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
