import { priced } from "@/lib/inbox-customer";

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
  | { state: "no_listing" | "no_link"; draftPrice: number | null }
  | {
      state: "ready";
      listingId: string;
      businessName: string;
      link: string;
      network: string;
      networkLabel?: string;
      /** One SVG with its quiet zone, drawn by the api. */
      qrSvg: string;
      /** AI credits one reply draft costs; null when no price row exists. Present in every state, so the Inbox can show it before a link exists. */
      draftPrice: number | null;
    };

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

/** "Draft a reply · 4 AI credits": the price is on the button before it is pressed. With no price the button is off. */
export function draftButton(price: number | null | undefined): { text: string; available: boolean } {
  return priced("Draft a reply", price);
}

/**
 * Whether a review row may offer the draft button: it is a review we can read, and no reply is live. A rated-only review is included;
 * nothing here looks at the rating (no gating, and a one-star review needs an answer most).
 */
export function canOfferDraft(item: { kind?: string; review?: { replyPublished?: string } }): boolean {
  if (item.kind !== "review") return false;
  return !(item.review?.replyPublished ?? "").trim();
}

/** What a draft action tells the merchant on success. It never says the reply was sent. */
export const DRAFT_SAVED_NOTE = "Draft saved below. Read it and change anything before you send. Nothing is sent until you press Send.";

/** The page title of the printable poster route. */
export const POSTER_PAGE_NOTE = "Print this page on A4. Your link and QR code are the same for every customer.";
