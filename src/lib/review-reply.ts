/**
 * Replying to a Google review from the Inbox — the decisions, kept where they
 * can be tested (plan S0·4).
 *
 * ★★★WHAT THIS SCREEN DOES IS PUBLISH TEXT UNDER THE MERCHANT'S NAME BENEATH A
 * CUSTOMER'S REVIEW, on their Google Maps and Search listing — a page anyone can
 * read and the merchant cannot take back from here. Everything in this file
 * exists because the ways that goes wrong are quiet:
 *
 *   - an AI DRAFT prefilled into the box and sent by somebody who thought they
 *     were confirming, not authoring;
 *   - `sent: true, recorded: false` rendered as a failure, so the merchant
 *     writes the reply again and the customer gets two;
 *   - a retryable listing lookup reported as "reconnect your account", sending
 *     somebody to re-authorise a connection that was never broken;
 *   - Google's own rejection text — the api's `REPLY_REJECTED` message is the
 *     provider's raw words — rendered to a merchant as if we had written it.
 *
 * ⚠️THIS REPO RUNS VITEST WITHOUT JSDOM. A rule inside a component is a rule
 * nothing asserts, which is why this module holds the rules and
 * `components/inbox/review-reply-card.tsx` holds only the markup — the same
 * split as `presence/network-card-state.ts` and `lib/listing-target.ts`.
 *
 * ⏸AND THE RULES NOW EXIST TWICE. `peakhour-api/src/v1/helpers/review-reply.ts`
 * is the authority — it is what actually refuses — and this is a pre-flight so
 * the merchant is not told about a 4096-character limit by a round trip. The
 * proper fix is the api serving its constraint set, the same fix the Local Post
 * rules and the measurement-health repair table both need. Recorded, not
 * implied: the numbers below are COPIES, and the server re-asks every one.
 *
 * @package peakhour-b2c
 */

import { REVIEW_PAGE_LIMIT } from "@/lib/review-page-limit";

/**
 * What the api says about replying to one review (PE-R): the network's own words and whether it takes a reply at all. It is the adapter's
 * declaration, served on every review row of `GET /v1/support/inbox` as `replyChannel`, so this module holds no network's name, source or
 * cap. Null (or absent, on an older api) means the row names no network the engine knows, and no reply control is drawn.
 */
export interface ReplyChannel {
  /** How a merchant hears the network: the adapter's label. */
  label: string;
  /** The network declares replies and can send one. False: no reply control, and the card says why. */
  canReply: boolean;
  /** The longest reply that can be sent (the network's cap, never above what the inbox stores), or null from an older api (no count is shown then). */
  maxLength: number | null;
  /**
   * Sending a reply again REPLACES the one on the network. Only then may this module promise that a re-send is harmless, offer to edit a
   * published reply, or offer "send it again". Absent or false: a second send may post a second reply.
   */
  replacesReply?: boolean;
}

/** The word used where a network's label is not known. Never a guessed network. */
const NO_LABEL = "the network";

/** A sentence that starts with the label must start with a capital, whether it is a network's name or the plain word. */
export const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Where a merchant picks or re-picks the listing, and reconnects. */
export const PRESENCE_ROUTE = "/dashboard/presence";

/** `sup_inbox.review`, as the api serialises it. */
export interface ReviewPayload {
  network?: string;
  externalReviewId?: string;
  rating?: number;
  language?: string;
  /** An AI-written SUGGESTION pending approval. ⚠️Never the send body. */
  replyDraft?: string;
  /** What we last published to the listing. */
  replyPublished?: string;
  replyPublishedAt?: string;
  /** Google's moderation result. Absent means Google reported none. */
  replyState?: "pending" | "approved" | "rejected";
  /** The words Google refused. Never live, so never `replyPublished`. */
  replyRejectedText?: string;
  /** Google's reason code, which it may add to at any time. */
  replyPolicyViolation?: string;
}

/** Just enough of an inbox row to answer everything below. */
export interface ReviewItemLike {
  _id: string;
  source: string;
  status: string;
  subject?: string;
  contact?: { name?: string };
  body?: string;
  review?: ReviewPayload;
  /** From the network's adapter (PE-R). Absent or null: no reply control. */
  replyChannel?: ReplyChannel | null;
  createdAt: string;
}

/**
 * Whose review this is, as far as the row can say.
 *
 * ★★★THE WEBHOOK WRITES NO `contact` ON A REVIEW ROW. It puts the reviewer in
 * the SUBJECT — `New 4★ review from Jo Smith` — so a card reading only
 * `contact.name` showed "A customer" above every review in the inbox, and the
 * one field carrying the customer's name was never rendered at all.
 *
 * ★`contact` STILL COMES FIRST, because a future writer for another network
 * would populate it properly and this should prefer the structured field the
 * day one does.
 */
