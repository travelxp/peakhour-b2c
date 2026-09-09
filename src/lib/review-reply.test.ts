/**
 * S0·4 — replying to a Google review from the Inbox.
 *
 * ★★★EVERY RULE HERE GUARDS TEXT PUBLISHED UNDER THE MERCHANT'S NAME BENEATH A
 * CUSTOMER'S REVIEW, on a page anyone can read. The failures are quiet ones: an
 * AI draft prefilled and sent by somebody who thought they were confirming; a
 * reply that IS live reported as a failure, so it goes out twice; a 503 on
 * Google's account listing reported as "reconnect your account".
 *
 * ⚠️THIS REPO HAS NO JSDOM, so a rule left inside the card is a rule nothing
 * asserts. Killer titles are load-bearing — `scripts/mutate-review-reply.mjs`
 * matches them for EQUALITY against vitest's JSON reporter.
 */
import { describe, it, expect } from "vitest";
import {
  checkReplyText,
  composerStateFor,
  hasPublishedReply,
  isRepliableReview,
  isRetryableRefusal,
  needsAnswer,
  PRESENCE_ROUTE,
  REVIEW_PAGE_LIMIT,
  reviewerLabel,
  reviewsAreTruncated,
  shouldAdoptPublishedReply,
  shouldRefreshAfter,
  TRANSPORT_ERROR_CODE,
  unansweredBadge,
  replyCharsRemaining,
  replyOutcome,
  replyRefusal,
  reviewQueueOrder,
  REVIEW_NETWORK,
  REVIEW_REPLY_MAX_LENGTH,
  REVIEW_SOURCE,
  unansweredReviewCount,
  unansweredReviews,
  type ReviewItemLike,
  type ReviewPayload,
} from "./review-reply";

const review = (over: Partial<ReviewPayload> = {}): ReviewPayload => ({
  network: REVIEW_NETWORK,
  externalReviewId: "accounts/1/locations/2/reviews/abc",
  rating: 3,
  ...over,
});

const row = (over: Partial<ReviewItemLike> = {}): ReviewItemLike => ({
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  source: REVIEW_SOURCE,
  status: "queued",
  body: "Coffee was cold.",
  review: review(),
  createdAt: "2026-09-01T09:00:00.000Z",
  ...over,
});

// ── Can this row be replied to at all ────────────────────────────────────────

describe("isRepliableReview — what the composer may be offered on", () => {
  it("★★offers the composer when all three facts are present", () => {
    expect(isRepliableReview(row())).toBe(true);
  });

  it("★★★refuses a row whose source is not a Google review", () => {
    expect(isRepliableReview(row({ source: "linkedin" }))).toBe(false);
  });

  it("★★★refuses a row whose network is not Business Profile", () => {
    // ⚠️A FUTURE NETWORK NORMALISED INTO THE SAME SOURCE would otherwise be
    // replied to through Google's API against an id Google never issued.
    expect(isRepliableReview(row({ review: review({ network: "yelp" }) }))).toBe(false);
  });

  it("★★★refuses a row with no network reference to reply to", () => {
    expect(isRepliableReview(row({ review: review({ externalReviewId: undefined }) }))).toBe(false);
  });

  it("★★treats a whitespace-only reference as absent", () => {
    expect(isRepliableReview(row({ review: review({ externalReviewId: "   " }) }))).toBe(false);
  });

  it("★★the source and the network are different strings", () => {
    // The channel key `googlebusiness` is a third string again — see
    // lib/listing-target.ts. Conflating any two of them is how an adapter
    // ships complete and unreachable.
    expect(REVIEW_SOURCE).toBe("google_review");
    expect(REVIEW_NETWORK).toBe("google_business_profile");
  });
});

// ── The badge ────────────────────────────────────────────────────────────────

