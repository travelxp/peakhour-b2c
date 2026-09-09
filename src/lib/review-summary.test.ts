/**
 * S0·5 — what the Presence review summary is allowed to say.
 *
 * ★★★EVERY FIGURE HERE IS ABSENT TODAY. No `google_review` row exists for
 * anybody until S0·1 provisions the Pub/Sub topic, so the first merchant to open
 * Presence sees the empty case — and the whole risk is rendering a `null` as a
 * zero: "0.0 ★" says customers rate this business at nothing, and "responds in
 * 0h" says they answer instantly. Neither is true and both are what `?? 0`
 * produces.
 *
 * Killer titles are load-bearing — `scripts/mutate-review-summary-card.mjs`
 * matches them for EQUALITY against vitest's JSON reporter.
 */
import { describe, it, expect } from "vitest";
import {
  cardSections,
  formatResponseTime,
  inboxTabFromParam,
  ratingLabel,
  ratingSubLabel,
  responseCaveat,
  reviewEmptyState,
  sampleCaveat,
  unansweredCta,
  INBOX_REVIEWS_HREF,
  REVIEW_SUMMARY_QUERY_KEY,
  type ReviewSummary,
} from "./review-summary";

const summary = (over: Partial<ReviewSummary> = {}): ReviewSummary => ({
  state: "ready",
  days: 90,
  windowStart: "2026-06-11T00:00:00.000Z",
  totalEver: 12,
  volume: 6,
  unanswered: 2,
  unansweredInWindow: 1,
  sampled: 6,
  rating: 4.3,
  ratedCount: 6,
  respondedCount: 4,
  timedCount: 4,
  medianResponseMs: 2 * 60 * 60 * 1000,
  worstRecent: [],
  ...over,
});

// ── The two empty states ─────────────────────────────────────────────────────

describe("reviewEmptyState — two absences that mean different things", () => {
  it("★★★says nothing has reached us, not that the merchant has no reviews", () => {
    // ⚠️TRUE OF EVERY ACCOUNT TODAY. "You have no reviews" is a claim about
    // their business; what we know is a claim about our pipeline.
    const state = reviewEmptyState(summary({ state: "awaiting_reviews", totalEver: 0, volume: 0 }));
    expect(state?.headline).toBe("No reviews have reached us yet");
    expect(state?.headline).not.toContain("You have no");
  });

  it("★★★tells a merchant with 200 reviews about the quiet spell, not that they have none", () => {
    const state = reviewEmptyState(
      summary({ state: "quiet_window", totalEver: 200, volume: 0, days: 30 }),
    );
    expect(state?.headline).toBe("No new reviews in the last 30 days");
    expect(state?.body).toContain("200");
  });

  it("★★★the two empty states do not share their words", () => {
    // A test that asserted merely that SOME empty state is returned would be
    // satisfied by a version that answers the same thing for both.
    const never = reviewEmptyState(summary({ state: "awaiting_reviews" }));
    const quiet = reviewEmptyState(summary({ state: "quiet_window" }));
    expect(never?.headline).not.toBe(quiet?.headline);
  });

  it("★★says nothing at all when there is something to show", () => {
    expect(reviewEmptyState(summary({ state: "ready" }))).toBeNull();
  });
});

// ── The rating ───────────────────────────────────────────────────────────────

describe("ratingLabel — null is not 0.0", () => {
  it("★★★never renders an unknown rating as zero stars", () => {
    // ⚠️THERE IS NO WORSE NUMBER TO PUT ON THIS CARD. "0.0 ★" says this
    // business's customers rate it at nothing.
    expect(ratingLabel(summary({ rating: null }))).toBeNull();
    expect(ratingSubLabel(summary({ rating: null }))).toBeNull();
  });

  it("★★shows one decimal, so a column of ratings lines up", () => {
    expect(ratingLabel(summary({ rating: 4 }))).toBe("4.0");
    expect(ratingLabel(summary({ rating: 4.3 }))).toBe("4.3");
  });

  it("★★says how many reviews the average is over", () => {
    expect(ratingSubLabel(summary({ ratedCount: 6 }))).toBe("from 6 rated reviews");
    expect(ratingSubLabel(summary({ ratedCount: 1 }))).toBe("from 1 rated review");
  });
});

// ── The response time ────────────────────────────────────────────────────────