export function reviewerLabel(item: ReviewItemLike): string {
  const contact = item.contact?.name?.trim();
  if (contact) return contact;
  // ★THE SUBJECT IS OUR OWN SENTENCE, NOT A NAME. The webhook builds it as
  // `New ${rating}★ review${author ? ` from ${author}` : ""}`, so rendering it
  // whole beside the star row said "New 4★ review from Jo Smith" next to four
  // drawn stars — and, for a reviewer Google gave no name for, put the words
  // "New 4★ review" where a person's name goes.
  //
  // ⚠️A FORMAT CHANGE DEGRADES TO "A customer", never to a wrong name: no
  // " from ", no author.
  const author = /\sfrom\s(.+)$/.exec(item.subject?.trim() ?? "")?.[1]?.trim();
  return author || "A customer";
}

// ── Can this row be replied to at all ────────────────────────────────────────

/** The network's label for this row, or the plain word when the api named none. */
export function networkWords(item: ReviewItemLike): string {
  return item.replyChannel?.label?.trim() || NO_LABEL;
}

/** The network's cap on a reply for this row, or null when it declared none. */
export function replyLimitOf(item: ReviewItemLike): number | null {
  return item.replyChannel?.maxLength ?? null;
}

/**
 * Does this row carry a review we can publish a reply to?
 *
 * ★TWO FACTS: the api says the row's network declares replies (`replyChannel.canReply`, from the adapter, which is the only place that
 * knows), and the row holds the network's reference to the review, which is the thing the network is asked about. Either missing gets an
 * explanation instead of a composer: offering a Send that the api answers 400 to is worse than saying up front that this one has to be
 * answered on the network.
 */
export function isRepliableReview(item: ReviewItemLike): boolean {
  if (item.replyChannel?.canReply !== true) return false;
  return Boolean(item.review?.externalReviewId?.trim());
}

/** Has a reply been published to the listing for this row? */
export function hasPublishedReply(item: ReviewItemLike): boolean {
  return Boolean(item.review?.replyPublished?.trim());
}

// ── The badge ────────────────────────────────────────────────────────────────

/**
 * Is this review still waiting on somebody?
 *
 * ★★TWO CONDITIONS, AND THE SECOND IS THE ONE THAT KEEPS IT HONEST. A review
 * needs an answer when nothing has been published for it AND the merchant has
 * not already dealt with it — `resolved` / `closed` is a person saying
 * "handled", possibly by answering in Google's own console, and a queue that
 * keeps counting those is a queue people learn to ignore.
 *
 * ★★★ONE PREDICATE, TWO READERS, DELIBERATELY. The badge and the sort order
 * both ask this question, and when they asked it separately they disagreed: a
 * review answered in Google's console and marked handled was excluded from the
 * count and still pinned to the TOP of the lane — a badge reading zero above a
 * list led by work that is finished.
 */
export function needsAnswer(item: ReviewItemLike): boolean {
  return !hasPublishedReply(item) && item.status !== "resolved" && item.status !== "closed";
}

/**
 * The reviews still waiting on somebody — the number that makes them open the app.
 *
 * ★A REVIEW WE CANNOT REPLY TO FROM HERE STILL COUNTS. It is still an
 * unanswered review; the card says why it has to be answered on Google. Netting
 * those out would make the queue lie about its own size.
 */
export function unansweredReviews<T extends ReviewItemLike>(
  items: readonly T[] | undefined,
): T[] {
  return (items ?? []).filter(needsAnswer);
}

/** `unansweredReviews().length`, for the tab badge. */
export function unansweredReviewCount(items: readonly ReviewItemLike[] | undefined): number {
  return unansweredReviews(items).length;
}

/** What the tab shows, or nothing at all. */
export interface UnansweredBadge {
  label: string;
}

/**
 * The badge, including the case where the number is a floor.
 *
 * ★★★"NO BADGE" IS A CLAIM THAT NOTHING IS WAITING, and only two things earn
 * it: a complete page with nothing unanswered in it, or no data at all — where
 * we say nothing rather than say zero. A TRUNCATED page has earned neither. A
 * merchant whose hundred newest reviews are all answered may have older ones
 * that are not, and a silent tab tells them the opposite of what we know.
 *
 * ★AND THE "+" IS THE HONEST PART. `100+` and `0+` both say the same thing:
 * this is what arrived, there is more behind it.
 */
export function unansweredBadge(
  items: readonly ReviewItemLike[] | undefined,
): UnansweredBadge | null {
  const count = unansweredReviewCount(items);
  const truncated = reviewsAreTruncated(items);
  // ⚠️AN IN-FLIGHT OR FAILED FETCH IS NOT A ZERO — it lands here as `undefined`,
  // counts nothing and is not truncated, and gets no badge. That is the same
  // answer as a complete list with nothing waiting, deliberately: a tab with no
  // badge is what "nothing to do, or we have not been told" looks like, and the
  // pane below says which.
  //
  // ⏸AN EXPLICIT `if (!items) return null;` STOOD HERE AND COULD NOT FIRE —
  // this line already answers `undefined` identically. The mutation harness
  // found it; a guard that cannot change an answer is a guard that only looks
  // like a check.
  if (count === 0 && !truncated) return null;
  return { label: truncated ? `${count}+` : String(count) };
}