describe("unansweredReviews — the number that makes somebody open the app", () => {
  it("★★★counts a review with no published reply", () => {
    expect(unansweredReviewCount([row()])).toBe(1);
    expect(unansweredReviewCount([row({ review: review({ replyPublished: "Thanks!" }) })])).toBe(0);
  });

  it("★★★stops counting one the merchant resolved or closed", () => {
    // They may have answered it in Google's own console. A badge that keeps
    // counting handled work is a badge people learn to ignore.
    expect(unansweredReviewCount([row({ status: "resolved" }), row({ status: "closed" })])).toBe(0);
    expect(unansweredReviewCount([row({ status: "in_review" })])).toBe(1);
  });

  it("★★counts a review we cannot reply to from here", () => {
    // It is still unanswered; the card says why it has to be answered on
    // Google. Netting it out would make the queue lie about its own size.
    expect(unansweredReviewCount([row({ review: review({ externalReviewId: "" }) })])).toBe(1);
  });

  it("★★treats a whitespace-only published reply as unanswered", () => {
    expect(unansweredReviewCount([row({ review: review({ replyPublished: "  " }) })])).toBe(1);
  });

  it("★an absent list counts zero rather than throwing", () => {
    expect(unansweredReviewCount(undefined)).toBe(0);
    expect(unansweredReviews(undefined)).toEqual([]);
  });

  it("★★★asks the same question the queue order asks", () => {
    // ⚠️THE BADGE AND THE SORT DISAGREEING is not a cosmetic problem: a review
    // answered in Google's own console and marked handled was netted out of
    // the count and still pinned to the TOP of the lane — a badge reading zero
    // above a list led by finished work.
    const handled = row({ status: "resolved" });
    expect(needsAnswer(handled)).toBe(false);
    expect(unansweredReviewCount([handled])).toBe(0);
    expect(reviewQueueOrder([handled, row({ _id: "open" })]).map((r) => r._id)).toEqual([
      "open",
      handled._id,
    ]);
  });

  it("★hasPublishedReply reads the published reply, not the draft", () => {
    expect(hasPublishedReply(row({ review: review({ replyDraft: "Sorry to hear that." }) }))).toBe(
      false,
    );
    expect(hasPublishedReply(row({ review: review({ replyPublished: "Sorry!" }) }))).toBe(true);
  });
});

describe("reviewsAreTruncated — a capped list says so", () => {
  it("★★★says a full page is a floor, not a total", () => {
    // ⚠️`GET /inbox` caps at 100 and sorts newest-first with no cursor, so the
    // rows dropped are the OLDEST — where an unanswered review has been
    // waiting longest. A badge that reports the page length as the answer
    // undercounts exactly the accounts with the most to answer.
    const page = Array.from({ length: REVIEW_PAGE_LIMIT }, (_, i) =>
      row({ _id: `id${i}`, createdAt: `2026-09-01T00:00:${String(i).padStart(2, "0")}.000Z` }),
    );
    expect(reviewsAreTruncated(page)).toBe(true);
    expect(reviewsAreTruncated(page.slice(0, REVIEW_PAGE_LIMIT - 1))).toBe(false);
  });

  it("★★an empty or absent list is not a truncated one", () => {
    expect(reviewsAreTruncated([])).toBe(false);
    expect(reviewsAreTruncated(undefined)).toBe(false);
  });

  it("★asks the api for exactly the page it can serve", () => {
    expect(REVIEW_PAGE_LIMIT).toBe(100);
  });
});

describe("unansweredBadge — what the tab is allowed to claim", () => {
  const page = (n: number, over: Partial<ReviewItemLike> = {}) =>
    Array.from({ length: n }, (_, i) => row({ _id: `id${i}`, ...over }));

  it("★★★says nothing at all when nothing has been fetched", () => {
    // An in-flight or failed fetch has not earned a zero, and a tab with no
    // badge is what "we have not been told" looks like.
    expect(unansweredBadge(undefined)).toBeNull();
  });

  it("★★★shows a badge on a truncated page even when its count is zero", () => {
    // ⚠️THE GATE THAT HID IT: `count > 0`. A merchant whose hundred NEWEST
    // reviews are all answered may have older ones that are not, and a silent
    // tab tells them the opposite of what we know.
    const allAnswered = page(REVIEW_PAGE_LIMIT, {
      review: review({ replyPublished: "Thanks!" }),
    });
    expect(unansweredBadge(allAnswered)).toEqual({ label: "0+" });
  });

  it("★★★marks a truncated count as a floor, not a total", () => {
    const capped = page(REVIEW_PAGE_LIMIT);
    expect(unansweredBadge(capped)).toEqual({ label: `${REVIEW_PAGE_LIMIT}+` });
  });

  it("★★shows a bare number when the whole list arrived", () => {
    expect(unansweredBadge(page(3))).toEqual({ label: "3" });
  });

  it("★★shows nothing when a complete list has nothing waiting", () => {
    expect(unansweredBadge(page(3, { review: review({ replyPublished: "Thanks!" }) }))).toBeNull();
    expect(unansweredBadge([])).toBeNull();
  });
});

