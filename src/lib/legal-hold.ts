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

/** What is left to type. */
export function reasonCharsRemaining(raw: string): number {
  return HOLD_REASON_MAX - raw.trim().length;
}

/** How a thread is held: by name, or because its whole business is. null = not held. */
export type HeldBy = "conversation" | "business" | null | undefined;

/** The badge on a conversation, or null when it is not held. */
export function heldBadge(held: HeldBy): string | null {
  if (held === "business") return "On hold (all conversations)";
  if (held === "conversation") return "On legal hold";
  return null;
}

/** The list row only has a yes/no. */
export function rowIsHeld(held: boolean | undefined): boolean {
  return held === true;
}

/**
 * Whether the thread's own "Lift hold" is offered. A thread held because its BUSINESS is held is lifted with the business
 * hold, not on its own (the api answers 409 BUSINESS_HOLD).
 */
export function canLiftThreadHold(held: HeldBy): boolean {
  return held === "conversation";
}

/** Whether "Keep (legal hold)" is offered for a thread: not already held. */
export function canPlaceThreadHold(held: HeldBy): boolean {
  return held === null || held === undefined;
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
  truncated: boolean;
}

/** "Placed by Peakhour support" or "Placed by you or your team". */
export function placedByLabel(byKind: string | undefined): string {
  return byKind === "support" ? "Placed by Peakhour support" : "Placed by your team";
}