/**
 * Did we ask for everything, or just the first page of it?
 *
 * ★★A CAPPED LIST MUST SAY SO RATHER THAN LOOK COMPLETE. The badge counts what
 * arrived; when a full page arrived, "7" is a floor and not a total, and the
 * lane renders it as such. Pretending otherwise reports a smaller number than
 * the truth on exactly the accounts with the most reviews to answer.
 *
 * ⏸THE REAL FIX IS SERVER-SIDE — a cursor on `GET /inbox`, or an
 * `unanswered=true` filter so the count is a `countDocuments` rather than a
 * page length. Recorded rather than papered over with a bigger limit.
 */
export function reviewsAreTruncated(items: readonly ReviewItemLike[] | undefined): boolean {
  return (items?.length ?? 0) >= REVIEW_PAGE_LIMIT;
}

/**
 * The order the lane is worked in.
 *
 * ★UNANSWERED FIRST, THEN ANGRIEST, THEN OLDEST. A one-star review that has
 * been sitting unanswered for a week is the most expensive row on the page, and
 * `createdAt DESC` — what the api returns — buries it under today's five-stars.
 *
 * ⚠️A REVIEW WITH NO RATING SORTS WITH THE MIDDLE, not with the one-stars. An
 * absent rating is an unknown, and treating unknown as worst puts every
 * rating-less row above a genuine complaint.
 */
export function reviewQueueOrder<T extends ReviewItemLike>(items: readonly T[]): T[] {
  const NO_RATING = 3;
  return [...items].sort((a, b) => {
    // ★THE SAME QUESTION THE BADGE ASKS. Sorting on `hasPublishedReply` alone
    // left a review the merchant had marked handled — having answered it in
    // Google's own console — permanently at the top of a lane whose badge read
    // zero.
    const answered = Number(!needsAnswer(a)) - Number(!needsAnswer(b));
    if (answered !== 0) return answered;
    const rating = (a.review?.rating ?? NO_RATING) - (b.review?.rating ?? NO_RATING);
    if (rating !== 0) return rating;
    const age = a.createdAt.localeCompare(b.createdAt);
    if (age !== 0) return age;
    // A total order, so two rows sharing a timestamp do not swap on re-render.
    return a._id.localeCompare(b._id);
  });
}

// ── What goes in the box ─────────────────────────────────────────────────────

export interface ComposerState {
  /** What the textarea starts with. ⚠️NEVER the AI draft. */
  initialText: string;
  /** The AI suggestion, offered behind an explicit "use this" — or absent. */
  suggestion?: string;
  /** The reply customers can see, or will once Google's check clears it. */
  published?: string;
  /** Google is still checking `published`, so customers may not see it yet. */
  pendingCheck: boolean;
  /** Google refused the last reply. Absent when it did not. */
  rejected?: { text?: string; note: string };
  /** Sending is possible at all. */
  canSend: boolean;
  /** Why not, when not — a sentence, not a code. */
  blockedReason?: string;
}

/** Why a row cannot be replied to from here, in the network's own words. */
function blockedReasonFor(item: ReviewItemLike): string {
  const channel = item.replyChannel;
  if (!channel) return "Replies to this network aren't supported here yet — answer it on the network itself.";
  // ★THE REFERENCE IS CHECKED FIRST: the api's `canReply` is false for a row with no reference too, and a network that DOES take replies
  // must never be described as taking none.
  if (!item.review?.externalReviewId?.trim()) return `We don't have a reference for this review on ${channel.label}, so it has to be answered there.`;
  return `Peakhour can't send replies to ${channel.label} reviews — answer this one on ${channel.label}.`;
}

/**
 * What the composer opens with.
 *
 * ★★★THE DRAFT IS NEVER THE SEND BODY. `review.replyDraft` is an AI suggestion
 * pending the owner's approval, and the api goes out of its way never to read it
 * — the text it publishes arrives in the request body, from a person who typed
 * or accepted it. Prefilling the box with the draft makes "Send" a one-click
 * publish of machine-written text under the merchant's name, beneath a
 * customer's review. The suggestion is returned SEPARATELY, for a button that
 * fills the box and leaves the person holding the pen.
 *
 * ★AN ALREADY-PUBLISHED REPLY *IS* PREFILLED, because that is what editing
 * means: Google's reply endpoint is a PUT, the merchant is looking at their own
 * published words, and the api answers "unchanged" if they send them back
 * untouched. That is not the same act as sending a suggestion nobody read.
 *
 * ★★A REJECTED REPLY IS PREFILLED TOO, for the same reason. They are the
 * merchant's own words, and fixing them is the one thing left to do.
 */