describe("formatResponseTime — a duration a person would say", () => {
  it("★★★keeps an unmeasured response time unmeasured", () => {
    // "0h" is a claim that this merchant answers instantly.
    expect(formatResponseTime(null)).toBeNull();
  });

  it("★★★never says zero minutes for a reply inside the first minute", () => {
    expect(formatResponseTime(0)).toBe("under a minute");
    expect(formatResponseTime(45_000)).toBe("under a minute");
  });

  it("★★counts in minutes, then hours, then days", () => {
    expect(formatResponseTime(5 * 60_000)).toBe("5 minutes");
    expect(formatResponseTime(3 * 3_600_000)).toBe("3 hours");
    expect(formatResponseTime(5 * 86_400_000)).toBe("5 days");
  });

  it("★★keeps two days' worth in hours, where the number is easier to judge", () => {
    expect(formatResponseTime(36 * 3_600_000)).toBe("36 hours");
    expect(formatResponseTime(50 * 3_600_000)).toBe("2 days");
  });

  it("★singular and plural, so nothing reads as '1 hours'", () => {
    expect(formatResponseTime(60_000)).toBe("1 minute");
    expect(formatResponseTime(3_600_000)).toBe("1 hour");
    expect(formatResponseTime(24 * 3_600_000 * 2 + 1)).toBe("2 days");
  });

  it("★★★is not locale-dependent, so an assertion on it means the same on CI", () => {
    // ⚠️`Intl.RelativeTimeFormat` WOULD CHANGE WITH THE RUNTIME'S LOCALE, which
    // makes a green test here a red one on an en-US box — and this is a
    // DURATION, not a point in time, so it was never the right tool anyway.
    expect(formatResponseTime(2 * 3_600_000)).toBe("2 hours");
    expect(formatResponseTime(2 * 3_600_000)).not.toContain("in ");
    expect(formatResponseTime(2 * 3_600_000)).not.toContain("ago");
  });
});

// ── The caveats ──────────────────────────────────────────────────────────────

describe("responseCaveat — the replies we cannot time", () => {
  it("★★★says nothing when every reply was timed", () => {
    expect(responseCaveat(summary({ respondedCount: 4, timedCount: 4 }))).toBeNull();
  });

  it("★★★explains a median over fewer replies than were published", () => {
    const note = responseCaveat(summary({ respondedCount: 4, timedCount: 3 }));
    expect(note).toContain("3 of 4");
  });

  it("★★★says so when NONE of them could be timed", () => {
    // ⚠️THE CASE THAT LOOKS LIKE A CONTRADICTION: replies exist, the median is
    // null. A merchant who answered everything in Google's own console before
    // connecting is entitled to know why the figure is empty rather than being
    // told they answer nothing.
    const note = responseCaveat(summary({ respondedCount: 4, timedCount: 0 }));
    // ⚠️ASSERTED ON THE WORDS THAT DIFFER. The general branch also says
    // "…of 4 replies … before the reviews reached us", so both of those were
    // satisfied by the version with this branch deleted.
    expect(note).toContain("can't time any of the 4 replies");
    expect(note).not.toContain("Timed over");
  });

  it("★★★says it in the singular for the one reply that is the routine case", () => {
    // ⚠️AN OWNER WHO ANSWERED IN GOOGLE'S OWN APP has a `replyPublishedAt`
    // predating the row, so the latency is negative and excluded — one such
    // reply in a window is ordinary, and "any of the 1 replies" is what a
    // merchant would have read.
    const note = responseCaveat(summary({ respondedCount: 1, timedCount: 0 }));
    expect(note).toBe(
      "We can't time the 1 reply in this period — it was published before the review reached us.",
    );
    expect(note).not.toContain("1 replies");
  });

  it("★★says nothing at all when there were no replies to time", () => {
    expect(responseCaveat(summary({ respondedCount: 0, timedCount: 0 }))).toBeNull();
  });
});

describe("sampleCaveat — averaged over a page, not over everything", () => {
  it("★★★says so when the api capped the sample", () => {
    const note = sampleCaveat(summary({ sampled: 500, volume: 900 }));
    expect(note).toContain("500 most recent of 900");
  });

  it("★★★describes the SAMPLE, not the average", () => {
    // ⚠️THE api AVERAGES ONLY THE ROWS THAT CARRY A RATING and reports that as
    // `ratedCount`, so "rating averaged over the 500 most recent" sat directly
    // above "from 460 rated reviews" — two numbers on one card disagreeing
    // about what the average was over.
    const note = sampleCaveat(summary({ sampled: 500, volume: 900, ratedCount: 460 }));
    expect(note).toBe("Based on the 500 most recent of 900 reviews.");
    expect(note).not.toContain("averaged");
  });

  it("★★says nothing when the sample IS everything", () => {
    expect(sampleCaveat(summary({ sampled: 6, volume: 6 }))).toBeNull();
  });
});

