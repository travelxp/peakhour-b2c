import { ApiError } from "@/lib/api";

/**
 * Legal holds on assistant conversations (privacy programme H1): the inbox's "Keep (legal hold)" action.
 *
 * ★EVERY DECISION THE SCREEN MAKES IS HERE, because this repo runs vitest WITHOUT JSDOM and a rule in a component is a rule
 * nothing asserts: who is offered the action, what a valid reason is, what the badge says, and what each refusal means.
 *
 * The api is the authority on all of it (`/v1/legal-holds`, owner or admin only); this module only decides what to OFFER.
 */

/** The api's bound (peakhour-api `HOLD_REASON_MAX`, and the validator's `maxLength`). */
export const HOLD_REASON_MAX = 500;

/** Said wherever a reason is typed: the reason is kept in the audit trail beside the conversation it is about. */
export const HOLD_REASON_HINT =
  "Say why this must be kept (for example a case or request reference). Do not put the shopper's name, phone or email here.";

/** What a hold means to the merchant, shown in the dialog before they confirm. */
export const HOLD_EFFECT =
  "While this is on hold the conversation is kept past the usual 180 days, and a request from the shopper to delete their data waits until you lift the hold. Lifting it restarts the normal 180 days.";

/** Only an owner or an admin can place or lift a hold (the api refuses everyone else). */
export function canManageHolds(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export type ReasonCheck = { ok: true; reason: string } | { ok: false; problem: string };

/** A hold needs a reason of 1 to 500 characters once trimmed. */
export function checkHoldReason(raw: string): ReasonCheck {
  const reason = raw.trim();
  if (reason.length === 0) return { ok: false, problem: "Say why this conversation must be kept." };
  if (reason.length > HOLD_REASON_MAX) {
    return { ok: false, problem: `Keep the reason to ${HOLD_REASON_MAX} characters (it is ${reason.length}).` };
  }
  return { ok: true, reason };
}

export type LiftReasonCheck = { ok: true; reason: string | null } | { ok: false; problem: string };

/** Lifting a hold takes an OPTIONAL reason (the api records "Hold lifted" when there is none), still bounded at 500. */
export function checkLiftReason(raw: string): LiftReasonCheck {
  const reason = raw.trim();
  if (reason.length === 0) return { ok: true, reason: null };
  const c = checkHoldReason(reason);
  return c.ok ? { ok: true, reason: c.reason } : { ok: false, problem: c.problem };
}

export const LIFT_REASON_HINT = "Optional: why the hold is being lifted. Do not put the shopper's name, phone or email here.";

/** What is left to type. */
export function reasonCharsRemaining(raw: string): number {
  return HOLD_REASON_MAX - raw.trim().length;
}

/**
 * How a thread is held: by name, or because its whole business is. null = not held. ★undefined = UNKNOWN (an api that predates
 * holds sends nothing), which is neither held nor not-held, so no action is offered for it.
 */
export type HeldBy = "conversation" | "business" | null | undefined;

/** The badge on a conversation, or null when it is not held. */
export function heldBadge(held: HeldBy): string | null {
  if (held === "business") return "On hold (all conversations)";
  if (held === "conversation") return "On legal hold";
  return null;
}

/**
 * Whether the thread's own "Lift hold" is offered. A thread held because its BUSINESS is held is lifted with the business
 * hold, not on its own (the api answers 409 BUSINESS_HOLD).
 */
export function canLiftThreadHold(held: HeldBy): boolean {
  return held === "conversation";
}

/** Whether "Keep (legal hold)" is offered for a thread: the api said it is NOT held (null), not merely said nothing. */
export function canPlaceThreadHold(held: HeldBy): boolean {
  return held === null;
}

export const HOLDS_PATH = "/v1/legal-holds";

export function threadHoldPath(threadId: string, action: "place" | "lift"): string {
  const base = `${HOLDS_PATH}/conversations/${encodeURIComponent(threadId)}`;
  return action === "lift" ? `${base}/lift` : base;
}

export function businessHoldPath(action: "place" | "lift"): string {
  return action === "lift" ? `${HOLDS_PATH}/business/lift` : `${HOLDS_PATH}/business`;
}

/** The body of a place request; a lift's reason is optional. */
export function placeBody(reason: string): { reason: string } {
  return { reason: reason.trim() };
}

/** One sentence for a refused or failed hold action. The api's own message wins when it sent one. */
export function holdErrorMessage(err: unknown, action: "place" | "lift"): string {
  if (err instanceof ApiError && err.code !== "PARSE_ERROR") {
    const m = err.message?.trim();
    if (err.status === 403) return "Only the owner or an admin can place or lift a legal hold.";
    if (err.code === "BUSINESS_HOLD") return "This conversation is on hold because the whole business is. Lift the business hold instead.";
    if (err.code === "NOT_HELD") return "That is no longer on hold. Reload to see where it stands.";
    if (err.code === "NOT_FOUND") return "That conversation could not be found.";
    return m && m !== "Request failed" ? m : `Couldn't ${action} the hold.`;
  }
  return `We couldn't confirm whether the hold was ${action === "place" ? "placed" : "lifted"}. Reload to check before trying again.`;
}

/** A held thread's date, for the list: "Held since 2 Nov 2026" (UTC, so the text does not depend on the machine's zone). */
export function heldSince(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `Held since ${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The api's listing (`GET /v1/legal-holds`). */
export interface HoldsListing {
  business: { heldAt: string; heldBy: string | null; byKind: string; reason: string } | null;
  conversations: Array<{
    threadId: string;
    heldAt: string;
    heldBy: string | null;
    byKind: "merchant" | "support";
    reason: string;
    scope: "conversation" | "business";
    eraseDeferred: boolean;
  }>;
  /** How many conversations lifting the BUSINESS hold deletes at once. Absent from an api that predates it: read as UNKNOWN (the lift is not offered). */
  deferredEraseCount?: number;
  truncated: boolean;
}

/**
 * ★LIFTING A HOLD CAN DELETE. A conversation whose erasure was deferred while it was held (the store uninstalled, or the customer
 * asked to be erased) is deleted AT ONCE when the hold is lifted: no 180 days, no 7-day undo. The confirmation must say so.
 * The api's own lift reports `erasedOnLift` only after the fact; these read the listing before.
 */
export const LIFT_AND_DELETE_LABEL = "Lift and delete";

/** The confirm button of a lift: "Lift and delete" when the dialog carries a deletion warning, else the plain label. */
export function liftConfirmLabel(warning: string | null, plain: string): string {
  return warning ? LIFT_AND_DELETE_LABEL : plain;
}

/** The one sentence a single-conversation lift shows when the lift deletes that conversation. */
export const THREAD_LIFT_DELETES =
  "Lifting this hold deletes this conversation permanently right away, because the store or the customer asked for it to be erased. This cannot be undone.";

/** The sentence a business-wide lift shows when `count` conversations would be deleted at once; null when none would. */
export function businessLiftDeletes(count: number | null | undefined): string | null {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 1) return null;
  const n = Math.floor(count);
  return `Lifting this hold deletes ${n} ${n === 1 ? "conversation" : "conversations"} permanently right away, because the store or the customer asked for ${n === 1 ? "it" : "them"} to be erased. This cannot be undone.`;
}

/**
 * The deletion warning for lifting THIS conversation's hold: the sentence, null when the lift deletes nothing, or ★undefined when the
 * listing is not known (not loaded, or it failed), which is neither: the caller must not offer the lift then, because a lift that
 * deletes would look like an ordinary one. (The api lists every erase-deferred conversation even past its cap, so "listed with the
 * flag clear, or not listed" means nothing is waiting.)
 */
export function threadLiftWarning(listing: HoldsListing | undefined, threadId: string): string | null | undefined {
  if (!listing) return undefined;
  return listing.conversations.some((c) => c.threadId === threadId && c.eraseDeferred === true) ? THREAD_LIFT_DELETES : null;
}

/** The same for the business-wide lift: the sentence with the count, null when it deletes nothing, undefined when unknown. */
export function businessLiftWarning(listing: HoldsListing | undefined): string | null | undefined {
  // A listing without the count (an api that predates it) is UNKNOWN, not zero: the lift would be offered blind.
  if (!listing || typeof listing.deferredEraseCount !== "number") return undefined;
  return businessLiftDeletes(listing.deferredEraseCount);
}

/** A refetch that failed still resolves, with the OLD data; only a successful one may be believed. */
export function freshListing(r: { status: string; data?: HoldsListing }): HoldsListing | undefined {
  return r.status === "success" ? r.data : undefined;
}

/** Said when the check above could not be made, instead of opening a lift whose effect is unknown. */
export const LIFT_CHECK_FAILED = "Couldn't check whether lifting this hold deletes anything. Try again in a moment.";

/**
 * The line under the business-wide hold: when, by whom, and why, with no empty fragment (a missing or bad date is left out
 * rather than leaving ". ." in the sentence).
 */
export function businessHoldLine(b: { heldAt: string; byKind: string; reason: string }): string {
  const parts = [heldSince(b.heldAt), placedByLabel(b.byKind)].filter(Boolean);
  return `${parts.join(". ")}. Reason: ${b.reason}`;
}

/**
 * The last six characters of a thread key (a pseudonym, never a number), so two conversations held for the same reason can be
 * told apart in the list.
 */
export function threadTail(threadId: string): string {
  return threadId.slice(-6);
}

/** "Placed by Peakhour support" or "Placed by you or your team". */
export function placedByLabel(byKind: string | undefined): string {
  return byKind === "support" ? "Placed by Peakhour support" : "Placed by your team";
}