// ── The order it is worked in ────────────────────────────────────────────────

describe("reviewQueueOrder — worst first, oldest first", () => {
  const answered = row({
    _id: "answered",
    review: review({ rating: 1, replyPublished: "We're sorry." }),
    createdAt: "2026-09-01T00:00:00.000Z",
  });
  const oneStar = row({
    _id: "onestar",
    review: review({ rating: 1 }),
    createdAt: "2026-09-05T00:00:00.000Z",
  });
  const fiveStar = row({
    _id: "fivestar",
    review: review({ rating: 5 }),
    createdAt: "2026-09-06T00:00:00.000Z",
  });

  it("★★★puts unanswered reviews above answered ones", () => {
    expect(reviewQueueOrder([answered, fiveStar]).map((r) => r._id)).toEqual([
      "fivestar",
      "answered",
    ]);
  });

  it("★★★puts the angriest unanswered review first", () => {
    // `createdAt DESC` — what the api returns — buries a week-old one-star
    // under today's five-stars.
    expect(reviewQueueOrder([fiveStar, oneStar]).map((r) => r._id)).toEqual([
      "onestar",
      "fivestar",
    ]);
  });

  it("★★sorts a review with no rating with the middle, not with the one-stars", () => {
    const noRating = row({
      _id: "norating",
      review: review({ rating: undefined }),
      createdAt: "2026-09-07T00:00:00.000Z",
    });
    expect(reviewQueueOrder([fiveStar, noRating, oneStar]).map((r) => r._id)).toEqual([
      "onestar",
      "norating",
      "fivestar",
    ]);
  });

  it("★★breaks a rating tie by oldest first", () => {
    const older = row({ _id: "older", review: review({ rating: 2 }), createdAt: "2026-08-01T00:00:00.000Z" });
    const newer = row({ _id: "newer", review: review({ rating: 2 }), createdAt: "2026-09-01T00:00:00.000Z" });
    expect(reviewQueueOrder([newer, older]).map((r) => r._id)).toEqual(["older", "newer"]);
  });

  it("★★orders two rows sharing a timestamp deterministically", () => {
    const a = row({ _id: "aaa", review: review({ rating: 4 }), createdAt: "2026-09-02T00:00:00.000Z" });
    const b = row({ _id: "bbb", review: review({ rating: 4 }), createdAt: "2026-09-02T00:00:00.000Z" });
    expect(reviewQueueOrder([b, a]).map((r) => r._id)).toEqual(["aaa", "bbb"]);
  });

  it("★does not mutate the array it was given", () => {
    const input = [fiveStar, oneStar];
    reviewQueueOrder(input);
    expect(input.map((r) => r._id)).toEqual(["fivestar", "onestar"]);
  });
});

// ── What goes in the box ─────────────────────────────────────────────────────

