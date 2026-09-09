/**
 * What the Presence review summary is allowed to SAY (plan S0·5).
 *
 * ★★★EVERY FIGURE ON THIS CARD IS ABSENT TODAY. `sup_inbox` holds no
 * `google_review` row for anybody until the Pub/Sub notification topic is
 * provisioned (S0·1, unassigned), so the first merchant to open Presence sees
 * the empty case and nothing else. The api answers that honestly — a `state`,
 * and `null` for every figure it cannot compute — and the whole job of this
 * module is to not throw that away by rendering a null as a zero.
 *
 *   "0.0 ★" is a claim that customers rate this business at nothing.
 *   "0 reviews" is a claim about the merchant's business.
 *   "responds in 0h" is a claim they answer instantly.
 *
 * None of the three is true, and each is what a `?? 0` produces.
 *
 * ⚠️THIS REPO RUNS VITEST WITHOUT JSDOM, so a rule inside the card is a rule
 * nothing asserts — the same split as `lib/review-reply.ts` and
 * `components/presence/gbp-card-state.ts`.
 *
 * @package peakhour-b2c
 */

/** How the api describes the whole surface. */
export type ReviewSummaryState = "awaiting_reviews" | "quiet_window" | "ready";

/** One row of `worstRecent`. */
export interface WorstReview {
  id: string;
  rating: number;
  excerpt: string;
  receivedAt: string;
  answered: boolean;
}

/** `GET /v1/presence/reviews/summary`. */
export interface ReviewSummary {
  state: ReviewSummaryState;
  days: number;
  windowStart: string;
  totalEver: number;
  volume: number;
  unanswered: number;
  unansweredInWindow: number;
  sampled: number;
  rating: number | null;
  ratedCount: number;
  respondedCount: number;
  timedCount: number;
  medianResponseMs: number | null;
  worstRecent: WorstReview[];
}

/**
 * Which halves of the card a state has anything to say with.
 *
 * ★★★THE FIGURES ARE OVER TWO DIFFERENT POPULATIONS, and treating an empty
 * WINDOW as an empty CARD hides the half that is not windowed. A merchant
 * whose imported corpus all predates the window, and who answered twenty
 * reviews this week, has `volume: 0` and therefore `quiet_window` — and the
 * card was dropping their reply time, their responded count and their
 * ALL-TIME unanswered figure while still offering to answer them. That is the
 * exact scenario the api's `summariseResponses` was rewritten for; throwing
 * it away on this side undoes the fix.
 *
 * ★`awaiting_reviews` GENUINELY HAS NOTHING, because nothing has ever
 * arrived: there is no review to be unanswered and no reply to have timed.
 */
export interface CardSections {
  /** Rating, volume and the worst list — all scoped to the window. */
  windowFigures: boolean;
  /** Unanswered (all time) and how fast we have been answering. */
  standingFigures: boolean;
}

export function cardSections(summary: ReviewSummary): CardSections {
  return {
    windowFigures: summary.state === "ready",
    standingFigures: summary.state !== "awaiting_reviews",
  };
}

export interface EmptyState {
  headline: string;
  body: string;
}

/**
 * What to say when there is nothing to chart, or nothing at all.
 *
 * ★★★THE TWO EMPTY STATES ARE DIFFERENT CLAIMS AND MUST READ DIFFERENTLY.
 * `awaiting_reviews` is a statement about OUR pipeline — nothing has ever
 * reached us — and today it is true of every account. `quiet_window` is a
 * statement about the merchant's quarter, and it comes with the all-time total
 * precisely so it cannot be misread as "you have no reviews": a business with
 * two hundred of them and a slow month must not be told they have none.
 *
 * ★AND NEITHER SAYS "YOU HAVE NO REVIEWS", because we do not know that. We know
 * what has reached us.
 */
