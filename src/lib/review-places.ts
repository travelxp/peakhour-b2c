/**
 * The all-locations reviews view: what it is allowed to SAY (PE-R).
 *
 * ★★EACH PLACE STANDS ON ITS OWN. The api returns one row per place, each with its own rating and counts, the place that needs attention
 * first, and no total. Nothing in this file adds two places together, and the screen has no total row: a 4.8 shop and a 3.1 shop averaged
 * into a 4.1 describes neither, and an "unanswered" sum hides which shop to open first.
 *
 * ★A CUT LIST SAYS SO. When the api listed fewer places than the business has, `limitNote` says how many of how many, and the card offers
 * the rest. The merchant is never left to think a cut list is the whole.
 *
 * ★ABSENT IS NOT ZERO. A place with no rated review has no rating (`null`), not "0.0".
 *
 * This repo runs vitest without JSDOM, so the rules are here and `components/presence/review-places-card.tsx` holds only markup. No
 * network is named: the network's word arrives as the answer's `label`.
 */

export interface PlaceReviewRow {
  /** The network's own reference to the place, as `?location=` carries it. */
  locationName: string;
  title: string | null;
  totalEver: number;
  volume: number;
  rating: number | null;
  ratedCount: number;
  unanswered: number;
  unansweredInWindow: number;
}

export type PlaceReviewsResponse = { days: number; windowStart: string } & (
  | { splittable: false; reason: "no_connection" | "one_place" | "network_cannot_tell_places_apart" }
  | {
      splittable: true;
      network: string;
      label: string;
      total: number;
      limit: number;
      shown: number;
      limited: boolean;
      unplaced: number;
      places: PlaceReviewRow[];
    }
);

export const REVIEW_PLACES_QUERY_KEY = ["presence-review-places"] as const;

/** The largest list the api returns (a connection manages at most this many places). */
export const PLACES_MAX = 100;

/** The name a merchant picked the place by, else its reference, so a place is never listed without a name. */
export function placeName(p: Pick<PlaceReviewRow, "title" | "locationName">): string {
  return p.title?.trim() || p.locationName;
}

/** The line under a place with no rating: why there is none. */
export function placeNoRatingNote(p: Pick<PlaceReviewRow, "totalEver" | "volume">, days: number): string {
  if (p.totalEver === 0) return "No reviews yet";
  if (p.volume === 0) return `No new reviews in the last ${days} days`;
  return "No rated reviews in this period";
}

/** A place needs attention when reviews are waiting for an answer. */
export function placeNeedsAttention(p: Pick<PlaceReviewRow, "unanswered">): boolean {
  return p.unanswered > 0;
}

/** The waiting count as a phrase: all-time, as the api counts it. */
export function unansweredLabel(p: Pick<PlaceReviewRow, "unanswered">): string {
  if (p.unanswered === 0) return "Nothing waiting";
  return `${p.unanswered} waiting for an answer`;
}

/** Said when the list was cut; null when it is whole. */
export function limitNote(a: { total: number; shown: number; limited: boolean }): string | null {
  if (!a.limited) return null;
  return `Showing the ${a.shown} locations that need attention most, out of ${a.total}.`;
}

/** The limit to ask for to see every place, or null when nothing more can be shown. */
export function showAllLimit(a: { total: number; shown: number; limited: boolean }): number | null {
  return a.limited ? Math.min(a.total, PLACES_MAX) : null;
}

/** Reviews the network sent that name no place, so they are in no place's figures. Null when there are none. */
export function unplacedNote(unplaced: number, label: string): string | null {
  if (unplaced <= 0) return null;
  return `${unplaced} ${label} review${unplaced === 1 ? " doesn't" : "s don't"} say which location ${unplaced === 1 ? "it is" : "they are"} for, so ${unplaced === 1 ? "it is" : "they are"} not in any row above.`;
}

/**
 * Whether the reviews section starts from every location side by side: the default for a business with a choice of places (the location
 * switcher exists), until the merchant narrows to one. The card then asks the api, and draws the ordinary summary when the api could not
 * split the network by place.
 */
export function wantsPlacesView(args: { hasSwitcher: boolean; narrowed: boolean }): boolean {
  return args.hasSwitcher && !args.narrowed;
}

/**
 * ★THE REVIEWS HAVE THEIR OWN SCOPE, separate from the listing select. The listing select answers "which listing" for the listing, the
 * score, the edit forms, the photos and the insights, and an edit must never appear to apply to "all locations". The reviews are either
 * every location or one place; this returns the place when it is still one the business has, else undefined (every location).
 */
export function reviewsPlaceIn(options: ReadonlyArray<{ value: string }> | undefined, picked: string | undefined): string | undefined {
  return picked !== undefined && options?.some((o) => o.value === picked) ? picked : undefined;
}