describe("composerStateFor — what the merchant is handed", () => {
  it("★★★never prefills the box with the AI draft", () => {
    // A prefilled draft makes Send a one-click publish of machine-written
    // words under the merchant's name, beneath a customer's review.
    const state = composerStateFor(row({ review: review({ replyDraft: "Sorry to hear that!" }) }));
    expect(state.initialText).toBe("");
  });

  it("★★★offers the AI draft as a suggestion rather than as the send body", () => {
    const state = composerStateFor(row({ review: review({ replyDraft: "Sorry to hear that!" }) }));
    expect(state.suggestion).toBe("Sorry to hear that!");
    expect(state.canSend).toBe(true);
  });

  it("★★prefills the box with the reply already published, so editing means editing", () => {
    const state = composerStateFor(row({ review: review({ replyPublished: "Thanks, Jo!" }) }));
    expect(state.initialText).toBe("Thanks, Jo!");
    expect(state.published).toBe("Thanks, Jo!");
  });

  it("★★prefills the published reply even when a draft also exists", () => {
    const state = composerStateFor(
      row({ review: review({ replyPublished: "Thanks, Jo!", replyDraft: "Sorry to hear that!" }) }),
    );
    expect(state.initialText).toBe("Thanks, Jo!");
    expect(state.suggestion).toBe("Sorry to hear that!");
  });

  it("★★★will not offer a send on a row the api refuses, and says why", () => {
    const state = composerStateFor(row({ review: review({ network: "yelp" }) }));
    expect(state.canSend).toBe(false);
    expect(state.blockedReason).toContain("network");
  });

  it("★★says a missing reference has to be answered on Google, not that the network is unsupported", () => {
    // Two branches, two different sentences: asserting only that SOME reason
    // is present is satisfied by either version.
    const state = composerStateFor(row({ review: review({ externalReviewId: "" }) }));
    expect(state.canSend).toBe(false);
    expect(state.blockedReason).toContain("Business Profile");
    expect(state.blockedReason).not.toContain("network");
  });

  it("★a blank draft is no suggestion at all", () => {
    expect(composerStateFor(row({ review: review({ replyDraft: "   " }) })).suggestion).toBeUndefined();
  });
});

// ── The words themselves ─────────────────────────────────────────────────────

describe("checkReplyText — Google's limit, not the collection's", () => {
  it("★★★refuses an empty reply", () => {
    expect(checkReplyText("   ")).toEqual({
      ok: false,
      code: "EMPTY_REPLY",
      message: "A reply needs something in it.",
    });
  });

  it("★★★refuses a reply longer than Google's 4096", () => {
    const over = checkReplyText("x".repeat(REVIEW_REPLY_MAX_LENGTH + 1));
    expect(over.ok).toBe(false);
    expect(over.ok === false && over.code).toBe("REPLY_TOO_LONG");
  });

  it("★★★names Google's 4096, not the 5000 the collection stores", () => {
    // ⚠️`sup_inbox.replyPublished` is capped at 5000 for storage. Counting
    // down to THAT lets a merchant write 4500 characters and be refused by a
    // server they cannot argue with.
    expect(REVIEW_REPLY_MAX_LENGTH).toBe(4096);
    const over = checkReplyText("x".repeat(4200));
    expect(over.ok === false && over.message).toBe(
      "Google allows 4096 characters; this reply is 4200.",
    );
  });

  it("★★accepts a reply of exactly the limit", () => {
    expect(checkReplyText("x".repeat(REVIEW_REPLY_MAX_LENGTH)).ok).toBe(true);
  });

  it("★★measures the limit against the trimmed text", () => {
    const padded = ` ${"x".repeat(REVIEW_REPLY_MAX_LENGTH)} `;
    expect(checkReplyText(padded).ok).toBe(true);
  });

  it("★sends the trimmed text, not what was typed", () => {
    const checked = checkReplyText("  Thanks for coming in!  ");
    expect(checked.ok === true && checked.comment).toBe("Thanks for coming in!");
  });

  it("★★counts down to Google's limit, and past it", () => {
    // Clamping at zero tells somebody 1200 characters over that they have
    // "0 left" and leaves them deleting blindly.
    expect(replyCharsRemaining("abc")).toBe(REVIEW_REPLY_MAX_LENGTH - 3);
    expect(replyCharsRemaining("x".repeat(REVIEW_REPLY_MAX_LENGTH + 42))).toBe(-42);
  });
});

// ── What came back ───────────────────────────────────────────────────────────

