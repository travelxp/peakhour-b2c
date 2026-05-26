/**
 * Date / time / channel formatting helpers — pure functions.
 * No date library dependency; uses Intl.DateTimeFormat which ships
 * with every modern browser and respects the caller's IANA timezone.
 */

import type { ChannelKey, ScheduledItemStatus, StaggerStrategy } from "./types";

/** Render a Date in the given IANA timezone as `Mon, 1 Jun · 8:00 am`. */
export function formatScheduleLabel(
  iso: string | Date,
  timezone: string,
): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(d);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(d);
  return `${date} · ${time.toLowerCase()}`;
}

/** Shorter time-only render: `8:00 am`. */
export function formatTimeLabel(iso: string | Date, timezone: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  })
    .format(d)
    .toLowerCase();
}

/** Render a Date as `Mon, 1 Jun`. */
export function formatDateLabel(iso: string | Date, timezone: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(d);
}

/** Relative human label — "in 3 hours", "2 days ago". */
export function formatRelative(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = d.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (absMs < hour) {
    return rtf.format(Math.round(diffMs / minute), "minute");
  }
  if (absMs < day) {
    return rtf.format(Math.round(diffMs / hour), "hour");
  }
  if (absMs < 30 * day) {
    return rtf.format(Math.round(diffMs / day), "day");
  }
  return rtf.format(Math.round(diffMs / (30 * day)), "month");
}

/** Detect the user's IANA timezone (`Asia/Kolkata`, `America/New_York`, etc.). */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** Pretty channel name — UI-only; falls back to the raw key. */
export function channelDisplayName(channel: ChannelKey): string {
  const MAP: Record<string, string> = {
    newsletter: "Newsletter",
    linkedin: "LinkedIn",
    x: "X",
    facebook: "Facebook",
    instagram: "Instagram",
    threads: "Threads",
    youtube: "YouTube",
  };
  return MAP[channel] ?? channel.charAt(0).toUpperCase() + channel.slice(1);
}

/** Tone-coded label for an item status. Returns Tailwind tokens that
 *  match the existing peakhour-b2c StatusBadge palette so chips don't
 *  drift visually. */
export function statusTone(
  status: ScheduledItemStatus,
): "success" | "warn" | "error" | "info" | "neutral" {
  switch (status) {
    case "published":
      return "success";
    case "queued":
    case "awaiting_retry":
    case "ready":
    case "in_flight":
      return "info";
    case "needs_action":
      return "warn";
    case "failed":
      return "error";
    case "cancelled":
    case "skipped":
      return "neutral";
  }
}

/** Plain-English explanation of a stagger strategy. Used in the
 *  picker tooltip and the confirmation card. */
export function staggerDescription(strategy: StaggerStrategy): string {
  switch (strategy) {
    case "synchronized":
      return "Every channel publishes at the same moment — max-blast announce pattern.";
    case "rolling":
      return "Newsletter first, then LinkedIn (+90 min), then X (+90 min after). Earns peak attention on each channel in sequence.";
    case "smart":
      return "Each channel picks its best time — based on adapter priors and your past engagement curve.";
  }
}

/** SHA-1 helper for sourceTextHash. Uses the browser SubtleCrypto so
 *  no bundle-cost dependency. Falls back to a textual hash for the
 *  edge case where SubtleCrypto isn't available (only relevant for
 *  ad_hoc paste-and-schedule — persisted sources have their hash
 *  computed server-side). */
export async function sha1Hex(text: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-1", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback: trivial non-crypto hash for environments without
  // SubtleCrypto (notably old Node test runners). The server-side
  // hash is the source of truth; this is only the b2c's local stamp
  // for ad_hoc paste-and-schedule when SubtleCrypto isn't available.
  // Not used for cryptographic verification — just a stable 40-hex
  // digest that the schema accepts.
  let h = 0x811c9dc5; // FNV-1a 32-bit seed
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hex8 = h.toString(16).padStart(8, "0");
  // Repeat the digest 5× to fill the 40-hex span the schema requires.
  return (hex8 + hex8 + hex8 + hex8 + hex8).slice(0, 40);
}
