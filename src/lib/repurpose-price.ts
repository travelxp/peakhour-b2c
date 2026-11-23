import type { RepurposeChannelPrice } from "@/lib/api/repurpose";
import type { RepurposeQuoteState } from "@/hooks/use-repurpose-quote";
import { formatPeaks } from "@/lib/pricing";

/**
 * What the Repurpose sheet says about price, in one place so the rows and the footer cannot disagree.
 *
 * Prices are in Peaks, never in money (owner rule), and every number is the api's binding quote: nothing here is typed. A free
 * price is said as "Free", never "0 Peaks".
 */

/** The price beside one ticked channel, or null when there is nothing to say (it is not ticked, or no price has arrived for it yet). */
export function channelPriceText(price: RepurposeChannelPrice | undefined, free: boolean): string | null {
  if (!price) return null;
  // The api writes nothing for this channel (a web page, a channel it has no writer for): say so rather than leave the row silent.
  if (price.kind === "none") return "Not written here";
  if (free || !(price.peaks > 0)) return "Free";
  return `${formatPeaks(price.peaks)} Peaks`;
}

/** A price came back and no ticked channel is written for: there is nothing to press Generate for. */
export function nothingToWrite(state: RepurposeQuoteState): boolean {
  return !!state.quote && !state.quote.posts && !state.quote.articles;
}

/** What the footer says before the merchant presses Generate. Always says whether a price is held, so the button's state is explained. */
export function repurposeFooterText(state: RepurposeQuoteState, ticked: number): string {
  if (ticked === 0) return "Tick a channel to see the price.";
  if (state.quote) {
    const q = state.quote;
    // Nothing ticked is written by a model: not "free", nothing at all (and Generate is off).
    if (nothingToWrite(state)) return "Nothing is written for the channels ticked, so there is nothing to generate.";
    if (q.free) return "Free — you are never charged for this.";
    return `Costs up to ${formatPeaks(q.totalPeaks)} Peaks. You pay only for what is written.`;
  }
  if (state.loading) return "Working out the price…";
  // Nothing is run that was not priced, so the button is off and this says why.
  return "We cannot show the price right now, so nothing can be written. Try again in a moment.";
}