describe("replyOutcome — two successes that look like failures", () => {
  it("★★an ordinary success says the reply is live", () => {
    const out = replyOutcome({ sent: true, recorded: true });
    expect(out.kind).toBe("published");
    expect(out.headline).toBe("Your reply is live on Google.");
  });

  it("★★★treats sent-but-not-recorded as a success, not a failure", () => {
    // The reply IS on the customer's review; only our row is missing it.
    expect(replyOutcome({ sent: true, recorded: false }).kind).toBe("published_unrecorded");
    expect(replyOutcome({ sent: true, recorded: false }).headline).toBe(
      "Your reply is live on Google.",
    );
  });

  it("★★★tells the merchant NOT to send it again when we could not file it", () => {
    // Without this sentence the merchant re-sends, and a second reply lands
    // on a public listing on top of the first.
    const out = replyOutcome({ sent: true, recorded: false });
    expect(out.description).toContain("Don't send it again");
  });

  it("★★★treats an unchanged reply as nothing-to-do, not as a failure", () => {
    const out = replyOutcome({ sent: false, reason: "unchanged" });
    expect(out.kind).toBe("unchanged");
    expect(out.headline).toBe("That's already your published reply.");
  });

  it("★★★offers the override only on the unchanged answer", () => {
    // ⚠️`force` is the ONLY way back from a reply deleted in Google's own
    // console — our row still holds the text, so an un-forced re-send does
    // nothing while telling the merchant it worked.
    expect(replyOutcome({ sent: false, reason: "unchanged" }).offerForce).toBe(true);
    expect(replyOutcome({ sent: true, recorded: true }).offerForce).toBe(false);
    expect(replyOutcome({ sent: true, recorded: false }).offerForce).toBe(false);
  });

  it("★an api that omits `recorded` is a plain success, not an unrecorded one", () => {
    expect(replyOutcome({ sent: true }).kind).toBe("published");
  });

  it("★★★does NOT refresh the list on the one outcome whose row has gone", () => {
    // ⚠️`recorded: false` IS `matchedCount === 0` — the row is not in the
    // collection any more, so a refetch returns a list without it, React
    // unmounts the card, and the only place the words "your reply is live,
    // don't send it again" appear goes with it.
    expect(shouldRefreshAfter(replyOutcome({ sent: true, recorded: false }))).toBe(false);
    expect(shouldRefreshAfter(replyOutcome({ sent: true, recorded: true }))).toBe(true);
    expect(shouldRefreshAfter(replyOutcome({ sent: false, reason: "unchanged" }))).toBe(true);
  });
});

describe("shouldAdoptPublishedReply — a reply that arrives after the box was seeded", () => {
  it("★★★adopts a reply published while the card was open", () => {
    // A colleague answering the same review left this card reading "Update
    // reply" over an EMPTY, send-disabled box.
    expect(shouldAdoptPublishedReply({ dirty: false, seen: undefined, incoming: "Thanks Jo!" })).toBe(
      true,
    );
  });

  it("★★★never overwrites what the merchant has typed", () => {
    // Their half-written public reply, gone with no undo, is worse than a
    // stale box.
    expect(shouldAdoptPublishedReply({ dirty: true, seen: undefined, incoming: "Thanks Jo!" })).toBe(
      false,
    );
  });

  it("★★never clears the box because a row stopped reporting a reply", () => {
    expect(shouldAdoptPublishedReply({ dirty: false, seen: "Thanks Jo!", incoming: undefined })).toBe(
      false,
    );
  });

  it("★★does nothing when the published reply has not changed", () => {
    expect(
      shouldAdoptPublishedReply({ dirty: false, seen: "Thanks Jo!", incoming: "Thanks Jo!" }),
    ).toBe(false);
  });
});