export function composerStateFor(item: ReviewItemLike): ComposerState {
  const suggestion = item.review?.replyDraft?.trim() || undefined;
  const published = item.review?.replyPublished?.trim() || undefined;
  const pendingCheck = Boolean(published) && item.review?.replyState === "pending";
  const rejected = rejectionOf(item, isRepliableReview(item));
  if (!isRepliableReview(item)) {
    return {
      initialText: "",
      suggestion,
      published,
      pendingCheck,
      rejected,
      canSend: false,
      blockedReason: blockedReasonFor(item),
    };
  }
  // ★A NETWORK THAT DOES NOT REPLACE A REPLY ON A RE-SEND GETS NO EDIT-AND-RESEND: sending again could post a second reply under the first.
  if (published && item.replyChannel?.replacesReply !== true) {
    return {
      initialText: "",
      suggestion,
      published,
      pendingCheck,
      rejected,
      canSend: false,
      blockedReason: pendingCheck
        ? `Your reply is waiting for ${networkWords(item)}'s check. A reply can't be changed from Peakhour there, so once it is live, edit it on ${networkWords(item)} itself.`
        : `Your reply is on ${networkWords(item)}. A reply can't be changed from Peakhour there, so edit it on ${networkWords(item)} itself.`,
    };
  }
  return {
    initialText: published ?? rejected?.text ?? "",
    suggestion,
    published,
    pendingCheck,
    rejected,
    canSend: true,
  };
}

/**
 * What Google refused, if it did, and what the merchant can do about it.
 *
 * ★A LIVE REPLY OUTRANKS AN OLD REJECTION. The api clears the rejection on a
 * resend, but if the two ever sit on one row, telling the merchant their reply
 * is rejected while it shows on the listing would send them to fix nothing.
 */
