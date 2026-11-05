import { api } from "@/lib/api";
import type { ReviewSummaryResponse } from "@/lib/review-summary";
import type { PlaceReviewsResponse } from "@/lib/review-places";
import type { ReviewKit } from "@/lib/review-kit";
import type { ConnectableNetwork, PresenceInsightsResponse, PresenceListingResponse } from "@/lib/presence-panels";

/**
 * `/v1/presence/*` — the Presence pillar's read surface.
 *
 * ⚠️EVERY FIGURE THIS RETURNS IS ABSENT TODAY. `sup_inbox` holds no
 * `google_review` row for anybody until the Pub/Sub notification topic is
 * provisioned (plan S0·1), so `state` comes back `awaiting_reviews` and every
 * computed figure is `null`. That is an answer, not a failure — see
 * `lib/review-summary.ts`, which is where it is turned into words.
 */
/** `?days=&location=&network=`, leaving out what is not set. `network` picks which network's connection answers. */
export function presenceQuery(p: { days?: number | undefined; location?: string | undefined; network?: string | undefined; limit?: number | undefined }): string {
  const q = new URLSearchParams();
  if (p.days) q.set("days", String(p.days));
  if (p.location) q.set("location", p.location);
  if (p.network) q.set("network", p.network);
  if (p.limit) q.set("limit", String(p.limit));
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
  reviewSummary: (days?: number, location?: string, network?: string) =>
    api.get<ReviewSummaryResponse>(`/v1/presence/reviews/summary${presenceQuery({ days, location, network })}`),

  /**
   * Each place's rating and counts side by side, the place that needs attention first (PE-R). Nothing is added across places.
   * `limit` cuts the list (the api defaults to 25 and allows 100) and the answer says when it did.
   */
  reviewPlaces: (days?: number, network?: string, limit?: number) =>
    api.get<PlaceReviewsResponse>(`/v1/presence/reviews/places${presenceQuery({ days, network, limit })}`),

  /** Every network a merchant can connect, and what each can do. The connect cards are drawn from this. */
  capabilities: () => api.get<{ items: ConnectableNetwork[] }>("/v1/presence/capabilities"),

  /**
   * The review link, its QR code and what a poster prints. One link for the place, for every customer: it takes no rating or sentiment.
   */
  reviewKit: (location?: string, network?: string) => api.get<ReviewKit>(`/v1/presence/reviews/kit${presenceQuery({ location, network })}`),

  /**
   * Draft a reply to one review and save it as the review's suggestion. ★IT NEVER SENDS: the person reads it, edits it and presses Send.
   * Charged per press at the rate card's price for `presence_review_reply`, which the button shows first (`ACTION_USE_CASES.presenceReviewReply`).
   */
  draftReviewReply: (inboxItemId: string) =>
    api.post<{ ok: true; draft: string; rationale: string; chargedCredits: number }>(`/v1/presence/reviews/${inboxItemId}/draft`, {}),

  /** The listing, each network's sync state and which fields differ on each. */
  listing: (location?: string, network?: string) =>
    api.get<PresenceListingResponse>(`/v1/presence/listing${presenceQuery({ location, network })}`),

  /**
   * Day-by-day customer actions for the chosen listing.
   *
   * @param days 1-90. The api clamps and defaults to 28.
   */
  insights: (days?: number, location?: string, network?: string) =>
    api.get<PresenceInsightsResponse>(`/v1/presence/insights${presenceQuery({ days, location, network })}`),
};
