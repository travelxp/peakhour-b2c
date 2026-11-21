/**
 * Posting to X, in Peaks (MR-X1): the X card's data and wording.
 *
 * The api is `GET /v1/x/content/posting` (the two prices from the rate card and the "posts with links" switch),
 * `PUT /v1/x/content/posting/links` and `POST /v1/x/content/posting/quote`. NO PRICE IS TYPED HERE: every number on screen is the api's,
 * which reads the rate card. A price that is null (no row) is said, never shown as 0 or hidden.
 */

export interface XPostingPrices {
  /** Peaks for a post with no link. */
  plain: number | null;
  /** Peaks for a post with a link. */
  link: number | null;
}

export interface XPostingStatus {
  connected: boolean;
  connectionId: string | null;
  prices: XPostingPrices;
  linksEnabled: boolean;
}

export interface XPostQuote {
  allowed: boolean;
  /** x_link_held | x_price_missing | x_no_peaks | not_connected */
  reason?: string;
  message?: string;
  total: number | null;
  posts: Array<{ hasLink: boolean; peaks: number | null }>;
}

/** The scheduler's code for a post held because it has a link while the switch is off. */
export const X_LINK_HELD_CODE = "validation_x_link_held";

export const peaksWord = (n: number): string => `${n.toLocaleString("en-US")} Peak${n === 1 ? "" : "s"}`;

export const X_POSTING_COPY = {
  title: "Posting to X",
  intro: "Each post Peakhour publishes to X uses Peaks. X charges a lot more for a post that has a link in it, so links are off until you turn them on.",
  switchLabel: "Posts with links",
  switchHelp: "While this is off, Peakhour never sends a link to X.",
  on: "On",
  off: "Off",
  connectFirst: "Connect your X account first, then come back here to set up posting.",
  noPrice: "The price of an X post is not set yet, so posts cannot be sent.",
  confirmTitle: "Turn on posts with links?",
  yes: "Yes",
  no: "No",
  loadFailed: "X posting could not be loaded.",
} as const;

/** "Posts: 20 Peaks each. Posts with a link: 240 Peaks each." */
export function priceLine(p: XPostingPrices): string | null {
  if (p.plain === null && p.link === null) return null;
  const plain = p.plain === null ? "Posts: price not set." : `Posts: ${peaksWord(p.plain)} each.`;
  const link = p.link === null ? "Posts with a link: price not set." : `Posts with a link: ${peaksWord(p.link)} each.`;
  return `${plain} ${link}`;
}

/** The one plain sentence in the confirmation, with the price. */
export function confirmSentence(p: XPostingPrices): string {
  return p.link === null
    ? "X charges more for a post with a link, so each one will use more Peaks."
    : `Each post with a link will use ${peaksWord(p.link)}, instead of ${p.plain === null ? "the usual price" : peaksWord(p.plain)} for a post without one.`;
}

/** What the composer shows under a draft: "This post costs 20 Peaks" / "240 Peaks, it has a link". */
export function postCostLine(q: Pick<XPostQuote, "total" | "posts"> | undefined): string | null {
  if (!q || q.total === null || q.posts.length === 0) return null;
  const links = q.posts.filter((p) => p.hasLink).length;
  if (q.posts.length === 1) return links === 1 ? `This post costs ${peaksWord(q.total)}: it has a link.` : `This post costs ${peaksWord(q.total)}.`;
  const tail = links > 0 ? ` ${links} ${links === 1 ? "post has" : "posts have"} a link.` : "";
  return `This thread costs ${peaksWord(q.total)} (${q.posts.length} posts).${tail}`;
}

/** The choice buttons on a post held for its link. */
export const heldChoiceLabels = (link: number | null): { without: string; with: string } => ({
  without: "Post without the link",
  with: link === null ? "Post with the link" : `Post with the link: ${peaksWord(link)}`,
});

export const HELD_COPY = {
  title: "Held: this post has a link",
  body: "Posts with links are off for X, so Peakhour did not send it. Nothing has been changed. Choose what to do.",
  withNote: "Posting with the link is for this post only. It does not turn links on.",
} as const;

/** The api's own sentence when it sent one, else a next step: never a bare code. */
export function xPostingErrorMessage(err: unknown): string {
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" && m.trim() ? m : "That did not work. Check your connection and try again.";
}
