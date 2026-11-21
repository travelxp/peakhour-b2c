import { isMetaComposeChannel, type MetaComposeChannel } from "@/lib/meta-compose";

/**
 * The channels the "New post" sheet can open on.
 */
export type ComposeChannel = "linkedin" | "x" | MetaComposeChannel;

export function isComposeChannel(value: string): value is ComposeChannel {
  return value === "linkedin" || value === "x" || isMetaComposeChannel(value);
}

/**
 * The URL contract for the calendar's New post sheet.
 *
 *   /dashboard/calendar?compose=1          opens the sheet and asks which channel
 *   /dashboard/calendar?compose=<channel>  opens it on that channel
 *                                          (linkedin, x, facebook, instagram, threads)
 *
 * Anything else (no value, an unknown name, a retired channel) opens nothing: a typo in a link must not pop a sheet.
 * A channel that is not connected still opens the sheet, which then shows the picker and the way to connect it.
 */
export type ComposeRequest = { open: false } | { open: true; channel: ComposeChannel | null };

export function parseComposeParam(raw: string | null | undefined): ComposeRequest {
  if (raw === "1") return { open: true, channel: null };
  if (raw && isComposeChannel(raw)) return { open: true, channel: raw };
  return { open: false };
}

/** The link that opens the sheet from another page. */
export function composeHref(channel?: ComposeChannel): string {
  return `/dashboard/calendar?compose=${channel ?? "1"}`;
}