describe("reviewerLabel — whose review this is", () => {
  it("★★★names the customer the webhook actually recorded", () => {
    // ⚠️THE GBP WEBHOOK WRITES NO `contact` ON A REVIEW ROW. It puts the
    // reviewer in the SUBJECT, so a card reading only `contact.name` showed
    // "A customer" above every review in the inbox.
    expect(reviewerLabel(row({ subject: "New 4★ review from Jo Smith" }))).toBe("Jo Smith");
  });

  it("★★★renders a name, not our own sentence about the review", () => {
    // The subject is `New 4★ review from Jo Smith` — beside a drawn star row
    // it repeats the rating, and for a reviewer Google named nobody for it
    // puts the words "New 4★ review" where a person's name goes.
    const label = reviewerLabel(row({ subject: "New 4★ review from Jo Smith" }));
    expect(label).not.toContain("review");
    expect(label).not.toContain("★");
  });

  it("★★★says A customer when Google gave us no name", () => {
    expect(reviewerLabel(row({ subject: "New 4★ review" }))).toBe("A customer");
  });

  it("★★keeps a name that has the word from inside it", () => {
    expect(reviewerLabel(row({ subject: "New 5★ review from Jo from Bristol" }))).toBe(
      "Jo from Bristol",
    );
  });

  it("★★prefers a structured contact name when a writer sets one", () => {
    // ⚠️THE TWO NAMES MUST DIFFER. A fixture whose contact name and subject
    // author are the same string cannot reach this branch: dropping the
    // contact check entirely gives the identical answer, and the mutation
    // harness said so.
    expect(
      reviewerLabel(
        row({ contact: { name: "Jo Smith" }, subject: "New 4★ review from Someone Else" }),
      ),
    ).toBe("Jo Smith");
  });

  it("★falls back to a person rather than to nothing", () => {
    expect(reviewerLabel(row({ subject: "   " }))).toBe("A customer");
    expect(reviewerLabel(row({ subject: undefined }))).toBe("A customer");
  });
});

// ── What went wrong ──────────────────────────────────────────────────────────