export function reviewEmptyState(summary: ReviewSummary): EmptyState | null {
  if (summary.state === "ready") return null;
  if (summary.state === "awaiting_reviews") {
    return {
      headline: "No reviews have reached us yet",
      body:
        "Once your Business Profile is connected and Google starts sending us review " +
        "notifications, they land here and in your Inbox — worst first, with a reply you " +
        "can publish without leaving Peakhour.",
    };
  }
  return {
    headline: `No new reviews in the last ${summary.days} days`,
    body:
      `We have ${summary.totalEver} on file for you in total. Nothing new has come in over ` +
      "this period, which is a quiet spell rather than an empty listing.",
  };
}

/**
 * A duration a person would say out loud.
 *
 * ★★NOT `Intl.RelativeTimeFormat`, DELIBERATELY. This is a DURATION ("we answer
 * in about two hours"), not a point in time, and an Intl-formatted string would
 * change with the runtime's locale — which makes an assertion on it green here
 * and red on a CI box running en-US. Deterministic, and asserted as such.
 *
 * ⚠️`null` STAYS `null`. "0 minutes" is a claim that this merchant answers
 * instantly; the absence of a measurement is not a fast one.
 */
export function formatResponseTime(ms: number | null): string | null {
  if (ms === null) return null;
  // ★A REPLY IN THE SAME SECOND IS REAL — the api counts a zero latency — and
  // "0 minutes" reads as broken. This says what happened.
  if (ms < 60_000) return "under a minute";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(ms / 3_600_000);
  // ★TWO DAYS' WORTH OF HOURS, because "36 hours" is easier to judge than
  // "2 days" at that scale and "50 hours" is not.
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(ms / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Why the median is over fewer replies than were published, when it is.
 *
 * ★★★THE GAP IS A FACT, NOT AN EMBARRASSMENT. A reply published before the
 * review reached us — every reply an owner wrote in Google's own console before
 * connecting Peakhour — is a real answer we cannot time. Showing the median
 * without saying so implies it describes all of them; hiding the replies
 * entirely tells a merchant who answers everything that they answer nothing.
 */
export function responseCaveat(summary: ReviewSummary): string | null {
  // ⏸A `respondedCount === 0` GUARD STOOD HERE AND COULD NOT FIRE: `timedCount`
  // is never greater than `respondedCount`, so zero replies always satisfy the
  // line below and return the same null. The mutation harness found it. A guard
  // that cannot change an answer only looks like a check.
  if (summary.timedCount === summary.respondedCount) return null;
  if (summary.timedCount === 0) {
    // ⚠️PLURALISED LIKE EVERYTHING ELSE HERE. One console reply in the window
    // is the ROUTINE case, not an edge one — an owner who answered in Google's
    // app has a `replyPublishedAt` predating the row, so the latency is
    // negative and excluded — and "any of the 1 replies" is what a merchant
    // would have read.
    const plural = summary.respondedCount === 1 ? "reply" : "replies";
    return `We can't time ${summary.respondedCount === 1 ? "the" : "any of the"} ${summary.respondedCount} ${plural} in this period — ${summary.respondedCount === 1 ? "it was" : "they were"} published before the review${summary.respondedCount === 1 ? "" : "s"} reached us.`;
  }
  return `Timed over ${summary.timedCount} of ${summary.respondedCount} replies; the rest were published before the reviews reached us.`;
}

/**
 * Whether the averages are over everything, or over a page of it.
 *
 * ⚠️THE api CAPS ITS SAMPLE. `volume` is exact and `sampled` is what the rating
 * was actually computed from, and a merchant past the cap is entitled to know
 * that the number describes their most recent reviews rather than all of them.
 */
export function sampleCaveat(summary: ReviewSummary): string | null {
  if (summary.sampled >= summary.volume) return null;
  // ⚠️IT DESCRIBES THE SAMPLE, NOT THE AVERAGE. Saying "rating averaged over
  // the 500 most recent" put a sentence about 500 reviews directly above
  // "from 460 rated reviews" — the api averages only the ROWS THAT CARRY A
  // RATING and reports that as `ratedCount`, so the two numbers disagreed on
  // screen. This says what the page is actually built from; the rating's own
  // caption says how many of those were rated.
  return `Based on the ${summary.sampled} most recent of ${summary.volume} reviews.`;
}

/**
 * The rating, as it may be shown.
 *
 * ★★★`null` IS NOT `0.0`. A business whose reviews carry no star rating, or one
 * we have nothing for, has an UNKNOWN rating — and "0.0 ★" says its customers
 * rate it at nothing. There is no worse number to put on this card.
 */
export function ratingLabel(summary: ReviewSummary): string | null {
  if (summary.rating === null) return null;
  // ★ONE DECIMAL ALWAYS, so 4 and 4.3 do not sit in a row at different widths.
  return summary.rating.toFixed(1);
}

/** How many reviews the rating is over — the denominator, said out loud. */
export function ratingSubLabel(summary: ReviewSummary): string | null {
  if (summary.rating === null) return null;
  return `from ${summary.ratedCount} rated review${summary.ratedCount === 1 ? "" : "s"}`;
}

export interface UnansweredCta {
  label: string;
  href: string;
}

/**
 * The summary query's key, exported so the Inbox can invalidate it.
 *
 * ★★★ANSWERING A REVIEW CHANGES THIS CARD, AND NOTHING TOLD IT SO. The reply
 * flow invalidated only the Inbox's own list, and this query has a five-minute
 * `staleTime` with no refetch on focus — so a merchant who answered their last
 * waiting review and walked back to Presence was still offered "Answer 1
 * waiting review", for a review they had just answered.
 *
 * ★ONE DEFINITION, TWO READERS. A key spelled out in both places is a key that
 * drifts, and the drift is silent: the invalidation simply stops matching.
 */
export const REVIEW_SUMMARY_QUERY_KEY = ["presence-review-summary"] as const;

/** Where the Inbox's review lane lives. */
export const INBOX_REVIEWS_HREF = "/dashboard/inbox?tab=reviews";

/**
 * The one thing on this card a merchant can act on.
 *
 * ★★NOTHING TO SAY AT ZERO. A call to action that reads "0 waiting — answer
 * them" is noise on a card whose whole job is to be quiet when there is nothing
 * to do.
 *
 * ⚠️AND IT IS THE ALL-TIME FIGURE, matching the api: a review from four months
 * ago still needs answering, and a window would hide the oldest thing on the
 * list.
 */
export function unansweredCta(summary: ReviewSummary): UnansweredCta | null {
  if (summary.unanswered === 0) return null;
  return {
    label: `Answer ${summary.unanswered} waiting review${summary.unanswered === 1 ? "" : "s"}`,
    href: INBOX_REVIEWS_HREF,
  };
}

/** The Inbox's lanes. */
export type InboxTab = "conversations" | "leads" | "reviews";

/**
 * Which Inbox lane a `?tab=` value asks for.
 *
 * ★★SO THE CARD'S CALL TO ACTION LANDS ON THE REVIEWS TAB. Linking to
 * `/dashboard/inbox` alone drops somebody who clicked "answer 3 waiting
 * reviews" onto the Conversations lane, with the thing they asked for one
 * unexplained click away.
 *
 * ⚠️★★★A SEARCH PARAM RATHER THAN A FRAGMENT, and the difference is the whole
 * fix. A fragment can only be read off `window`, and on an IN-APP navigation
 * the App Router writes the new URL in HistoryUpdater's `useInsertionEffect` —
 * so a page with no `loading.tsx` mounts in the same commit and reads the
 * PREVIOUS page's fragment. The link worked on a hard load and failed on the
 * only path anybody takes. `useSearchParams` is subscribed to the router.
 *
 * ⚠️ANYTHING ELSE IS THE DEFAULT, never an error: a stale bookmark or a value
 * meant for something else must not leave the page showing no tab at all.
 */
export function inboxTabFromParam(value: string | null | undefined): InboxTab {
  if (value === "reviews" || value === "leads") return value;
  return "conversations";
}
