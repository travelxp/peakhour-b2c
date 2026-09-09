/**
 * Mutation harness for REPLY-TO-A-GOOGLE-REVIEW (plan S0·4).
 *
 * ★★★WHAT THIS DEFENDS IS TEXT PUBLISHED UNDER THE MERCHANT'S NAME BENEATH A
 * CUSTOMER'S REVIEW, on their Google Maps and Search listing — a page anyone
 * can read, that many local businesses are judged by, and that this app cannot
 * take a reply back from. Every failure mode is quiet:
 *
 *   - the AI DRAFT prefilled into the box, so Send publishes machine-written
 *     words somebody skim-read and thought they were confirming;
 *   - `sent: true, recorded: false` rendered as a failure — the reply IS live,
 *     the merchant writes it again, and the customer gets two;
 *   - `sent: false, reason: "unchanged"` rendered as success with no way out,
 *     so a reply deleted in Google's own console can never be restored;
 *   - a 503 on Google's account listing reported as "reconnect your account",
 *     sending somebody to re-authorise a connection that was never broken;
 *   - Google's raw rejection body — `REPLY_REJECTED`'s message — shown to a
 *     merchant as though we had written it;
 *   - the composer counting down to 5000, the number the COLLECTION stores,
 *     when Google refuses above 4096.
 *
 * ⚠️AND NONE OF IT IS VISIBLE FROM A COMPONENT TEST, because this repo runs
 * vitest WITHOUT JSDOM. That is why every rule lives in `lib/review-reply.ts`
 * and the card is markup: a rule inside the card is a rule nothing asserts,
 * and a rule nothing asserts is a rule a refactor can delete in silence.
 *
 * Discipline, unchanged from mutate-compose-to-listing.mjs:
 *   - ANCHOR PRE-FLIGHT: every anchor appears EXACTLY once in its own file.
 *   - KILLER PRE-FLIGHT: every designated spec title exists EXACTLY once AND is
 *     GREEN at baseline. ⚠️vitest's `-t` is a REGEX, so titles are compared for
 *     equality against the JSON reporter's own output.
 *   - SMOKE MUTANT: one per (FILE, SPEC) PAIR, and it must obviously die.
 *   - RESTORE FROM AN IN-MEMORY COPY, never `git checkout`, verified after.
 *   - ⚠️A DEAD RUNNER IS NOT A KILL.
 *   - SIGNALS RESTORE, because try/finally does not survive one.
 *
 * Run: node scripts/mutate-review-reply.mjs
 */
