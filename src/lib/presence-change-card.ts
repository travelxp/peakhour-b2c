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

const CARD_KEYS = ["id", "status", "placeName", "networkLabel", "headline", "before", "after"] as const;

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
      Array.isArray((c as { notes?: unknown }).notes),
  );
}

export type Tone = "waiting" | "progress" | "done" | "problem" | "closed";

export interface CardStatus {
  label: string;
  detail: string | null;
  tone: Tone;
  /** Approve and Discard are offered only while the change can still be decided. */
  canDecide: boolean;
}

/** What a status means to the person reading the card. `held` is the api's reason a change is approved but not yet sent. */
export function cardStatus(status: string, opts: { held?: string | null; reason?: string | null; liveNote?: string | null } = {}): CardStatus {
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
