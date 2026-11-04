/**
 * The words and rules of Ask Peakhour's listing-change card (PE-09). PURE: the component is markup over these.
 *
 * ★THE CARD IS THE STORED ROW. Its headline, before and after arrive from the api, built from the stored change, never from the
 * assistant's text. Its status is read again from the api by id, so a card shown tomorrow says today's status, and a change a person
 * already approved cannot be approved from a stale card.
 *
 * ★NOTHING SAYS "LIVE" UNTIL THE API SAYS A READ PROVED IT. "Approved" is not "sent", and "sent" is not "live".
 */

export interface ListingChangeCardData {
  type: "listing_change";
  id: string;
  status: string;
  placeName: string;
  networkLabel: string;
  field: string;
  fieldLabel: string;
  headline: string;
  before: string;
  after: string;
  notes: string[];
  blockedReason: string | null;
  awaitingApproval: boolean;
  expiresAt: string;
}

/** The result of the assistant's change tool, as the app receives it. */
export interface ProposeToolOutput {
  status: string;
  cards?: unknown[];
}

const CARD_KEYS = ["id", "status", "placeName", "networkLabel", "field", "fieldLabel", "headline", "before", "after", "expiresAt"] as const;

/** The cards in a tool's output that have the shape the app draws. Anything else is dropped, as `parseCards` drops it on the server. */
export function cardsOf(output: unknown): ListingChangeCardData[] {
  const cards = (output as ProposeToolOutput | null | undefined)?.cards;
  if (!Array.isArray(cards)) return [];
  return cards.filter(
    (c): c is ListingChangeCardData =>
      !!c &&
      typeof c === "object" &&
      (c as { type?: unknown }).type === "listing_change" &&
      CARD_KEYS.every((k) => typeof (c as Record<string, unknown>)[k] === "string") &&
      Array.isArray((c as { notes?: unknown }).notes) &&
      (c as { notes: unknown[] }).notes.every((n) => typeof n === "string"),
  );
}

/** The statuses a person can still decide on. */
const DECIDABLE = new Set(["proposed", "validated"]);

/** Statuses that never change again: a card in one of them needs no read to be shown. */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["rejected", "expired", "superseded", "failed", "blocked", "live"]);

/** When a card that is still waiting runs out of time, in ms since the epoch, or null when it is not waiting or the time is unreadable. */
export function expiryOf(card: Pick<ListingChangeCardData, "status" | "expiresAt">): number | null {
  if (!DECIDABLE.has(card.status)) return null;
  const at = Date.parse(card.expiresAt);
  return Number.isNaN(at) ? null : at;
}

/** Shown while the live status is being read, and when it could not be: no Approve, because a stale card must not be approvable. */
export const UNREAD_STATUS: CardStatus = { label: "Checking", detail: null, tone: "closed", canDecide: false };
export const UNREADABLE_STATUS: CardStatus = { label: "Status unavailable", detail: "We could not check this change just now. Open the Presence page to see it.", tone: "closed", canDecide: false };

export type Tone = "waiting" | "progress" | "done" | "problem" | "closed";

export interface CardStatus {
  label: string;
  detail: string | null;
  tone: Tone;
  /** Approve and Discard are offered only while the change can still be decided. */
  canDecide: boolean;
}

/** What a status means to the person reading the card. `held` is the api's reason a change is approved but not yet sent. */
export function cardStatus(
  status: string,
  opts: { held?: string | null; reason?: string | null; liveNote?: string | null; expiresAt?: string | null; now?: number } = {},
): CardStatus {
  // The api closes an unanswered proposal lazily, so a change past its time can still read "proposed": it is expired to the person reading it.
  if (DECIDABLE.has(status) && opts.expiresAt && Date.parse(opts.expiresAt) <= (opts.now ?? Date.now())) status = "expired";
  switch (status) {
    case "proposed":
    case "validated":
      return { label: "Waiting for your approval", detail: null, tone: "waiting", canDecide: true };
    case "approved":
      return {
        label: "Approved",
        detail: opts.held ? opts.held : "It will be sent shortly. It is not live yet.",
        tone: "progress",
        canDecide: false,
      };
    case "applying":
      return { label: "Being sent", detail: "It is not live yet.", tone: "progress", canDecide: false };
    case "submitted":
      return { label: "Sent", detail: opts.liveNote ?? "We are waiting to see it on the listing. It is not confirmed live yet.", tone: "progress", canDecide: false };
    case "live":
      return { label: "Live", detail: "We checked, and the listing shows it.", tone: "done", canDecide: false };
    case "failed":
      return { label: "Could not be sent", detail: opts.reason ?? "Nothing was changed on the listing.", tone: "problem", canDecide: false };
    case "blocked":
      return { label: "Held", detail: opts.reason ?? "This change cannot be sent right now.", tone: "problem", canDecide: false };
    case "rejected":
      return { label: "Discarded", detail: "Nothing was changed.", tone: "closed", canDecide: false };
    case "expired":
      return { label: "Expired", detail: "It was not approved in time. Ask again.", tone: "closed", canDecide: false };
    case "superseded":
      return { label: "Replaced", detail: null, tone: "closed", canDecide: false };
    default:
      return { label: "Unknown", detail: null, tone: "closed", canDecide: false };
  }
}

/** The cards of several tool outputs, once per change: a change prepared and then listed in one reply is one card. */
export function uniqueCards(outputs: readonly unknown[]): ListingChangeCardData[] {
  const seen = new Set<string>();
  const out: ListingChangeCardData[] = [];
  for (const o of outputs) {
    for (const c of cardsOf(o)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}