import { readFileSync, writeFileSync, writeSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const SPEC = "src/lib/review-reply.test.ts";

/** One (file, spec) pair — every rule S0·4 rests on is in the one module. */
const FILES = {
  rules: { target: "src/lib/review-reply.ts", spec: SPEC },
};

/** ⚠️★`npx.cmd` ANSWERS EINVAL on this platform — go through the node binary. */
const VITEST = "node_modules/vitest/vitest.mjs";
const RUN_ENV = { ...process.env };

const MUTANTS = [
  // ── What the composer may be offered on ──────────────────────────────────
  {
    where: "rules",
    name: "★★★offer a listing reply on a row that did not come from a review",
    anchor: "  if (item.source !== REVIEW_SOURCE) return false;",
    mutated: "  if (false) return false;",
    killer: "★★★refuses a row whose source is not a Google review",
  },
  {
    // ⚠️A FUTURE NETWORK NORMALISED INTO THE SAME SOURCE would be replied to
    // through Google's API against an id Google never issued.
    where: "rules",
    name: "★★★reply through Google's API to a review Google never saw",
    anchor: "  if (item.review?.network !== REVIEW_NETWORK) return false;",
    mutated: "  if (false) return false;",
    killer: "★★★refuses a row whose network is not Business Profile",
  },
  {
    where: "rules",
    name: "★★★offer a send with no review reference to send it against",
    anchor: "  return Boolean(item.review?.externalReviewId?.trim());",
    mutated: "  return true;",
    killer: "★★★refuses a row with no network reference to reply to",
  },
  {
    where: "rules",
    name: "★★read a whitespace-only reference as a real one",
    anchor: "  return Boolean(item.review?.externalReviewId?.trim());",
    mutated: "  return Boolean(item.review?.externalReviewId);",
    killer: "★★treats a whitespace-only reference as absent",
  },
  {
    // ⚠️THE MISTAKE THAT COST A WHOLE REVIEW ROUND ON S5·3: the channel key,
    // the provider name and the inbox source are three different strings.
    where: "rules",
    name: "★★conflate the inbox source with the network name",
    anchor: 'export const REVIEW_NETWORK = "google_business_profile";',
    mutated: 'export const REVIEW_NETWORK = "google_review";',
    killer: "★★the source and the network are different strings",
  },

  // ── The badge ────────────────────────────────────────────────────────────
  {
    where: "rules",
    name: "★★★count reviews that have already been answered",
    anchor:
      '  return !hasPublishedReply(item) && item.status !== "resolved" && item.status !== "closed";',
    mutated: '  return item.status !== "resolved" && item.status !== "closed";',
    killer: "★★★counts a review with no published reply",
  },
  {
    // ⚠️AND THIS IS ALSO WHAT MADE THE BADGE AND THE SORT DISAGREE, now that
    // both read `needsAnswer`: the count would keep handled work, and the lane
    // would keep it at the top.
    where: "rules",
    name: "★★★keep counting work the merchant has already handled",
    anchor:
      '  return !hasPublishedReply(item) && item.status !== "resolved" && item.status !== "closed";',
    mutated: "  return !hasPublishedReply(item);",
    killer: "★★★stops counting one the merchant resolved or closed",
  },
  {
    where: "rules",
    name: "★★stop counting anything a human has opened",
    anchor:
      '  return !hasPublishedReply(item) && item.status !== "resolved" && item.status !== "closed";',
    mutated: '  return !hasPublishedReply(item) && item.status === "queued";',
    killer: "★★★stops counting one the merchant resolved or closed",
  },
  {
    // ⚠️NETTING OUT THE ONES WE CANNOT ANSWER makes the queue lie about its
    // own size — the row is still there, still unanswered, still visible.
    where: "rules",
    name: "★★hide reviews we cannot reply to from the count",
    anchor: "  return (items ?? []).filter(needsAnswer);",
    mutated: "  return (items ?? []).filter((i) => needsAnswer(i) && isRepliableReview(i));",
    killer: "★★counts a review we cannot reply to from here",
  },
  {
    where: "rules",
    name: "★★read a whitespace-only published reply as an answer",
    anchor: "  return Boolean(item.review?.replyPublished?.trim());",
    mutated: "  return Boolean(item.review?.replyPublished);",
    killer: "★★treats a whitespace-only published reply as unanswered",
  },
  {
    // ★★★THE DRAFT IS NOT A REPLY. Reading it here marks every AI suggestion
    // as answered — the badge empties and nobody ever sends anything.
    where: "rules",
    name: "★★★count an AI draft as a published reply",
    anchor: "  return Boolean(item.review?.replyPublished?.trim());",
    mutated: "  return Boolean(item.review?.replyDraft?.trim());",
    killer: "★hasPublishedReply reads the published reply, not the draft",
  },
  {
    where: "rules",
    name: "★throw on a list that has not arrived yet",
    anchor: "  return (items ?? []).filter(",
    mutated: "  return (items as readonly T[]).filter(",
    killer: "★an absent list counts zero rather than throwing",
  },
  {
    // ⚠️ROUND 1 FOUND THIS: the badge and the sort asked the same question
    // separately and disagreed. A review answered in Google's console and
    // marked handled was netted out of the count and still pinned to the top.
    where: "rules",
    name: "★★★sort on the published reply alone, so handled work owns the top",
    anchor: "    const answered = Number(!needsAnswer(a)) - Number(!needsAnswer(b));",
    mutated:
      "    const answered = Number(hasPublishedReply(a)) - Number(hasPublishedReply(b));",
    killer: "★★★asks the same question the queue order asks",
  },

  // ── A page is not the whole list ─────────────────────────────────────────
  {
    // ⚠️THE api CAPS `limit` AT 100 AND HAS NO CURSOR, and sorts newest-first
    // — so the rows dropped are the OLDEST, where an unanswered review has
    // been waiting longest.
    where: "rules",
    name: "★★★report a full page as the whole list",
    anchor: "  return (items?.length ?? 0) >= REVIEW_PAGE_LIMIT;",
    mutated: "  return false;",
    killer: "★★★says a full page is a floor, not a total",
  },
  {
    where: "rules",
    name: "★★call every list truncated, so a merchant with four reviews is told there are more",
    anchor: "  return (items?.length ?? 0) >= REVIEW_PAGE_LIMIT;",
    mutated: "  return true;",
    killer: "★★an empty or absent list is not a truncated one",
  },
  {
    where: "rules",
    name: "★★miss the exactly-full page, which is the only one that IS truncated",
    anchor: "  return (items?.length ?? 0) >= REVIEW_PAGE_LIMIT;",
    mutated: "  return (items?.length ?? 0) > REVIEW_PAGE_LIMIT;",
    killer: "★★★says a full page is a floor, not a total",
  },
  {
    where: "rules",
    name: "★ask the api for a page it will refuse",
    anchor: "export const REVIEW_PAGE_LIMIT = 100;",
    mutated: "export const REVIEW_PAGE_LIMIT = 250;",
    killer: "★asks the api for exactly the page it can serve",
  },
  {
    // ⚠️ROUND 2: `count > 0` hid the badge on a truncated page whose hundred
    // newest reviews were all answered — a silent tab claiming nothing is
    // waiting, about rows we never fetched.
    where: "rules",
    name: "★★★claim nothing is waiting on a page we know is incomplete",
    anchor: "  if (count === 0 && !truncated) return null;",
    mutated: "  if (count === 0) return null;",
    killer: "★★★shows a badge on a truncated page even when its count is zero",
  },
  {
    where: "rules",
    name: "★★★drop the + , so a floor reads as a total",
    anchor: '  return { label: truncated ? `${count}+` : String(count) };',
    mutated: "  return { label: String(count) };",
    killer: "★★★marks a truncated count as a floor, not a total",
  },
  {
    where: "rules",
    name: "★★mark every count as a floor, including the complete ones",
    anchor: '  return { label: truncated ? `${count}+` : String(count) };',
    mutated: '  return { label: `${count}+` };',
    killer: "★★shows a bare number when the whole list arrived",
  },
  {
    where: "rules",
    name: "★★badge a complete list with nothing waiting on it",
    anchor: "  if (count === 0 && !truncated) return null;",
    mutated: "  if (false) return null;",
    killer: "★★shows nothing when a complete list has nothing waiting",
  },

  // ── Who the review is from ───────────────────────────────────────────────
  {
    // ⚠️ROUND 2: the GBP webhook writes NO `contact` on a review row — the
    // reviewer is in the SUBJECT — so every review in the inbox was headed
    // "A customer" and the field carrying the name was never rendered.
    where: "rules",
    name: "★★★lose the customer's name the webhook did record",
    anchor: '  return item.contact?.name?.trim() || item.subject?.trim() || "A customer";',
    mutated: '  return item.contact?.name?.trim() || "A customer";',
    killer: "★★★names the customer the webhook actually recorded",
  },
  {
    where: "rules",
    name: "★★let the subject beat a structured contact name",
    anchor: '  return item.contact?.name?.trim() || item.subject?.trim() || "A customer";',
    mutated: '  return item.subject?.trim() || item.contact?.name?.trim() || "A customer";',
    killer: "★★prefers a structured contact name when a writer sets one",
  },
  {
    where: "rules",
    name: "★head a review with a blank line rather than a person",
    anchor: '  return item.contact?.name?.trim() || item.subject?.trim() || "A customer";',
    mutated: '  return item.contact?.name ?? item.subject ?? "A customer";',
    killer: "★falls back to a person rather than to nothing",
  },

  // ── A reply that arrives after the box was seeded ────────────────────────
  {
    // ⚠️ROUND 2: the box is seeded once at mount, so a colleague answering the
    // same review left the card reading "Update reply" over an empty,
    // send-disabled textarea — editing by retyping.
    where: "rules",
    name: "★★★never adopt a reply published while the card was open",
    anchor: "  return args.incoming !== args.seen;",
    mutated: "  return false;",
    killer: "★★★adopts a reply published while the card was open",
  },
  {
    // ⚠️★★★THE DANGEROUS DIRECTION. Half a written public reply, replaced by
    // somebody else's words, with no undo.
    where: "rules",
    name: "★★★overwrite what the merchant is typing with somebody else's reply",
    anchor: "  if (args.dirty) return false;",
    mutated: "  if (false) return false;",
    killer: "★★★never overwrites what the merchant has typed",
  },
  {
    where: "rules",
    name: "★★clear a box showing a published reply because the row stopped reporting one",
    anchor: "  if (args.incoming === undefined) return false;",
    mutated: "  if (false) return false;",
    killer: "★★never clears the box because a row stopped reporting a reply",
  },
  {
    where: "rules",
    name: "★★re-seed the box on every render, undoing nothing but costing a loop",
    anchor: "  return args.incoming !== args.seen;",
    mutated: "  return true;",
    killer: "★★does nothing when the published reply has not changed",
  },

  // ── What to refresh, and when not to ─────────────────────────────────────
  {
    // ⚠️★★★ROUND 2: `recorded: false` IS `matchedCount === 0`. Refetching
    // returns a list without this row, unmounting the card and taking the only
    // "your reply is live, don't send it again" warning with it.
    where: "rules",
    name: "★★★refresh the row away, and the do-not-resend warning with it",
    anchor: '  return outcome.kind !== "published_unrecorded";',
    mutated: "  return true;",
    killer: "★★★does NOT refresh the list on the one outcome whose row has gone",
  },
  {
    where: "rules",
    name: "★★never refresh, so an answered review stays unanswered on screen",
    anchor: '  return outcome.kind !== "published_unrecorded";',
    mutated: "  return false;",
    killer: "★★★does NOT refresh the list on the one outcome whose row has gone",
  },

  // ── The order it is worked in ────────────────────────────────────────────
  {
    where: "rules",
    name: "★★★mix answered reviews back in among the unanswered",
    anchor: "    if (answered !== 0) return answered;",
    mutated: "    if (false) return answered;",
    killer: "★★★puts unanswered reviews above answered ones",
  },
  {
    where: "rules",
    name: "★★★put the answered ones first, so the work is below the fold",
    anchor: "    if (answered !== 0) return answered;",
    mutated: "    if (answered !== 0) return -answered;",
    killer: "★★★puts unanswered reviews above answered ones",
  },
  {
    where: "rules",
    name: "★★★lead with the five-stars and bury the complaint",
    anchor: "    if (rating !== 0) return rating;",
    mutated: "    if (rating !== 0) return -rating;",
    killer: "★★★puts the angriest unanswered review first",
  },
  {
    where: "rules",
    name: "★★treat an absent rating as the angriest review there is",
    anchor:
      "    const rating = (a.review?.rating ?? NO_RATING) - (b.review?.rating ?? NO_RATING);",
    mutated: "    const rating = (a.review?.rating ?? 0) - (b.review?.rating ?? 0);",
    killer: "★★sorts a review with no rating with the middle, not with the one-stars",
  },
  {
    where: "rules",
    name: "★★show the newest of two equal reviews first, so the oldest rots",
    anchor: "    const age = a.createdAt.localeCompare(b.createdAt);",
    mutated: "    const age = b.createdAt.localeCompare(a.createdAt);",
    killer: "★★breaks a rating tie by oldest first",
  },
  {
    where: "rules",
    name: "★★let two rows sharing a timestamp swap on every render",
    anchor: "    return a._id.localeCompare(b._id);",
    mutated: "    return 0;",
    killer: "★★orders two rows sharing a timestamp deterministically",
  },
  {
    where: "rules",
    name: "★sort the caller's own array in place",
    anchor: "  return [...items].sort((a, b) => {",
    mutated: "  return (items as T[]).sort((a, b) => {",
    killer: "★does not mutate the array it was given",
  },

  // ── What goes in the box ─────────────────────────────────────────────────
  {
    // ⚠️★★★THE SINGLE WORST CHANGE ANYBODY COULD MAKE TO THIS FILE. It looks
    // like a kindness — the draft is right there — and it turns Send into a
    // one-click publish of machine-written words under the merchant's name.
    where: "rules",
    name: "★★★prefill the box with the AI draft, so Send publishes it",
    anchor:
      '  return { initialText: published ?? "", suggestion, published, canSend: true };',
    mutated:
      '  return { initialText: published ?? suggestion ?? "", suggestion, published, canSend: true };',
    killer: "★★★never prefills the box with the AI draft",
  },
  {
    where: "rules",
    name: "★★★make the draft the send body and drop the suggestion button",
    anchor:
      '  return { initialText: published ?? "", suggestion, published, canSend: true };',
    mutated:
      '  return { initialText: suggestion ?? "", suggestion: undefined, published, canSend: true };',
    killer: "★★★offers the AI draft as a suggestion rather than as the send body",
  },
  {
    where: "rules",
    name: "★★let the AI draft win over the reply already published",
    anchor:
      '  return { initialText: published ?? "", suggestion, published, canSend: true };',
    mutated:
      '  return { initialText: suggestion ?? published ?? "", suggestion, published, canSend: true };',
    killer: "★★prefills the published reply even when a draft also exists",
  },
  {
    where: "rules",
    name: "★★open an empty box over a published reply, so editing means retyping",
    anchor:
      '  return { initialText: published ?? "", suggestion, published, canSend: true };',
    mutated: '  return { initialText: "", suggestion, published, canSend: true };',
    killer: "★★prefills the box with the reply already published, so editing means editing",
  },
  {
    where: "rules",
    name: "★★★offer a Send the api answers 400 to",
    anchor: "  if (!isRepliableReview(item)) {",
    mutated: "  if (false) {",
    killer: "★★★will not offer a send on a row the api refuses, and says why",
  },
  {
    // ⚠️TWO BRANCHES, TWO DIFFERENT SENTENCES. A test asserting merely that
    // SOME reason is present is satisfied by either version — which is why
    // the killer asserts the words that differ.
    where: "rules",
    name: "★★tell a merchant with a missing reference that their network is unsupported",
    anchor:
      "        item.source !== REVIEW_SOURCE || item.review?.network !== REVIEW_NETWORK",
    mutated: "        true",
    killer:
      "★★says a missing reference has to be answered on Google, not that the network is unsupported",
  },
  {
    where: "rules",
    name: "★offer a blank draft as a suggestion",
    anchor: "  const suggestion = item.review?.replyDraft?.trim() || undefined;",
    mutated: "  const suggestion = item.review?.replyDraft;",
    killer: "★a blank draft is no suggestion at all",
  },

  // ── The words themselves ─────────────────────────────────────────────────
  {
    where: "rules",
    name: "★★★send an empty reply to a public listing",
    anchor: "  if (!comment) {",
    mutated: "  if (false) {",
    killer: "★★★refuses an empty reply",
  },
  {
    where: "rules",
    name: "★★★let an over-long reply through for Google to refuse",
    anchor: "  if (comment.length > REVIEW_REPLY_MAX_LENGTH) {",
    mutated: "  if (false) {",
    killer: "★★★refuses a reply longer than Google's 4096",
  },
  {
    where: "rules",
    name: "★★refuse a reply of exactly the limit",
    anchor: "  if (comment.length > REVIEW_REPLY_MAX_LENGTH) {",
    mutated: "  if (comment.length >= REVIEW_REPLY_MAX_LENGTH) {",
    killer: "★★accepts a reply of exactly the limit",
  },
  {
    // ⚠️THE COLLECTION'S BOUND IS NOT GOOGLE'S. `sup_inbox.replyPublished` is
    // capped at 5000 for storage; Google refuses above 4096. Counting down to
    // the wrong one lets somebody write 4500 characters and be refused by a
    // server they cannot argue with.
    where: "rules",
    name: "★★★count down to the 5000 the collection stores, not Google's 4096",
    anchor: "export const REVIEW_REPLY_MAX_LENGTH = 4096;",
    mutated: "export const REVIEW_REPLY_MAX_LENGTH = 5000;",
    killer: "★★★names Google's 4096, not the 5000 the collection stores",
  },
  {
    where: "rules",
    name: "★★measure the cap against the untrimmed text",
    anchor: "  const comment = raw.trim();",
    mutated: "  const comment = raw;",
    killer: "★★measures the limit against the trimmed text",
  },
  {
    where: "rules",
    name: "★publish the leading and trailing whitespace too",
    anchor: "  return { ok: true, comment };",
    mutated: "  return { ok: true, comment: raw };",
    killer: "★sends the trimmed text, not what was typed",
  },
  {
    where: "rules",
    name: "★★clamp the counter at zero, so an over-long reply says 0 left",
    anchor: "  return REVIEW_REPLY_MAX_LENGTH - raw.trim().length;",
    mutated: "  return Math.max(0, REVIEW_REPLY_MAX_LENGTH - raw.trim().length);",
    killer: "★★counts down to Google's limit, and past it",
  },

  // ── What came back ───────────────────────────────────────────────────────
  {
    // ⚠️★★★THE REPLY IS LIVE. Calling this a failure makes the merchant send
    // it again, and the second one lands on top of the first on a public page.
    where: "rules",
    name: "★★★lose the sent-but-not-recorded answer, so a live reply reads as a failure",
    anchor: "  if (res.recorded === false) {",
    mutated: "  if (false) {",
    killer: "★★★treats sent-but-not-recorded as a success, not a failure",
  },
  {
    where: "rules",
    name: "★★★drop the sentence that stops the merchant sending it twice",
    anchor: '        "Don\'t send it again — the customer can already see it.",',
    mutated: '        "",',
    killer: "★★★tells the merchant NOT to send it again when we could not file it",
  },
  {
    where: "rules",
    name: "★read an api that omits `recorded` as one that failed to record",
    anchor: "  if (res.recorded === false) {",
    mutated: "  if (!res.recorded) {",
    killer: "★an api that omits `recorded` is a plain success, not an unrecorded one",
  },
  {
    where: "rules",
    name: "★★★report an unchanged reply as a fresh publish",
    anchor: "  if (!res.sent) {",
    mutated: "  if (false) {",
    killer: "★★★treats an unchanged reply as nothing-to-do, not as a failure",
  },
  {
    // ⚠️WITHOUT THE OVERRIDE, A REPLY DELETED IN GOOGLE'S OWN CONSOLE CAN
    // NEVER BE RESTORED: our row still holds the text, so every re-send
    // answers "unchanged" and the listing stays reply-less.
    // ⚠️The literal type is erased by the transpiler vitest runs, so this
    // mutant executes; the RUN is what scores it.
    where: "rules",
    name: "★★★withdraw the override, so a deleted reply can never be restored",
    anchor: "      offerForce: true,",
    mutated: "      offerForce: false,",
    killer: "★★★offers the override only on the unchanged answer",
  },

  // ── What went wrong, and whose problem it is ─────────────────────────────
  {
    // ⚠️A 503 ON GOOGLE'S ACCOUNT LISTING IS NOT A BROKEN CONNECTION. Sending
    // somebody to re-authorise a healthy grant over a transient failure is the
    // exact mistake S5·3 wrote `classifyParentLookup` to prevent.
    where: "rules",
    name: "★★★report a transient listing lookup as a broken connection",
    anchor: '  LISTING_LOOKUP_INCOMPLETE: "retry",',
    mutated: '  LISTING_LOOKUP_INCOMPLETE: "reconnect",',
    killer: "★★★never tells a merchant to fix a connection that is not broken",
  },
  {
    // ⚠️THE api's OWN MESSAGE ENDS "Retrying." — true of the publisher adapter
    // it was written for, and false here: this route answers 503 and nothing
    // retries unless the merchant presses the button.
    where: "rules",
    name: "★★★pass through a message promising a retry that is not happening",
    anchor: '  "RATE_LIMITED",\n]);',
    mutated: '  "RATE_LIMITED",\n  "LISTING_LOOKUP_INCOMPLETE",\n]);',
    killer: "★★★never tells a merchant to fix a connection that is not broken",
  },
  {
    where: "rules",
    name: "★★★render Google's raw rejection body to the merchant",
    anchor: "const API_AUTHORED_MESSAGE = new Set([",
    mutated: 'const API_AUTHORED_MESSAGE = new Set([\n  "REPLY_REJECTED",',
    killer: "★★★never renders Google's own rejection text",
  },
  {
    where: "rules",
    name: "★★★render every api message, provider text included",
    anchor: "  const authored = API_AUTHORED_MESSAGE.has(code) ? err.message?.trim() : undefined;",
    mutated: "  const authored = err.message?.trim();",
    killer: "★★★never renders Google's own rejection text",
  },
  {
    where: "rules",
    name: "★★discard the sentence the api wrote for the merchant",
    anchor: "  const authored = API_AUTHORED_MESSAGE.has(code) ? err.message?.trim() : undefined;",
    mutated: "  const authored = undefined;",
    killer: "★★renders the api's own sentence when the api wrote one",
  },
  {
    where: "rules",
    name: "★★★send a rate limit to support instead of back to the button",
    anchor: '  RATE_LIMITED: "retry",',
    mutated: '  RATE_LIMITED: "unhandled",',
    killer: "★★★sends a rate limit and an upstream wobble back to the button, not to support",
  },
  {
    where: "rules",
    name: "★★★send an upstream wobble to support instead of back to the button",
    anchor: '  UPSTREAM_ERROR: "retry",',
    mutated: '  UPSTREAM_ERROR: "unhandled",',
    killer: "★★★sends a rate limit and an upstream wobble back to the button, not to support",
  },
  {
    where: "rules",
    name: "★★★tell somebody to reconnect and give them nowhere to do it",
    anchor:
      '  const href = kind === "reconnect" || kind === "pick_location" ? PRESENCE_ROUTE : undefined;',
    mutated: '  const href = kind === "pick_location" ? PRESENCE_ROUTE : undefined;',
    killer: "★★★points a reauth at Presence, where the picker and the connect button are",
  },
  {
    where: "rules",
    name: "★★★hang a fix-your-connection link off a transient failure",
    anchor:
      '  const href = kind === "reconnect" || kind === "pick_location" ? PRESENCE_ROUTE : undefined;',
    mutated: "  const href = PRESENCE_ROUTE;",
    killer: "★★★never tells a merchant to fix a connection that is not broken",
  },
  {
    // ⚠️ONE HEALTHY CONNECTION AND THE WRONG LISTING is not the same problem
    // as no listing chosen, and "pick a location" is advice that cannot fix it.
    where: "rules",
    name: "★★★collapse the two location refusals into one piece of advice",
    anchor:
      '  LOCATION_NOT_MANAGED: "Re-pick the location on Presence, or connect the account that manages it.",',
    mutated: '  LOCATION_NOT_MANAGED: "Pick which of your locations this is, on Presence.",',
    killer: "★★★distinguishes nothing-picked from a listing this account does not manage",
  },
  {
    where: "rules",
    name: "★★drop the second sentence, leaving every refusal without a next step",
    anchor: "  const description = SECOND_SENTENCE[code] || undefined;",
    mutated: "  const description = undefined;",
    killer: "★★★distinguishes nothing-picked from a listing this account does not manage",
  },
  {
    // ⚠️A CODE WE HAVE NEVER SEEN, REPORTED AS "try again in a moment", is how
    // somebody clicks Send forty times against a permanent failure.
    where: "rules",
    name: "★★★treat every unknown code as transient",
    anchor: "  const kind = KIND_BY_CODE[code];",
    mutated: '  const kind = KIND_BY_CODE[code] ?? "retry";',
    killer: "★★★treats an unknown code as ours, never as retryable",
  },
  {
    where: "rules",
    name: "★★drop the request id support needs to find what happened",
    anchor:
      "      description: err.requestId\n        ? `Our team has the details — contact support and quote reference ${err.requestId}.`\n        : \"Our team has the details — please contact support.\",",
    mutated: '      description: "Our team has the details — please contact support.",',
    killer: "★★quotes the request id support needs",
  },
  {
    where: "rules",
    name: "★★answer a role refusal by talking about the review",
    anchor: '  FORBIDDEN: "no_permission",',
    mutated: '  FORBIDDEN: "not_repliable",',
    killer: "★★answers a role refusal about the person, not about the review",
  },
  {
    where: "rules",
    name: "★★★offer a retry on a review that can never be answered from here",
    anchor: '  NOT_A_REVIEW: "not_repliable",',
    mutated: '  NOT_A_REVIEW: "retry",',
    killer: "★★★says this one has to be answered on Google rather than offering a retry",
  },
  {
    where: "rules",
    name: "★★send an over-long reply to support instead of back to the composer",
    anchor: '  REPLY_TOO_LONG: "fix_text",',
    mutated: '  REPLY_TOO_LONG: "unhandled",',
    killer: "★★keeps the words in the composer when the words are the problem",
  },
  {
    // ⚠️ROUND 1: a `fetch` that throws never becomes an ApiError, so the card
    // handed `replyRefusal` an empty object and a merchant's own wifi became
    // "contact support quoting a reference".
    where: "rules",
    name: "★★★send a merchant's dropped connection to support",
    anchor: "  [TRANSPORT_ERROR_CODE]: \"retry\",\n  PARSE_ERROR: \"retry\",",
    mutated: "  PARSE_ERROR: \"retry\",",
    killer: "★★★sends a merchant's own dropped connection back to the button, not to support",
  },
  {
    where: "rules",
    name: "★★send a non-JSON gateway response to support",
    anchor: "  [TRANSPORT_ERROR_CODE]: \"retry\",\n  PARSE_ERROR: \"retry\",",
    mutated: "  [TRANSPORT_ERROR_CODE]: \"retry\",",
    killer: "★★a non-JSON body is the gateway wobbling, not our route answering",
  },
  {
    // ⚠️THE SAME FALSE CERTAINTY THE `recorded: false` BRANCH EXISTS TO AVOID.
    // A request that reached the route and then lost its connection may well
    // have published the reply.
    where: "rules",
    name: "★★★promise nothing was sent, on the one path that cannot know",
    anchor:
      '  [TRANSPORT_ERROR_CODE]: "Check your connection and try again — re-sending the same words is safe.",',
    mutated: '  [TRANSPORT_ERROR_CODE]: "Check your connection and try again — nothing was sent.",',
    killer: "★★★never claims nothing was sent when we never got an answer",
  },
  {
    where: "rules",
    name: "★★★render zod's own English to a merchant",
    anchor: '  "REPLY_TOO_LONG",\n  // ⚠️`VALIDATION_ERROR` IS OFF THIS LIST TOO',
    mutated: '  "REPLY_TOO_LONG",\n  "VALIDATION_ERROR",\n  // ⚠️`VALIDATION_ERROR` IS OFF THIS LIST TOO',
    killer: "★★★never renders zod's own English as merchant copy",
  },
  {
    where: "rules",
    name: "★★blame Google for a request that never reached it",
    anchor: '  VALIDATION_ERROR: "That reply couldn\'t be sent as written.",',
    mutated: '  VALIDATION_ERROR: "Google wouldn\'t accept that reply.",',
    killer: "★★says nothing about Google when nothing reached Google",
  },
  {
    // ⚠️THE ROUTE ANSWERS FORBIDDEN FOR THREE DIFFERENT THINGS, and only one
    // of them is fixed by a colleague granting a role.
    where: "rules",
    name: "★★give role advice that cannot fix two of the three FORBIDDENs",
    anchor: '  FORBIDDEN: "Publishing a reply needs editor access to this business.",',
    mutated: '  FORBIDDEN: "Someone with editor access on this business can send it for you.",',
    killer: "★★gives advice that is true of every FORBIDDEN the route can emit",
  },
  {
    // ⚠️ROUND 2: `requireRole` sends three different strings through this one
    // code, two of them internal wording and one not about roles at all.
    where: "rules",
    name: "★★★render requireRole's internal wording as merchant copy",
    anchor: '  "UNRECOGNISED_REVIEW_REFERENCE",\n  // ⚠️`FORBIDDEN` IS OFF THIS LIST',
    mutated: '  "UNRECOGNISED_REVIEW_REFERENCE",\n  "FORBIDDEN",\n  // ⚠️`FORBIDDEN` IS OFF THIS LIST',
    killer: "★★★never renders requireRole's internal wording as the headline",
  },
  {
    // ⚠️ROUND 2: that message interpolates the raw `locations/{id}` AND names a
    // different screen from the one our own second sentence points at.
    where: "rules",
    name: "★★★show a merchant a raw locations/{id} and a second screen to go to",
    anchor: '  "NO_LOCATION_PICKED",\n  // ⚠️`LOCATION_NOT_MANAGED` IS OFF IT TOO',
    mutated:
      '  "NO_LOCATION_PICKED",\n  "LOCATION_NOT_MANAGED",\n  // ⚠️`LOCATION_NOT_MANAGED` IS OFF IT TOO',
    killer: "★★★never shows a merchant a raw locations/{id} or a second screen to go to",
  },
  {
    // ⚠️ROUND 2: reachable through a 30s staleTime AND through
    // `app.onError`'s unknown-route handler — a deploy-order hazard, not a
    // hypothetical.
    where: "rules",
    name: "★★★send a vanished row to support",
    anchor: '  NOT_FOUND: "not_repliable",',
    mutated: '  NOT_FOUND: "unhandled",',
    killer: "★★★says a vanished row is gone rather than sending it to support",
  },
  {
    where: "rules",
    name: "★★tell somebody to reload nothing, on a row that is gone",
    anchor: '  NOT_FOUND: "Reload the page to see what\'s there now.",',
    mutated: '  NOT_FOUND: "",',
    killer: "★★★says a vanished row is gone rather than sending it to support",
  },
  {
    where: "rules",
    name: "★★give every refusal the retry button back",
    anchor: '  return refusal.kind === "retry";',
    mutated: "  return true;",
    killer: "★★only the transient refusals get the button back",
  },
];

/** ★THE SMOKE MUTANT: one per (file, spec) pair. */
const SMOKES = [
  {
    where: "rules",
    name: "SMOKE (rules) — no row is ever repliable",
    anchor: "export function isRepliableReview(item: ReviewItemLike): boolean {",
    mutated: "export function isRepliableReview(item: ReviewItemLike): boolean {\n  return false;",
    killer: "★★offers the composer when all three facts are present",
  },
];

const fileOf = (m) => FILES[m.where];
const ALL = [...MUTANTS, ...SMOKES];

const originals = new Map(
  [...new Set(Object.values(FILES).map((f) => f.target))].map((t) => [t, readFileSync(t, "utf8")]),
);

/**
 * ⚠️🚫★★TRY/FINALLY DOES NOT SURVIVE A SIGNAL, and this script is synchronous
 * end to end inside a blocking `spawnSync` — so a handler that restored and
 * exited would be queued behind the whole run and never fire, while merely
 * registering it suppresses Node's default terminate-on-signal. The handler
 * sets a flag, read at the macrotask the loop awaits after each mutant, by
 * which point that iteration's `finally` has already restored its own file.
 *
 * ⏸SIGKILL STILL CANNOT BE CAUGHT. `git status` after an interrupted run
 * remains the rule.
 */
let interrupted = null;
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(signal, () => {
    interrupted = signal;
  });
}

