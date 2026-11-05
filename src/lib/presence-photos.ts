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
  items: NetworkPhoto[];
  waiting: Array<{ id: string; status: string; op: string | null }>;
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

/** What a person can press. Adding and removing are an editor's; approving is an admin's, on the change card. */
export function photoControls(
  can: { propose: boolean } | undefined,
  photo: Pick<NetworkPhoto, "removable">,
  waiting: boolean,
): { remove: boolean; whyNot: string | null } {
  if (!can?.propose) return { remove: false, whyNot: "Your role can look at your photos but not change them." };
  if (!photo.removable) return { remove: false, whyNot: null };
  if (waiting) return { remove: false, whyNot: "A photo change is already waiting. Finish that first." };
  return { remove: true, whyNot: null };
}

export function canAddPhoto(can: { propose: boolean } | undefined, p: Pick<PhotosResponse, "waiting" | "declaration" | "held">): { ok: boolean; why: string | null } {
  if (!can?.propose) return { ok: false, why: "Your role can look at your photos but not change them. Ask an editor, admin or owner." };
  if (p.waiting.length > 0) return { ok: false, why: "A photo change is already waiting below. Approve or decline it before adding another." };
  const max = p.declaration.limits.maxItems;
  if (max !== undefined && p.held >= max) return { ok: false, why: `A listing can hold at most ${max} photos. Remove one first.` };
  return { ok: true, why: null };
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