// ── The one thing to do ──────────────────────────────────────────────────────

describe("unansweredCta — the only action on the card", () => {
  it("★★★offers nothing at zero", () => {
    // "0 waiting — answer them" is noise on a card whose job is to be quiet
    // when there is nothing to do.
    expect(unansweredCta(summary({ unanswered: 0 }))).toBeNull();
  });

  it("★★★counts the ALL-TIME waiting reviews, not the window's", () => {
    // A review from four months ago still needs answering.
    const cta = unansweredCta(summary({ unanswered: 7, unansweredInWindow: 1 }));
    expect(cta?.label).toBe("Answer 7 waiting reviews");
  });

  it("★★lands on the reviews lane, not on whichever tab opens first", () => {
    // ⚠️THE LITERAL, NOT THE CONSTANT. Comparing against `INBOX_REVIEWS_HREF`
    // is an assertion written AROUND a value rather than ON it: change the
    // constant and both sides move together, so dropping the fragment was
    // invisible.
    expect(unansweredCta(summary({ unanswered: 1 }))?.href).toBe("/dashboard/inbox?tab=reviews");
    expect(INBOX_REVIEWS_HREF).toBe("/dashboard/inbox?tab=reviews");
  });

  it("★says 'review' when there is one", () => {
    expect(unansweredCta(summary({ unanswered: 1 }))?.label).toBe("Answer 1 waiting review");
  });
});

describe("cardSections — an empty window is not an empty card", () => {
  it("★★★keeps the unanswered and reply figures through a quiet quarter", () => {
    // ⚠️THE TWO HALVES ARE OVER DIFFERENT POPULATIONS. A merchant whose whole
    // imported corpus predates the window, and who answered twenty reviews this
    // week, has `volume: 0` and so `quiet_window` — and hiding everything threw
    // away their reply time, their responded count AND their all-time unanswered
    // figure, while the card still offered to answer them.
    const sections = cardSections(summary({ state: "quiet_window" }));
    expect(sections.standingFigures).toBe(true);
    expect(sections.windowFigures).toBe(false);
  });

  it("★★★shows nothing at all when nothing has ever arrived", () => {
    // There is no review to be unanswered and no reply to have timed.
    const sections = cardSections(summary({ state: "awaiting_reviews" }));
    expect(sections.standingFigures).toBe(false);
    expect(sections.windowFigures).toBe(false);
  });

  it("★★shows both halves once the window has something in it", () => {
    const sections = cardSections(summary({ state: "ready" }));
    expect(sections.standingFigures).toBe(true);
    expect(sections.windowFigures).toBe(true);
  });
});

describe("REVIEW_SUMMARY_QUERY_KEY — one name, two surfaces", () => {
  it("★★★is a single exported key, so an invalidation cannot miss it", () => {
    // ⚠️SPELLED OUT IN BOTH PLACES IT DRIFTS SILENTLY: the invalidation simply
    // stops matching, and the Presence card keeps offering to answer a review
    // that has just been answered.
    expect(REVIEW_SUMMARY_QUERY_KEY).toEqual(["presence-review-summary"]);
  });
});

describe("inboxTabFromParam — where the call to action lands", () => {
  it("★★★opens the reviews lane when that is what was asked for", () => {
    expect(inboxTabFromParam("reviews")).toBe("reviews");
  });

  it("★★opens the default lane for anything it does not recognise", () => {
    // ⚠️A STALE BOOKMARK MUST NOT LEAVE THE PAGE SHOWING NO TAB AT ALL.
    expect(inboxTabFromParam("nonsense")).toBe("conversations");
    expect(inboxTabFromParam("")).toBe("conversations");
    expect(inboxTabFromParam(undefined)).toBe("conversations");
    // ★AND `null`, WHICH IS WHAT `searchParams.get` RETURNS when the parameter
    // is simply not there — the ordinary case, not an edge one.
    expect(inboxTabFromParam(null)).toBe("conversations");
  });

  it("★knows the other lane too", () => {
    expect(inboxTabFromParam("leads")).toBe("leads");
  });
});