function restoreAll() {
  const failed = [];
  for (const [target, original] of originals) {
    try {
      writeFileSync(target, original, "utf8");
    } catch (err) {
      failed.push(`${target} (${err?.message ?? "write failed"})`);
    }
  }
  return failed;
}

function bailOut(signal) {
  const failed = restoreAll();
  // ⚠️`writeSync`, NOT `console.error`. `process.exit` does not flush a
  // redirected stream, and this is the line a person most needs to read.
  const message =
    failed.length === 0
      ? `\n${signal} — every target restored from memory. Verify with \`git status\`.\n`
      : `\n${signal} — RESTORE FAILED for ${failed.length} file(s):\n  ${failed.join(
          "\n  ",
        )}\n⚠️A MUTANT IS STILL IN TRACKED SOURCE. Restore it by hand before anything else.\n`;
  try {
    writeSync(2, message);
  } catch {
    /* the restore is what matters */
  }
  process.exit(failed.length === 0 ? 130 : 1);
}

// ── Anchor pre-flight ──────────────────────────────────────────────────────
let preflightFailed = false;
for (const m of ALL) {
  const { target } = fileOf(m);
  const count = originals.get(target).split(m.anchor).length - 1;
  if (count !== 1) {
    console.error(
      `ANCHOR PRE-FLIGHT FAILED: "${m.name}" matched ${count} time(s) in ${target}, expected 1` +
        `\n  anchor: ${JSON.stringify(m.anchor.slice(0, 140))}`,
    );
    preflightFailed = true;
  }
}
if (preflightFailed) process.exit(1);
console.log(`anchor pre-flight: ${ALL.length} anchors, each exactly once in its own file`);

