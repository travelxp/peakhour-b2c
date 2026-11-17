import type { ReleaseStatus } from "@/lib/seo/types";

/**
 * How a registry ReleaseStatus is worded on a public page. Only live and beta are shipped; everything
 * before them reads "Coming soon", and a page never says more than the status supports. Colours are the
 * Daylight status tokens (each -ink is AA on its own -soft); the icon and the word carry the meaning too,
 * so colour is never the only signal.
 */
export type StatusMeta = { label: string; tone: "ok" | "warn" | "mute"; description: string };

export function statusMeta(status: ReleaseStatus): StatusMeta {
  switch (status) {
    case "live":
      return { label: "Live", tone: "ok", description: "Live." };
    case "beta":
      return { label: "Beta", tone: "warn", description: "In beta." };
    case "paused":
      return { label: "Paused", tone: "mute", description: "Paused." };
    case "retired":
      return { label: "Retired", tone: "mute", description: "Retired." };
    default:
      return { label: "Coming soon", tone: "mute", description: "Coming soon." };
  }
}

export const TONE_CLASS: Record<StatusMeta["tone"], string> = {
  ok: "border-[var(--daylight-ok)]/30 bg-[var(--daylight-ok-soft)] text-[var(--daylight-ok-ink)]",
  warn: "border-[var(--daylight-amber)]/60 bg-[var(--daylight-warn-soft)] text-[var(--daylight-warn-ink)]",
  mute: "border-border bg-muted text-muted-foreground",
};