function rejectionOf(item: ReviewItemLike, canSend: boolean): ComposerState["rejected"] {
  if (item.review?.replyState !== "rejected" || hasPublishedReply(item)) return undefined;
  const reason = policyReason(item.review.replyPolicyViolation);
  return {
    text: item.review.replyRejectedText?.trim() || undefined,
    note: [reason ? `Reason: ${reason}.` : "", canSend ? "Edit it and send it again." : ""]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * Google's code as words.
 *
 * ★SPELLED OUT, NOT LOOKED UP. Google says it may add codes, so a table would
 * show nothing for the new ones. `OFF_TOPIC` reads well enough as "off topic".
 * An unspecified code is no reason at all, so it shows none.
 */
function policyReason(code: string | undefined): string | undefined {
  const trimmed = code?.trim();
  if (!trimmed || trimmed.endsWith("UNSPECIFIED")) return undefined;
  return trimmed.toLowerCase().replaceAll("_", " ");
}

/**
 * Should an incoming published reply be adopted into the box?
 *
 * ★★★THE BOX IS SEEDED ONCE, AT MOUNT, and a reply that arrives afterwards —
 * a colleague answering the same review, or our own write landing on a later
 * refetch — left the card reading "Update reply" over an EMPTY textarea with
 * Send disabled. "Editing means editing" was the whole point of prefilling it;
 * a stale empty box means editing is retyping.
 *
 * ⚠️AND NEVER OVER SOMETHING THE MERCHANT HAS TYPED. Half a written reply
 * silently replaced by somebody else's is worse than a stale box: it is their
 * words, on their screen, gone with no undo. `dirty` is the veto.
 *
 * ⚠️AND NEVER ADOPTS AN ABSENT ONE. A row that stops reporting a published
 * reply would otherwise CLEAR a box that is showing it, which no fact we have
 * justifies.
 */
export function shouldAdoptPublishedReply(args: {
  /** Has the person touched the box since it was last seeded? */
  dirty: boolean;
  /** The published reply this card last seeded from. */
  seen: string | undefined;
  /** What the row says now. */
  incoming: string | undefined;
}): boolean {
  if (args.dirty) return false;
  if (args.incoming === undefined) return false;
  return args.incoming !== args.seen;
}

export type ReplyTextCheck =
  | { ok: true; comment: string }
  | { ok: false; code: "EMPTY_REPLY" | "REPLY_TOO_LONG"; message: string };

/**
 * The reply as it would be sent, or why it will not be — before the round trip.
 *
 * ★TRIMMED FIRST, AND THE LENGTH MEASURED ON THE TRIMMED TEXT, because that is
 * what the api measures. Counting the untrimmed string refuses a reply the
 * server would have accepted, over whitespace the merchant cannot see.
 *
 * ★REFUSED, NOT TRUNCATED. Half a sentence beneath a customer's review is worse
 * than a send that stops and says why.
 */
export function checkReplyText(raw: string, limit?: { max: number | null; label: string }): ReplyTextCheck {
  const comment = raw.trim();
  if (!comment) {
    return { ok: false, code: "EMPTY_REPLY", message: "A reply needs something in it." };
  }
  if (limit?.max != null && comment.length > limit.max) {
    return {
      ok: false,
      code: "REPLY_TOO_LONG",
      message: `${limit.label} allows ${limit.max} characters; this reply is ${comment.length}.`,
    };
  }
  return { ok: true, comment };
}

/**
 * Characters left, counted the way the api counts them, or null when the network declared no cap (nothing is counted down then).
 *
 * ⚠️NEGATIVE WHEN OVER, deliberately — the composer shows "42 over", which is a
 * number a person can act on. Clamping at zero tells somebody 1200 characters
 * long that they have "0 left" and leaves them deleting blindly.
 */
export function replyCharsRemaining(raw: string, max: number | null): number | null {
  return max === null ? null : max - raw.trim().length;
}

// ── What came back ───────────────────────────────────────────────────────────

/** The api's answer to `POST /v1/support/inbox/:id/reply`. */
export interface ReplyResponseLike {
  sent: boolean;
  recorded?: boolean;
  replyPublishedAt?: string;
  reason?: string;
  /** Google's answer to this send. `pending` means not live yet. */
  replyState?: string;
}

export type ReplyOutcome =
  /** On the listing, and filed. The ordinary success. */
  | { kind: "published"; headline: string; description?: string; offerForce: false }
  /** ★On the listing, and we could not file it. STILL A SUCCESS. */
  | { kind: "published_unrecorded"; headline: string; description: string; offerForce: false }
  /** Nothing was sent because nothing had changed. Not a failure. */
  | { kind: "unchanged"; headline: string; description: string; offerForce: boolean };

/**
 * What the api's 200 actually means.
 *
 * ★★★`recorded: false` WITH `sent: true` IS A REAL ANSWER AND IT IS A SUCCESS.
 * The reply IS on the customer's review; the row we keep it in vanished between
 * the read and the write. Rendering that as "couldn't send your reply" makes the
 * merchant write it again — and the second one lands on a public listing on top
 * of the first. The honest sentence says both halves: it went out, we did not
 * file it.
 *
 * ★★`sent: false` IS NOT AN ERROR EITHER. The api answers it for one reason:
 * the text matches what we last published, so there was nothing to do. It comes
 * with the way out — `force` — because a reply DELETED IN GOOGLE'S OWN CONSOLE
 * leaves our row still holding the text, and without an override the merchant
 * could never restore it while being told it already worked.
 */
export function replyOutcome(res: ReplyResponseLike, label: string = NO_LABEL, replacesReply = false): ReplyOutcome {
  if (!res.sent) {
    // ★"SEND IT AGAIN" IS A PROMISE ONLY A NETWORK THAT REPLACES A REPLY CAN KEEP; elsewhere it could post a second one.
    return replacesReply
      ? {
          kind: "unchanged",
          headline: "That's already your reply.",
          description:
            "Nothing was sent, because the words haven't changed. If the reply has gone missing from " +
            `${label}, send it again to put it back.`,
          offerForce: true,
        }
      : {
          kind: "unchanged",
          headline: "That's already your reply.",
          description: `Nothing was sent, because the words haven't changed. If it has gone missing from ${label}, check there before doing anything else.`,
          offerForce: false,
        };
  }
  // ★A REPLY GOOGLE IS CHECKING IS NOT LIVE, and saying so would be untrue beside
  // a card that says "waiting for Google's check".
  const checking = res.replyState === "pending";
  const headline = checking ? cap(`${label} is checking your reply before it goes live.`) : `Your reply is live on ${label}.`;
  if (res.recorded === false) {
    return {
      kind: "published_unrecorded",
      headline,
      description:
        "We couldn't file it against this item, so it may still show as unanswered here. " +
        `Don't send it again — ${checking ? `${label} already has it` : "the customer can already see it"}.`,
      offerForce: false,
    };
  }
  return { kind: "published", headline, offerForce: false };
}

/**
 * May the caller refresh the list on the back of this outcome?
 *
 * ★★★NO, ON `published_unrecorded`, AND THAT IS NOT A PERFORMANCE POINT.
 * `recorded: false` means the api's own `updateOne` matched NOTHING — the row
 * is gone from the collection. Refetching therefore returns a list WITHOUT this
 * review, React unmounts the card, and the only place the words "your reply is
 * live, don't send it again" appear goes with it. The merchant is left looking
 * at an inbox that never mentions the reply they just published, which is
 * exactly the state that makes somebody write it a second time.
 *
 * ★THE STALE ROW IS THE LESSER EVIL. It is one card, showing a warning that is
 * true, until the next navigation.
 */
export function shouldRefreshAfter(outcome: ReplyOutcome): boolean {
  return outcome.kind !== "published_unrecorded";
}

/**
 * Does this refusal mean the row changed?
 *
 * ★★GOOGLE'S MODERATION REJECTION IS WRITTEN BEFORE IT IS REPORTED. The api
 * clears the published reply and stores the reason, so without a refresh the
 * card goes on showing a reply that is gone, and never shows the reason. The
 * same code also covers a plain Google 4xx, which changes nothing, and a
 * refresh then does no harm.
 */
export function shouldRefreshAfterRefusal(code: string | undefined, replacesReply = true): boolean {
  // a send whose outcome is unknown on a network that does not replace may have gone live: the row is read again so the card shows it
  return code === "REPLY_REJECTED" || (isUnknownOutcome(code) && !replacesReply);
}

/** The codes that mean the network may or may not have taken the reply (a timeout, a gateway, or the network's own 5xx). */
function isUnknownOutcome(code: string | undefined): boolean {
  return code === TRANSPORT_ERROR_CODE || code === "PARSE_ERROR" || code === "UPSTREAM_ERROR";
}

// ── What went wrong ──────────────────────────────────────────────────────────

/**
 * How a refusal should be presented, and to whom it belongs.
 *
 * `fix_text` — the reply itself. Stay in the composer with the words intact.
 * `not_repliable` — this row can never be answered from here. No retry, no CTA.
 * `no_permission` — a real answer about THIS PERSON, not about the review. A
 *   viewer can open the Inbox but not publish under the business's name, and
 *   "contact support" for that is an answer support cannot give.
 * `reconnect` / `pick_location` — the merchant can fix it, on Presence.
 * `retry` — transient and nobody's fault. ⚠️Must never mention the connection.
 * `unhandled` — ours. The request id, and support.
 */
export type ReplyRefusalKind =
  | "fix_text"
  | "not_repliable"
  | "no_permission"
  | "reconnect"
  | "pick_location"
  | "retry"
  /** The send may or may not have gone through and a second one could post a second reply: look on the network first. No retry button. */
  | "check_first"
  | "unhandled";

export interface ReplyRefusal {
  kind: ReplyRefusalKind;
  headline: string;
  description?: string;
  /** Where the merchant goes to fix it, when there is such a place. */
  href?: string;
  /** Support's handle on the server log, on `unhandled` only. */
  requestId?: string;
}

/** The api error, as `ApiError` exposes it. */
export interface ReplyErrorLike {
  code?: string;
  message?: string;
  status?: number;
  requestId?: string;
}

/**
 * The code a caller passes when the throw was NOT an api response at all.
 *
 * ★★★A `fetch` THAT THROWS NEVER BECOMES AN `ApiError` — offline, DNS, CORS, a
 * dropped connection mid-request all raise a bare TypeError, and a caller
 * handing that to `replyRefusal` as an empty object got "our team has the
 * details, contact support" for a problem no support agent can see and a second
 * click usually fixes. `toastUnhandledApiError` draws the same line and this
 * surface must not disagree with it.
 */
export const TRANSPORT_ERROR_CODE = "NETWORK_ERROR";

const KIND_BY_CODE: Record<string, ReplyRefusalKind> = {
  // The row
  NOT_A_REVIEW: "not_repliable",
  UNSUPPORTED_NETWORK: "not_repliable",
  NO_REVIEW_REFERENCE: "not_repliable",
  UNRECOGNISED_REVIEW_REFERENCE: "not_repliable",
  // ★PERMANENT, AND THE MERCHANT'S OWN TO DO: the network takes no reply from here, or the review names no place we can pick. Neither is a
  // support ticket and neither is helped by a retry; both say where to answer it.
  REPLY_NOT_SUPPORTED: "not_repliable",
  LOCATION_AMBIGUOUS: "not_repliable",
  // ★THE SERVER REFUSED A SECOND SEND on a network that does not replace a reply: permanent, and the merchant's to do on the network
  REPLY_ALREADY_SENT: "not_repliable",
  // ★THE ROW IS GONE. Reachable two ways and neither is a support ticket: a
  // 30-second staleTime with no refetch-on-focus means the list outlives the
  // row, and `app.onError`'s unknown-route handler answers NOT_FOUND — so if
  // b2c ships ahead of the api, EVERY send tells the merchant to open a
  // ticket. `toast-errors.ts` calls that out as a deploy-order hazard.
  NOT_FOUND: "not_repliable",
  // The person
  FORBIDDEN: "no_permission",
  // The words
  EMPTY_REPLY: "fix_text",
  REPLY_TOO_LONG: "fix_text",
  VALIDATION_ERROR: "fix_text",
  REPLY_REJECTED: "fix_text",
  // The connection
  NOT_CONNECTED: "reconnect",
  REAUTH_REQUIRED: "reconnect",
  LOCATION_UNRESOLVED: "reconnect",
  // The listing
  NO_LOCATION_PICKED: "pick_location",
  LOCATION_NOT_MANAGED: "pick_location",
  // Weather
  LISTING_LOOKUP_INCOMPLETE: "retry",
  RATE_LIMITED: "retry",
  UPSTREAM_ERROR: "retry",
  // The wire. ★Neither of these is an answer FROM the api: `NETWORK_ERROR` is
  // a fetch that threw, and `PARSE_ERROR` is a non-JSON body — a gateway or a
  // proxy, not our route. Both are the transient family.
  [TRANSPORT_ERROR_CODE]: "retry",
  PARSE_ERROR: "retry",
};

/**
 * Codes whose `message` the api WRITES ITSELF, in words meant for a merchant.
 *
 * ★★★THE ONE THAT IS NOT ON THIS LIST IS THE POINT. `REPLY_REJECTED` carries
 * `GoogleApiError.message` — the provider's raw response body, which is exactly
 * what `no-raw-ai-errors-to-users` forbids and what `toastUnhandledApiError`
 * exists to keep off the screen. It gets our sentence and the request id; the
 * provider's words stay in the api's log where support can read them.
 *
 * ⚠️AND `LISTING_LOOKUP_INCOMPLETE` IS OFF IT FOR A DIFFERENT REASON. Its
 * message is api-authored and safe, and it ends "Retrying." — true of the
 * publisher adapter it was written for, and FALSE HERE: this route answers 503
 * and nothing retries unless the merchant presses the button. Passing it
 * through promises a background retry that is not happening.
 */
const API_AUTHORED_MESSAGE = new Set([
  "REPLY_ALREADY_SENT",
  "REPLY_NOT_SUPPORTED",
  "LOCATION_AMBIGUOUS",
  "NOT_A_REVIEW",
  "UNSUPPORTED_NETWORK",
  "NO_REVIEW_REFERENCE",
  "UNRECOGNISED_REVIEW_REFERENCE",
  // ⚠️`FORBIDDEN` IS OFF THIS LIST, HAVING BEEN ON IT. The argument for
  // passing it through was that "This action requires editor or admin role"
  // names the role — but that is one of THREE strings `requireRole` can send,
  // and the other two are "Insufficient permissions" and "No roles assigned":
  // internal wording, and in the third case ("Active business required") not
  // about roles at all. Keeping it made our own merchant-facing headline
  // unreachable.
  "EMPTY_REPLY",
  "REPLY_TOO_LONG",
  // ⚠️`VALIDATION_ERROR` IS OFF THIS LIST TOO, and it looks like it belongs on
  // it. The route builds that message from `parsed.error.issues[0].message` —
  // zod's own English ("String must contain at least 1 character(s)") — or
  // "Invalid item id", which is about a URL the merchant never typed. Neither
  // is copy, and neither is about their reply.
  "NOT_CONNECTED",
  "REAUTH_REQUIRED",
  "LOCATION_UNRESOLVED",
  "NO_LOCATION_PICKED",
  // ⚠️`LOCATION_NOT_MANAGED` IS OFF IT TOO, AND FOR TWO REASONS AT ONCE.
  // `classifyParentLookup` builds that message by interpolating the raw
  // `locations/12345` — an internal id the merchant has never seen — and it
  // ends "Re-pick the location on the Business Profile integration", which
  // names a DIFFERENT screen from the one this module's own second sentence
  // sends them to. One refusal cannot point at two places.
  "RATE_LIMITED",
]);

/** Our own words, for the codes whose message must not be shown, and as the
 *  floor for a code that arrives with no message at all. */
const FALLBACK_HEADLINE = (n: string, max: number | null): Record<string, string> => ({
  NOT_A_REVIEW: "This isn't a review, so there's nothing to reply to on a listing.",
  UNSUPPORTED_NETWORK: "We can't reply to this network from here yet.",
  NO_REVIEW_REFERENCE: `We don't have a reference for this review on ${n}.`,
  REPLY_NOT_SUPPORTED: `Peakhour can't send replies to ${n} reviews. Answer this one on ${n} itself.`,
  LOCATION_AMBIGUOUS: `We can't tell which of your locations this ${n} review is for. Open it on ${n} to reply.`,
  REPLY_ALREADY_SENT: `You have already replied to this ${n} review, and it can't be changed from Peakhour. Edit it on ${n} itself.`,
  UNRECOGNISED_REVIEW_REFERENCE: "We don't recognise the reference stored for this review.",
  NOT_FOUND: "This review isn't in your inbox any more.",
  FORBIDDEN: "You don't have permission to reply on this business's behalf.",
  EMPTY_REPLY: "A reply needs something in it.",
  REPLY_TOO_LONG: max === null ? "That reply is too long." : `${n} allows ${max} characters.`,
  // ★NOT "Google wouldn't accept that reply" — nothing reached Google. The
  // request never left our own validation, and saying otherwise sends the
  // merchant looking for a problem with their listing.
  VALIDATION_ERROR: "That reply couldn't be sent as written.",
  REPLY_REJECTED: `${n} wouldn't accept that reply.`,
  NOT_CONNECTED: `${n} isn't connected.`,
  REAUTH_REQUIRED: `Reconnect ${n} to reply.`,
  LOCATION_UNRESOLVED: "We couldn't work out which listing this review belongs to.",
  NO_LOCATION_PICKED: "No location is selected.",
  LOCATION_NOT_MANAGED: "This listing isn't under the account we're connected to.",
  LISTING_LOOKUP_INCOMPLETE: "Couldn't check your listing just now.",
  RATE_LIMITED: `${n} is rate-limiting replies just now.`,
  UPSTREAM_ERROR: `${n} couldn't accept the reply just now.`,
  [TRANSPORT_ERROR_CODE]: "Couldn't reach Peakhour.",
  PARSE_ERROR: "Couldn't reach Peakhour.",
});

const SECOND_SENTENCE: Record<string, string> = {
  NOT_FOUND: "Reload the page to see what's there now.",
  // ⚠️TRUE OF ALL THREE FORBIDDENs THE ROUTE CAN EMIT. It also answers this
  // code for "No roles assigned" and "Active business required", and an
  // earlier sentence here told those merchants to ask a colleague for editor
  // access — advice that cannot fix either. What is true in every case is who
  // is allowed to publish, so that is what it says.
  FORBIDDEN: "Publishing a reply needs editor access to this business.",
  REPLY_REJECTED: "Try rewording it — links and contact details are often what a network objects to.",
  NOT_CONNECTED: "Connect it on Presence, then reply.",
  REAUTH_REQUIRED: "It only takes a click, on Presence.",
  LOCATION_UNRESOLVED: "Check the connection on Presence.",
  NO_LOCATION_PICKED: "Pick which of your locations this is, on Presence.",
  LOCATION_NOT_MANAGED: "Re-pick the location on Presence, or connect the account that manages it.",
  // ★NOT "CHECK YOUR CONNECTION". Nothing is wrong with it — Google's account
  // listing was incomplete for a moment. Sending somebody to re-authorise a
  // healthy connection over a 503 is the failure this whole classifier exists
  // to avoid.
  LISTING_LOOKUP_INCOMPLETE: "Nothing's wrong with your connection — try again in a moment.",
  // ⚠️NOT "NOTHING WAS SENT". A request that reached the route and then lost
  // its connection may well have published the reply — we did not get an answer
  // either way, and claiming it did not go out is the same false certainty the
  // `recorded: false` branch exists to avoid. What IS true is that a repeat is
  // harmless: the same words sent again replace the reply, they do not add one.
  [TRANSPORT_ERROR_CODE]: "Check your connection and try again — re-sending the same words is safe.",
  PARSE_ERROR: "Check your connection and try again — re-sending the same words is safe.",
  RATE_LIMITED: "Give it a minute and try again.",
  UPSTREAM_ERROR: "Try again in a moment.",
};

/**
 * Turn the api's refusal into something a merchant can read and act on.
 *
 * ★AN UNKNOWN CODE IS `unhandled`, NEVER `retry`. A code we have never seen
 * being reported as "try again in a moment" is how somebody clicks Send forty
 * times against a permanent failure. The request id is what support needs, and
 * the only technical detail worth showing.
 */
export function replyRefusal(err: ReplyErrorLike, channel?: { label?: string; maxLength?: number | null; replacesReply?: boolean }): ReplyRefusal {
  const n = channel?.label?.trim() || NO_LABEL;
  // ★A SEND THAT TIMED OUT MAY HAVE GONE THROUGH. "Re-sending the same words is safe" is true only where a re-send replaces the reply; on a
  // network that does not, a second send could post a second one, so there is no retry and the merchant is told to look first.
  if (isUnknownOutcome(err.code) && channel?.replacesReply !== true) {
    return {
      kind: "check_first",
      headline: "We couldn't confirm your reply was sent.",
      description: `Look at your reviews on ${n} before sending it again: if it went through, a second send may post a second reply.`,
    };
  }
  const code = err.code ?? "";
  const kind = KIND_BY_CODE[code];
  if (!kind) {
    return {
      kind: "unhandled",
      headline: "Couldn't send your reply.",
      description: err.requestId
        ? `Our team has the details — contact support and quote reference ${err.requestId}.`
        : "Our team has the details — please contact support.",
      requestId: err.requestId,
    };
  }
  const authored = API_AUTHORED_MESSAGE.has(code) ? err.message?.trim() : undefined;
  const headline = authored || cap(FALLBACK_HEADLINE(n, channel?.maxLength ?? null)[code] ?? "Couldn't send your reply.");
  const description = SECOND_SENTENCE[code] || undefined;
  const href = kind === "reconnect" || kind === "pick_location" ? PRESENCE_ROUTE : undefined;
  return { kind, headline, ...(description ? { description } : {}), ...(href ? { href } : {}) };
}

/**
 * May the merchant press Send again for this refusal?
 *
 * ★ONLY THE TRANSIENT ONES. A retry button on `LOCATION_NOT_MANAGED` invites
 * somebody to click the same wall until they give up; a retry on
 * `LISTING_LOOKUP_INCOMPLETE` is the entire remedy.
 */
export function isRetryableRefusal(refusal: ReplyRefusal): boolean {
  return refusal.kind === "retry";
}