// ── Killer pre-flight ──────────────────────────────────────────────────────
function report(spec) {
  return spawnSync(execPath, [VITEST, "run", spec, "--reporter=json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: RUN_ENV,
  });
}

function assertionsOf(r) {
  const parsed = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  return parsed.testResults.flatMap((f) => f.assertionResults);
}

const baselines = new Map();
for (const spec of [...new Set(Object.values(FILES).map((f) => f.spec))]) {
  const baseRun = report(spec);
  // ⚠️🚫★★A DEAD RUNNER IS NOT A BASELINE, and the spawn is checked BEFORE
  //  `stdout` is touched: a process that never starts returns `stdout: undefined`
  //  and `.indexOf` throws a TypeError.
  if (baseRun.error || typeof baseRun.status !== "number") {
    console.error(
      `BASELINE FAILED (${spec}): the runner did not run (${baseRun.error?.message ?? "no exit code"}).`,
    );
    process.exit(1);
  }
  if ((baseRun.stdout ?? "").indexOf("{") < 0) {
    console.error(
      `BASELINE FAILED (${spec}): the runner produced no JSON (exit ${baseRun.status}). Every ` +
        "killer would be scored against an empty list of results.",
    );
    if (baseRun.stderr) console.error(baseRun.stderr.slice(0, 2000));
    process.exit(1);
  }
  baselines.set(spec, assertionsOf(baseRun));
}

