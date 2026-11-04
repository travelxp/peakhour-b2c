import { api } from "@/lib/api";
import type { ReviewSummary } from "@/lib/review-summary";
import type { PresenceInsightsResponse, PresenceListingResponse } from "@/lib/presence-panels";

/**
 * `/v1/presence/*` — the Presence pillar's read surface.
 *
 * ⚠️EVERY FIGURE THIS RETURNS IS ABSENT TODAY. `sup_inbox` holds no
 * `google_review` row for anybody until the Pub/Sub notification topic is
 * provisioned (plan S0·1), so `state` comes back `awaiting_reviews` and every
 * computed figure is `null`. That is an answer, not a failure — see
 * `lib/review-summary.ts`, which is where it is turned into words.
 */
/** `?days=&location=`, leaving out what is not set. */
export function presenceQuery(p: { days?: number | undefined; location?: string | undefined }): string {
  const q = new URLSearchParams();
  if (p.days) q.set("days", String(p.days));
  if (p.location) q.set("location", p.location);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const presenceApi = {
  /**
   * The review summary: rating, volume, unanswered, median response time and
   * the worst recent reviews, over a window.
   *
   * @param days 1–365. The api clamps and defaults to 90 — reviews arrive far
   *   more slowly than clicks, and a 28-day mean rating over one review is
   *   noise.
   */
  reviewSummary: (days?: number, location?: string) =>
    api.get<ReviewSummary>(`/v1/presence/reviews/summary${presenceQuery({ days, location })}`),

  /** The listing, its Google sync state and which fields differ from Google. */
  listing: (location?: string) =>
    api.get<PresenceListingResponse>(`/v1/presence/listing${presenceQuery({ location })}`),

  /**
   * Day-by-day customer actions for the chosen listing.
   *
   * @param days 1-90. The api clamps and defaults to 28.
   */
  insights: (days?: number, location?: string) =>
    api.get<PresenceInsightsResponse>(`/v1/presence/insights${presenceQuery({ days, location })}`),
};
