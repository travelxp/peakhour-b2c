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
  PRESENCE_ROUTE,
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

  it("★hasPublishedReply reads the published reply, not the draft", () => {
    expect(hasPublishedReply(row({ review: review({ replyDraft: "Sorry to hear that." }) }))).toBe(
      false,
    );
    expect(hasPublishedReply(row({ review: review({ replyPublished: "Sorry!" }) }))).toBe(true);
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
    expect(r.headline).toBe("This action requires editor or admin role");
    expect(r.description).toBe("Someone with editor access on this business can send it for you.");
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
});