let killerFailed = false;
for (const m of ALL) {
  const { spec } = fileOf(m);
  const matches = baselines.get(spec).filter((a) => a.title === m.killer);
  if (matches.length !== 1) {
    console.error(
      `KILLER PRE-FLIGHT FAILED: "${m.killer}" appears ${matches.length} time(s) in ${spec}, expected 1`,
    );
    killerFailed = true;
  } else if (matches[0].status !== "passed") {
    console.error(
      `KILLER PRE-FLIGHT FAILED: "${m.killer}" is "${matches[0].status}" at BASELINE — an ` +
        "already-red spec scores every mutant it owns as killed.",
    );
    killerFailed = true;
  }
}
if (killerFailed) {
  for (const [spec, base] of baselines) {
    console.error(`\n${spec}:`);
    console.error(base.map((a) => `  [${a.status}] ${a.title}`).join("\n"));
  }
  process.exit(1);
}
console.log(`killer pre-flight: ${ALL.length} killers, each green at baseline\n`);

function runKiller(title, spec) {
  const r = report(spec);
  // ⚠️🚫★★A DEAD RUNNER IS NOT A KILL.
  if (r.error || typeof r.status !== "number") {
    return { killed: false, how: `the runner did not run (${r.error?.message ?? "no exit code"})` };
  }
  let all;
  try {
    all = assertionsOf(r);
  } catch {
    // ★A MUTANT THAT DOES NOT COMPILE WAS NEVER TESTED — the honest score is
    //  `survived`, not `killed`.
    return { killed: false, how: "vitest produced no JSON report" };
  }
  const mine = all.filter((a) => a.title === title);
  if (mine.length !== 1) return { killed: false, how: `designated spec vanished (${mine.length})` };
  return {
    killed: mine[0].status === "failed",
    how: mine[0].status,
    others: all.filter((a) => a.title !== title && a.status === "failed").length,
  };
}

