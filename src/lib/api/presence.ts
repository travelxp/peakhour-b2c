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
export const presenceApi = {
  /**
   * The review summary: rating, volume, unanswered, median response time and
   * the worst recent reviews, over a window.
   *
   * @param days 1–365. The api clamps and defaults to 90 — reviews arrive far
   *   more slowly than clicks, and a 28-day mean rating over one review is
   *   noise.
   */
  reviewSummary: (days?: number) =>
    api.get<ReviewSummary>(
      `/v1/presence/reviews/summary${days ? `?days=${days}` : ""}`,
    ),

  /** The listing, its Google sync state and which fields differ from Google. */
  listing: () => api.get<PresenceListingResponse>("/v1/presence/listing"),

  /**
   * Day-by-day customer actions for the chosen listing.
   *
   * @param days 1-90. The api clamps and defaults to 28.
   */
  insights: (days?: number) =>
    api.get<PresenceInsightsResponse>(
      `/v1/presence/insights${days ? `?days=${days}` : ""}`,
    ),
};
