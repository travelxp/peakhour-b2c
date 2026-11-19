import type { CapabilityState, PostIdea, StudioAvailability, StudioCapability } from "@/lib/api/creative";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** Pure helpers for Studio screens. No React, no fetching: tested directly. */

export const STUDIO_ROUTES = {
  home: "/dashboard/studio",
  new: "/dashboard/studio/new",
} as const;

/** The state of one capability; anything not known to be on is "coming soon". */
export function capabilityState(a: StudioAvailability, c: StudioCapability): CapabilityState {
  return a.capabilities[c] === "on" ? "on" : "coming_soon";
}

/** Where "Make previews" goes: the brief, with the idea prefilled. Free, no call. */
export function briefHref(ideaId: string): string {
  return `${STUDIO_ROUTES.new}?idea=${encodeURIComponent(ideaId)}`;
}

const dateLabel = (iso: string, locale?: string) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/**
 * "Good until 12 Nov 2026" for a festival idea, otherwise nothing. The festival's own calendar date (`facts.date`, YYYY-MM-DD on the
 * business's calendar) is shown as it is, in UTC, so a viewer's time zone cannot move it a day; `expiresAt` is the fallback.
 */
export function goodUntil(idea: PostIdea, locale?: string): string | null {
  if (idea.kind !== "festival") return null;
  const day = idea.facts.date;
  if (typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return STUDIO_COPY.ideas.goodUntil(
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`)),
    );
  }
  const t = Date.parse(idea.expiresAt);
  return Number.isNaN(t) ? null : STUDIO_COPY.ideas.goodUntil(dateLabel(idea.expiresAt, locale));
}

/**
 * The line shown when an idea is hidden. A festival idea stays away until the festival has passed (named in the idea's facts when the
 * api gives it); any other idea for `coolingDays`. Worked out here because the dismissal is sent after the undo window closes.
 */
export function hiddenUntilLine(idea: PostIdea, coolingDays: number, now: Date, locale?: string): string {
  if (idea.kind === "festival") {
    const name = idea.facts.festival;
    if (typeof name === "string" && name.trim()) return STUDIO_COPY.ideas.backAfterFestival(name.trim());
  }
  const back = new Date(now.getTime() + coolingDays * 86_400_000);
  return STUDIO_COPY.ideas.backAfter(dateLabel(back.toISOString(), locale));
}

export type IdeasFeedStatus = "loading" | "offline" | "error" | "ready";

/**
 * The state of the ideas feed, from a query's flags.
 *   - data held (even stale, even mid-refetch, even after a failed refetch) -> ready: a poll that fails must not blank the list;
 *   - no data and an error stamp -> error. `errorUpdatedAt`, not `error`/`isError`: v5 clears both at the start of every refetch of a
 *     query with no data, so an `isError` branch flickers back to skeletons;
 *   - no data and paused -> offline (`isLoading` is false for a paused query, which would otherwise render as an empty answer);
 *   - otherwise loading.
 */
export function ideasFeedStatus(q: {
  data: unknown;
  errorUpdatedAt: number;
  fetchStatus: "fetching" | "paused" | "idle";
}): IdeasFeedStatus {
  if (q.data !== undefined) return "ready";
  if (q.errorUpdatedAt > 0) return "error";
  if (q.fetchStatus === "paused") return "offline";
  return "loading";
}