const results = [];
for (const m of [...SMOKES, ...MUTANTS]) {
  const { target, spec } = fileOf(m);
  const original = originals.get(target);
  let r;
  try {
    writeFileSync(target, original.split(m.anchor).join(m.mutated), "utf8");
    r = runKiller(m.killer, spec);
  } finally {
    writeFileSync(target, original, "utf8"); // ★IN-MEMORY RESTORE, every time.
  }
  results.push({ ...m, ...r });
  const mark = r.killed ? "KILLED  " : "SURVIVED";
  const collateral = r.others ? `  (+${r.others} other spec(s) also failed)` : "";
  console.log(`${mark}  ${m.name}${collateral}`);
  await new Promise((resolve) => setImmediate(resolve));
  if (interrupted) bailOut(interrupted);
}

let restoreFailed = false;
for (const [target, original] of originals) {
  if (readFileSync(target, "utf8") !== original) {
    console.error(`\nRESTORE FAILED — ${target} does not match its original bytes.`);
    restoreFailed = true;
  }
}
if (restoreFailed) process.exit(1);

const survivors = results.filter((r) => !r.killed);
console.log(`\n${results.length - survivors.length}/${results.length} killed; restore verified.`);

const deadSmoke = results.filter((r) => r.name.startsWith("SMOKE") && !r.killed);
if (deadSmoke.length > 0) {
  console.error(
    "\n⚠️A SMOKE MUTANT SURVIVED. The runner is not detecting failures for that " +
      "(file, spec) pair, so every other score against it is meaningless:",
  );
  for (const s of deadSmoke) console.error(`  ${s.name} — ${s.how}`);
  process.exit(1);
}

if (survivors.length > 0) {
  console.error("\nSURVIVORS — classify each before fixing anything:");
  for (const s of survivors) console.error(`  ${s.name} (${s.how})`);
  process.exit(1);
}
console.log("every mutant killed, every smoke died.");
