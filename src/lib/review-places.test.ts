import { describe, it, expect } from "vitest";
import {
  limitNote,
  placeName,
  placeNeedsAttention,
  placeNoRatingNote,
  locationScopeNote,
  PLACES_MAX,
  showAllLimit,
  unansweredLabel,
  unplacedNote,
  wantsPlacesView,
  type PlaceReviewRow,
} from "./review-places";
import { ratingLabel, ratingSubLabel, summariesOf, type ReviewSummaryResponse } from "./review-summary";

/**
 * PE-R: the all-locations reviews view's rules. Killer titles are load-bearing: `scripts/mutate-presence-reviews-r.mjs` matches them.
 * This repo runs vitest without JSDOM, so the card is markup and every sentence and rule is asserted here.
 */

const row = (over: Partial<PlaceReviewRow> = {}): PlaceReviewRow => ({
  locationName: "locations/1",
  title: "Main Street",
  totalEver: 5,
  volume: 3,
  rating: 4.2,
  ratedCount: 3,
  unanswered: 0,
  unansweredInWindow: 0,
  ...over,
});

describe("a place's rating is its own, and absent is not zero", () => {
  it("★★★a place with no rating has none: never '0.0'", () => {
    expect(ratingLabel(row({ rating: null, ratedCount: 0 }))).toBeNull();
    expect(ratingSubLabel(row({ rating: null, ratedCount: 0 }))).toBeNull();
  });
  it("★one decimal always, so 4 and 4.3 line up", () => {
    expect(ratingLabel(row({ rating: 4 }))).toBe("4.0");
    expect(ratingLabel(row({ rating: 4.3 }))).toBe("4.3");
  });
  it("★the rating says how many reviews it is over, and pluralises", () => {
    expect(ratingSubLabel(row({ ratedCount: 1 }))).toBe("from 1 rated review");
    expect(ratingSubLabel(row({ ratedCount: 12 }))).toBe("from 12 rated reviews");
  });
  it("★★why there is no rating is said in the place's own terms, three different ways", () => {
    expect(placeNoRatingNote(row({ totalEver: 0, volume: 0 }), 90)).toBe("No reviews yet");
    expect(placeNoRatingNote(row({ totalEver: 8, volume: 0 }), 90)).toBe("No new reviews in the last 90 days");
    expect(placeNoRatingNote(row({ totalEver: 8, volume: 2 }), 90)).toBe("No rated reviews in this period");
  });
  it("the name is the title the merchant picked, else the reference, never blank", () => {
    expect(placeName(row())).toBe("Main Street");
    expect(placeName(row({ title: "   " }))).toBe("locations/1");
    expect(placeName(row({ title: null }))).toBe("locations/1");
  });
});

describe("★★which place the other panels show is said", () => {
  it("says it while every location is shown, naming the place, and nothing once one is picked", () => {
    expect(locationScopeNote({ narrowed: false, shownName: "Main Street" })).toBe("The reviews show every location. The listing, the score and the review link below show Main Street.");
    expect(locationScopeNote({ narrowed: true, shownName: "Main Street" })).toBeNull();
    expect(locationScopeNote({ narrowed: false, shownName: null })).toBeNull();
  });
});

describe("the place that needs attention", () => {
  it("★a place needs attention when something is waiting; the waiting count is said per place", () => {
    expect(placeNeedsAttention(row({ unanswered: 0 }))).toBe(false);
    expect(placeNeedsAttention(row({ unanswered: 2 }))).toBe(true);
    expect(unansweredLabel(row({ unanswered: 0 }))).toBe("Nothing waiting");
    expect(unansweredLabel(row({ unanswered: 3 }))).toBe("3 waiting for an answer");
  });
});

describe("★★★a cut list says it is cut", () => {
  it("names how many of how many when the list was limited", () => {
    expect(limitNote({ total: 100, shown: 25, limited: true })).toBe("Showing the 25 locations that need attention most, out of 100.");
  });
  it("says nothing when the list is whole", () => {
    expect(limitNote({ total: 4, shown: 4, limited: false })).toBeNull();
  });
  it("offers the rest only when there is a rest, capped at what the api returns", () => {
    expect(showAllLimit({ total: 40, shown: 25, limited: true })).toBe(40);
    expect(showAllLimit({ total: 400, shown: 25, limited: true })).toBe(PLACES_MAX);
    expect(showAllLimit({ total: 4, shown: 4, limited: false })).toBeNull();
  });
});

describe("reviews that name no place are said, not dropped", () => {
  it("a count and a reason, with the network's own word", () => {
    expect(unplacedNote(0, "Replyhub")).toBeNull();
    expect(unplacedNote(1, "Replyhub")).toBe("1 Replyhub review doesn't say which location it is for, so it is not in any row above.");
    expect(unplacedNote(3, "Replyhub")).toBe("3 Replyhub reviews don't say which location they are for, so they are not in any row above.");
  });
});

describe("★★the places view is the default for several places, until one is picked", () => {
  it("starts from every place when there is a choice of places and none is picked", () => {
    expect(wantsPlacesView({ hasSwitcher: true, narrowed: false })).toBe(true);
  });
  it("picking a place narrows it", () => {
    expect(wantsPlacesView({ hasSwitcher: true, narrowed: true })).toBe(false);
  });
  it("one place has no choice, so the ordinary summary stands", () => {
    expect(wantsPlacesView({ hasSwitcher: false, narrowed: false })).toBe(false);
  });
});

describe("★★★the summary answer is per network, and no entry is a sum of two", () => {
  const response: ReviewSummaryResponse = {
    days: 90,
    windowStart: "2026-08-07T00:00:00.000Z",
    locationName: null,
    networks: [
      { network: "a", label: "Alpha", state: "ready", totalEver: 2, volume: 2, unanswered: 1, unansweredInWindow: 1, sampled: 2, rating: 5, ratedCount: 2, respondedCount: 0, timedCount: 0, medianResponseMs: null, worstRecent: [] },
      { network: "b", label: "Beta", state: "ready", totalEver: 1, volume: 1, unanswered: 1, unansweredInWindow: 1, sampled: 1, rating: 1, ratedCount: 1, respondedCount: 0, timedCount: 0, medianResponseMs: null, worstRecent: [] },
    ],
  };
  it("each network keeps its own rating and label, carrying the window", () => {
    const s = summariesOf(response);
    expect(s.map((x) => [x.label, x.rating, x.days])).toEqual([["Alpha", 5, 90], ["Beta", 1, 90]]);
    expect(s[0]!.windowStart).toBe(response.windowStart);
  });
  it("nothing is averaged: no entry carries the blend (3.0)", () => {
    expect(summariesOf(response).some((x) => x.rating === 3)).toBe(false);
  });
  it("no network at all is an empty list, not a zero", () => {
    expect(summariesOf({ ...response, networks: [] })).toEqual([]);
  });
});
