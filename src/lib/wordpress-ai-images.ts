/**
 * AI featured images for WordPress, in Peaks (CS-5b): the card's data and wording.
 *
 * The api is `GET/PUT /v1/ai-featured-images`. It is OFF until the merchant turns it on here with a monthly limit in Peaks, because the Peakhour
 * plugin has no price screen of its own: THIS card is where the price is shown and accepted. NO PRICE IS TYPED HERE: every number on screen is the
 * api's, which reads the rate card. A price that is null (no row) is said, never shown as 0 or hidden. Peaks only: no currency figure beside a price.
 */

export interface AiFeaturedImagesStatus {
  enabled: boolean;
  /** The merchant's monthly limit in Peaks; null until they have set one. */
  monthlyCapPeaks: number | null;
  usedPeaks: number;
  remainingPeaks: number | null;
  /** Today's price per image; null when the api cannot price it. */
  pricePerImagePeaks: number | null;
  /** The price the merchant accepted. */
  acceptedPricePeaks: number | null;
  /** The price went up after they accepted: images stay off until they accept again. */
  needsReaccept: boolean;
}

export interface AiFeaturedImagesInput {
  enabled: boolean;
  monthlyCapPeaks?: number;
  acceptedPricePeaks?: number;
}

export const peaksWord = (n: number): string => `${n.toLocaleString("en-US")} Peak${n === 1 ? "" : "s"}`;

/** How many images a limit covers at a price, whole images only. */
export function imagesCovered(capPeaks: number, pricePeaks: number): number {
  return pricePeaks > 0 ? Math.floor(capPeaks / pricePeaks) : 0;
}

/** The limit offered first: five images' worth. */
export function suggestedCap(pricePeaks: number): number {
  return pricePeaks * 5;
}

/** A whole number of Peaks from what was typed, or null. Commas and spaces are ignored. */
export function parseCap(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, "");
  if (!/^\d{1,7}$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n >= 1 ? n : null;
}

export const WP_IMAGES_COPY = {
  title: "AI featured images for WordPress",
  intro: "When this is on, the Peakhour plugin can make an AI image for a post. It is off until you turn it on, and Peakhour never goes past the monthly limit you set.",
  switchLabel: "AI featured images",
  switchHelp: "While this is off, the plugin makes no AI image and your post goes out without one.",
  on: "On",
  off: "Off",
  noPrice: "The price of an AI image is not set yet, so it cannot be turned on.",
  limitLabel: "Monthly limit (Peaks)",
  saveLimit: "Save limit",
  confirmTitle: "Turn on AI featured images?",
  yes: "Yes, turn on",
  no: "No",
  needsReaccept: "The price has changed, so AI images are paused. Check the new price and turn them on again.",
  reaccept: "Accept the new price",
  adminOnly: "Changing this uses Peaks, so it takes an owner or admin.",
  loadFailed: "AI featured image settings could not be loaded.",
  limitInvalid: "Enter a whole number of Peaks, 1 or more.",
} as const;

/** "Each image costs 250 Peaks, and only when the image arrives." */
export function priceLine(price: number | null): string | null {
  return price === null ? null : `Each image costs ${peaksWord(price)}, and only when the image arrives.`;
}

/** "Used this month: 500 of 1,250 Peaks." */
export function usageLine(s: Pick<AiFeaturedImagesStatus, "usedPeaks" | "monthlyCapPeaks">): string | null {
  return s.monthlyCapPeaks === null ? null : `Used this month: ${s.usedPeaks.toLocaleString("en-US")} of ${peaksWord(s.monthlyCapPeaks)}.`;
}

/** The one plain sentence in the confirmation, with the price and the limit. */
export function confirmSentence(price: number, cap: number): string {
  const n = imagesCovered(cap, price);
  return `Each AI image costs ${peaksWord(price)}, charged only when the image arrives. Peakhour will stop at ${peaksWord(cap)} a month, which is ${n} ${n === 1 ? "image" : "images"}.`;
}

/** The api's own sentence when it sent one, else a next step: never a bare code. */
export function wpImagesErrorMessage(err: unknown): string {
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" && m.trim() ? m : "That did not work. Check your connection and try again.";
}
