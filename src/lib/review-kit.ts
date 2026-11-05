import { actionCostShort, type ActionCost } from "@/lib/action-cost";

/**
 * The review kit's words and rules (PE-05): a link, a QR code and a printable poster that ask customers for a review, and the
 * "Draft a reply" button on a review in the Inbox.
 *
 * ★★MARKUP LIVES IN THE COMPONENTS; EVERY DECISION AND SENTENCE LIVES HERE, because this repo runs vitest without JSDOM.
 *
 * ★NO NETWORK NAME IS HELD IN THIS FILE. The word a poster shows for the network ("Google") arrives as `networkLabel`, the api's copy of
 * the adapter's declaration; with none, the copy says "a review" and never guesses a name.
 *
 * ★★EVERY CUSTOMER IS ASKED, whatever they thought. Nothing here reads a rating, and the poster's wording asks for an honest review,
 * never a good one: asking only the pleased customers is review gating, which Google's policy forbids. Offering anything in return for a
 * review is forbidden too, so the copy offers nothing.
 */

export type ReviewKit =
  | { state: "no_listing" | "no_link" }
  | {
      state: "ready";
      /** Null for a network with no listing, whose link lives on its connection. */
      listingId: string | null;
      businessName: string;
      link: string;
      network: string;
      networkLabel?: string;
      /** One SVG with its quiet zone, drawn by the api. */
      qrSvg: string;
    };

/** Where "Print the poster" goes: the poster page reads the same `location` and `network` the card was drawn for, so it prints that kit. */
export function posterHref(location?: string, network?: string): string {
  const q = new URLSearchParams();
  if (location) q.set("location", location);
  if (network) q.set("network", network);
  const s = q.toString();
  return `/dashboard/presence/review-poster${s ? `?${s}` : ""}`;
}

export const REVIEW_KIT_QUERY_KEY = ["presence", "reviews", "kit"] as const;

/** What the kit card shows for a state with no link, in plain words with the next step. */
export function kitEmptyState(kit: ReviewKit | undefined): { headline: string; description: string } | null {
  if (!kit || kit.state === "ready") return null;
  if (kit.state === "no_listing") {
    return {
      headline: "Connect your listing to get a review link",
      description: "Once your listing is connected, you get a link, a QR code and a poster here.",
    };
  }
  return {
    headline: "We don't have a review link for your listing yet",
    description: "It arrives with your next sync, usually within the hour. Nothing is wrong with your listing.",
  };
}

/** "Review us on Google" or, with no declared name, "Leave us a review". */
export function askLine(kit: { networkLabel?: string }): string {
  return kit.networkLabel ? `Review us on ${kit.networkLabel}` : "Leave us a review";
}

/** The poster's copy. The same words for every customer, and no ask for stars. */
export function posterCopy(kit: { businessName: string; networkLabel?: string }): {
  businessName: string;
  headline: string;
  subline: string;
  instruction: string;
} {
  const name = kit.businessName.trim();
  return {
    businessName: name,
    headline: kit.networkLabel ? `Tell others about your visit on ${kit.networkLabel}` : "Tell others about your visit",
    subline: "An honest review helps the next customer, whatever you thought.",
    instruction: "Point your phone's camera at the code",
  };
}

/** An SVG string as an <img src>: the api draws it from numbers only, and an <img> never runs script. */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The label of the copy button, by whether the last copy worked. */
export function copyLabel(state: "idle" | "copied" | "failed"): string {
  return state === "copied" ? "Link copied" : state === "failed" ? "Copy failed. Select the link instead" : "Copy link";
}

/**
 * The "Draft a reply" button: its label and whether it may be pressed. The price is the rate card's, read through `lib/action-cost.ts`
 * (action `presenceReviewReply`), never typed here. ★OFF UNTIL A PRICE IS KNOWN: while the card loads, or when it has no row for the
 * action, the button says nothing about a price and cannot be pressed (the api refuses an unpriced draft too). "Free" is a price.
 */
export function draftButton(cost: ActionCost, hasSuggestion = false): { text: string; available: boolean } {
  const label = hasSuggestion ? "Draft again" : "Draft a reply";
  const short = actionCostShort(cost);
  return short ? { text: `${label} · ${short}`, available: true } : { text: label, available: false };
}

/**
 * Whether a review row may offer the draft button: it is a review we can answer from here (`canSend`: the composer's own test that the row
 * is a review of the network we reply on, with a reference), and no reply is live. A rated-only review is included; nothing here looks at
 * the rating (no gating, and a one-star review needs an answer most).
 */
export function canOfferDraft(item: { kind?: string; review?: { replyPublished?: string } }, canSend: boolean): boolean {
  if (!canSend || item.kind !== "review") return false;
  return !(item.review?.replyPublished ?? "").trim();
}

/** What a draft action tells the merchant on success. It never says the reply was sent. */
export const DRAFT_SAVED_NOTE = "Draft saved below. Read it and change anything before you send. Nothing is sent until you press Send.";

/** The instruction line above the printable poster (not the page title, which `page.tsx` sets). */
export const POSTER_PAGE_NOTE = "Print this page on A4. Your link and QR code are the same for every customer.";