describe("replyRefusal — whose problem is it", () => {
  it("★★★never tells a merchant to fix a connection that is not broken", () => {
    // LISTING_LOOKUP_INCOMPLETE is a 503 on Google's account listing. The
    // api's own message ends "Retrying." — true of the publisher adapter it
    // was written for, and FALSE here: this route retries nothing.
    const r = replyRefusal({
      code: "LISTING_LOOKUP_INCOMPLETE",
      status: 503,
      message:
        "Could not list every Business Profile account for this connection, so the location's " +
        "owning account is unknown — locations/2 may well be fine. Retrying.",
    });
    expect(r.kind).toBe("retry");
    expect(r.headline).toBe("Couldn't check your listing just now.");
    expect(r.description).toBe("Nothing's wrong with your connection — try again in a moment.");
    expect(r.href).toBeUndefined();
  });

  it("★★★sends a rate limit and an upstream wobble back to the button, not to support", () => {
    expect(replyRefusal({ code: "RATE_LIMITED", status: 429 }).kind).toBe("retry");
    expect(replyRefusal({ code: "UPSTREAM_ERROR", status: 502 }).kind).toBe("retry");
  });

  it("★★★never renders Google's own rejection text", () => {
    // REPLY_REJECTED carries `GoogleApiError.message` — the provider's raw
    // response body, which is what `no-raw-ai-errors-to-users` forbids.
    const raw = "Request contains an invalid argument: profile 1234 policy REVIEW_REPLY_SPAM";
    const r = replyRefusal({ code: "REPLY_REJECTED", status: 400, message: raw });
    expect(r.headline).toBe("Google wouldn't accept that reply.");
    expect(r.headline).not.toContain("REVIEW_REPLY_SPAM");
    expect(r.description).not.toContain("REVIEW_REPLY_SPAM");
    expect(r.kind).toBe("fix_text");
  });

  it("★★★points a reauth at Presence, where the picker and the connect button are", () => {
    // It pointed at Integrations once, where a merchant finds the connection
    // and no way to choose a location — sent to a screen for an action that
    // is not on it.
    expect(replyRefusal({ code: "REAUTH_REQUIRED", status: 409 }).href).toBe(PRESENCE_ROUTE);
    expect(replyRefusal({ code: "NOT_CONNECTED", status: 409 }).href).toBe(PRESENCE_ROUTE);
    expect(replyRefusal({ code: "REAUTH_REQUIRED", status: 409 }).kind).toBe("reconnect");
  });

  it("★★★distinguishes nothing-picked from a listing this account does not manage", () => {
    // Both are 409s about a location, and both are `pick_location` — but the
    // second is "connect the account that manages it", which a merchant with
    // one healthy connection and the wrong listing cannot guess.
    const nothing = replyRefusal({ code: "NO_LOCATION_PICKED", status: 409 });
    const unmanaged = replyRefusal({ code: "LOCATION_NOT_MANAGED", status: 409 });
    expect(nothing.kind).toBe("pick_location");
    expect(unmanaged.kind).toBe("pick_location");
    expect(nothing.description).toBe("Pick which of your locations this is, on Presence.");
    expect(unmanaged.description).toBe(
      "Re-pick the location on Presence, or connect the account that manages it.",
    );
  });

  it("★★renders the api's own sentence when the api wrote one", () => {
    const authored = "No Business Profile location is selected — pick one on Presence, then reply.";
    expect(replyRefusal({ code: "NO_LOCATION_PICKED", status: 409, message: authored }).headline).toBe(
      authored,
    );
  });

  it("★★falls back to our own sentence when the api sent no message", () => {
    expect(replyRefusal({ code: "NO_LOCATION_PICKED", status: 409 }).headline).toBe(
      "No Business Profile location is selected.",
    );
  });

  it("★★★treats an unknown code as ours, never as retryable", () => {
    // A code we have never seen reported as "try again in a moment" is how
    // somebody clicks Send forty times against a permanent failure.
    const r = replyRefusal({ code: "SOMETHING_NEW", status: 500, requestId: "req_9" });
    expect(r.kind).toBe("unhandled");
    expect(isRetryableRefusal(r)).toBe(false);
  });

  it("★★quotes the request id support needs", () => {
    expect(replyRefusal({ code: "SOMETHING_NEW", status: 500, requestId: "req_9" }).description).toBe(
      "Our team has the details — contact support and quote reference req_9.",
    );
    expect(replyRefusal({ code: "SOMETHING_NEW", status: 500 }).description).toBe(
      "Our team has the details — please contact support.",
    );
  });

  it("★★answers a role refusal about the person, not about the review", () => {
    const r = replyRefusal({
      code: "FORBIDDEN",
      status: 403,
      message: "This action requires editor or admin role",
    });
    expect(r.kind).toBe("no_permission");
    expect(r.description).toBe("Publishing a reply needs editor access to this business.");
  });

  it("★★★never renders requireRole's internal wording as the headline", () => {
    // ⚠️THE ROUTE SENDS THREE DIFFERENT STRINGS THROUGH THIS ONE CODE:
    // "This action requires editor or admin role", "Insufficient permissions"
    // and "No roles assigned" — the last two being internal wording, and a
    // fourth ("Active business required") not about roles at all. Passing the
    // message through made our own merchant-facing headline unreachable.
    for (const message of [
      "Insufficient permissions",
      "No roles assigned",
      "Active business required",
      "This action requires editor or admin role",
    ]) {
      expect(replyRefusal({ code: "FORBIDDEN", status: 403, message }).headline).toBe(
        "You don't have permission to reply on this business's behalf.",
      );
    }
  });

  it("★★★says a vanished row is gone rather than sending it to support", () => {
    // Reachable two ways, neither a ticket: a 30s staleTime with no
    // refetch-on-focus outlives the row, and `app.onError`'s unknown-route
    // handler answers NOT_FOUND — so b2c shipping ahead of the api would tell
    // every merchant to raise one.
    const r = replyRefusal({ code: "NOT_FOUND", status: 404, message: "Inbox item not found" });
    expect(r.kind).toBe("not_repliable");
    expect(r.headline).toBe("This review isn't in your inbox any more.");
    expect(r.description).toBe("Reload the page to see what's there now.");
  });

  it("★★★never shows a merchant a raw locations/{id} or a second screen to go to", () => {
    // `classifyParentLookup` interpolates the internal listing id AND ends
    // "Re-pick the location on the Business Profile integration" — a different
    // screen from the one this module's own second sentence names. One refusal
    // cannot point at two places.
    const r = replyRefusal({
      code: "LOCATION_NOT_MANAGED",
      status: 409,
      message:
        "locations/12345 is not under any Business Profile account this connection manages. " +
        "Re-pick the location on the Business Profile integration.",
    });
    expect(r.headline).not.toContain("locations/12345");
    expect(r.headline).not.toContain("integration");
    expect(r.headline).toBe(
      "This listing isn't under the Business Profile account we're connected to.",
    );
  });

  it("★★★says this one has to be answered on Google rather than offering a retry", () => {
    for (const code of [
      "NOT_A_REVIEW",
      "UNSUPPORTED_NETWORK",
      "NO_REVIEW_REFERENCE",
      "UNRECOGNISED_REVIEW_REFERENCE",
    ]) {
      const r = replyRefusal({ code, status: 400 });
      expect(r.kind).toBe("not_repliable");
      expect(isRetryableRefusal(r)).toBe(false);
      expect(r.href).toBeUndefined();
    }
  });

  it("★★keeps the words in the composer when the words are the problem", () => {
    for (const code of ["EMPTY_REPLY", "REPLY_TOO_LONG", "VALIDATION_ERROR"]) {
      expect(replyRefusal({ code, status: 400 }).kind).toBe("fix_text");
    }
  });

  it("★★only the transient refusals get the button back", () => {
    expect(isRetryableRefusal(replyRefusal({ code: "LISTING_LOOKUP_INCOMPLETE", status: 503 }))).toBe(
      true,
    );
    expect(isRetryableRefusal(replyRefusal({ code: "LOCATION_NOT_MANAGED", status: 409 }))).toBe(
      false,
    );
    expect(isRetryableRefusal(replyRefusal({ code: "REPLY_REJECTED", status: 400 }))).toBe(false);
  });

  it("★an error with no code at all is ours, not a retry", () => {
    expect(replyRefusal({}).kind).toBe("unhandled");
  });

  it("★★★sends a merchant's own dropped connection back to the button, not to support", () => {
    // A `fetch` that throws never becomes an ApiError — offline, DNS, CORS.
    // Telling somebody to contact support about their wifi is a ticket no
    // agent can close.
    const r = replyRefusal({ code: TRANSPORT_ERROR_CODE });
    expect(r.kind).toBe("retry");
    expect(isRetryableRefusal(r)).toBe(true);
    expect(r.headline).toBe("Couldn't reach Peakhour.");
  });

  it("★★★never claims nothing was sent when we never got an answer", () => {
    // ⚠️A REQUEST THAT REACHED THE ROUTE AND THEN LOST ITS CONNECTION may well
    // have published the reply. "Nothing was sent" is the same false certainty
    // the `recorded: false` branch exists to avoid; what IS true is that a
    // repeat is harmless, because Google's reply endpoint is a PUT.
    for (const code of [TRANSPORT_ERROR_CODE, "PARSE_ERROR"]) {
      const r = replyRefusal({ code });
      expect(r.description).toBe(
        "Check your connection and try again — re-sending the same words is safe.",
      );
      expect(r.description).not.toContain("nothing was sent");
    }
  });

  it("★★a non-JSON body is the gateway wobbling, not our route answering", () => {
    expect(replyRefusal({ code: "PARSE_ERROR", status: 502 }).kind).toBe("retry");
  });

  it("★★★never renders zod's own English as merchant copy", () => {
    // The route builds VALIDATION_ERROR's message from
    // `parsed.error.issues[0].message`, which is zod's wording — or "Invalid
    // item id", which is about a URL the merchant never typed.
    const r = replyRefusal({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "String must contain at least 1 character(s)",
    });
    expect(r.headline).toBe("That reply couldn't be sent as written.");
    expect(r.headline).not.toContain("character(s)");
  });

  it("★★says nothing about Google when nothing reached Google", () => {
    // VALIDATION_ERROR is our own request being refused before it left. Saying
    // "Google wouldn't accept that" sends the merchant looking at their
    // listing for a problem that is not there.
    expect(replyRefusal({ code: "VALIDATION_ERROR", status: 400 }).headline).not.toContain("Google");
  });

  it("★★gives advice that is true of every FORBIDDEN the route can emit", () => {
    // It answers this code for "Insufficient permissions", "No roles assigned"
    // AND "Active business required" — telling the last of those to ask a
    // colleague for editor access is advice that cannot fix it.
    expect(replyRefusal({ code: "FORBIDDEN", status: 403 }).description).toBe(
      "Publishing a reply needs editor access to this business.",
    );
  });
});
