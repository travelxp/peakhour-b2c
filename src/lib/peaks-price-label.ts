import type { RateCardUseCase } from "@/hooks/use-credits";
import { formatPeaks } from "@/lib/pricing";

/**
 * What a task's price says to the merchant.
 *
 * ── ★★WHY THIS IS ONE FUNCTION AND NOT AN INLINE TERNARY ──────────────────
 *
 * There were two, they disagreed, and both were wrong about the same thing.
 *
 *   - The Peaks rate card rendered a free task's price as **"—"**, because it
 *     branched on `minCreditsPerCall > 0`. A dash reads as "not applicable".
 *   - `ExplainCard` rendered **"Uses Peaks."** for a free task, because
 *     `cost ? … : …` treats a multiplier of `0` as falsy. That one is worse:
 *     it is shown beside the button, BEFORE the merchant clicks, and it says a
 *     free action costs money.
 *
 * The api added a derived `free` flag precisely so callers would stop deriving
 * this from the number, and its own field comment says so — *"RENDER 'Free',
 * NEVER '0 Peaks' … Callers must branch on THIS"*. Neither caller did, because
 * the field was never added to the b2c type. One function, so the next surface
 * inherits the answer instead of re-deriving it.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 *
 * A zero price and a free task are the same number and a different promise.
 * "0 Peaks" reads as a price somebody forgot to set; on the safety check — the
 * one act we most want a merchant to know is free — it reads worst of all.
 */

/** A price the merchant can be shown, and whether it is free. */
export interface PeaksPrice {
  /** "Free", or a Peaks figure. Never "0", never "—". */
  label: string;
  free: boolean;
}

/**
 * ⚠️ `free` IS AUTHORITATIVE; THE NUMBER IS NOT. A row can carry a non-zero
 * multiplier and still be free (`customerBillable: false` with a price left on
 * the row from before it was made free), which is exactly the state
 * `linkedin.lead_qualify` and `growth.ask_design` are in today. Reading the
 * number first would put a price on both.
 */
export function peaksPrice(u: Pick<RateCardUseCase, "free" | "minCreditsPerCall">): PeaksPrice {
  if (u.free) return { label: "Free", free: true };
  // WARN THE PINNED FORMATTER (review round 2). This read a BARE
  // `toLocaleString()` -- the HOST locale -- while `quotePrice` sixty
  // lines below it was pinned to en-US, so on an en-IN browser the rate
  // card rendered "1,00,000" beside a quote reading "100,000".
  // `pricing.ts` pinned a locale to END exactly that: *prices and Peaks
  // used to run through different code paths, so an en-IN host rendered
  // a rupee price in Indian grouping beside an allowance in Western*.
  //
  // STAR ITS OWN TEST COULD NOT SEE IT, which is why a MUTATION found it
  // and review did not: the assertion compared against
  // `(1500).toLocaleString()` -- a bare call on BOTH sides -- so the
  // expectation drifted with the host in step with the code it checked.
  return { label: formatPeaks(u.minCreditsPerCall), free: false };
}

/**
 * The sentence shown beside an action, before the merchant takes it.
 *
 * `undefined` means the rate card has not loaded — deliberately distinct from
 * free, and rendered as unit-less copy rather than a number we do not have.
 * Guessing here is how a merchant is quoted a price we then do not charge.
 */
export function peaksCostSentence(
  u: Pick<RateCardUseCase, "free" | "creditMultiplier"> | undefined,
): string {
  if (!u) return "Uses Peaks.";
  if (u.free) return "Free — you are never charged for this.";
  return `Uses about ${u.creditMultiplier} Peaks.`;
}

/**
 * The sentence shown beside a metered action when we hold a QUOTE for it
 * (P-10, §7.0.1 requirement 4).
 *
 * ── ★WHY THIS IS NOT `peaksCostSentence` WITH A DIFFERENT ARGUMENT ────────
 *
 * Because the two say different things, and the difference is the whole point
 * of a quote. `peaksCostSentence` reads the rate card and hedges — *"uses
 * ABOUT 20 Peaks"* — because the card is a price list and the act might bill
 * more than one useCase. A quote is the api's own total for THIS act, signed,
 * and honoured for as long as the token lives: there is nothing to hedge.
 *
 * ★SO THE HEDGE IS DROPPED ONLY WHERE IT IS EARNED. Saying "about" beside a
 * binding number would understate what we are promising; saying an exact
 * number beside a rate-card row would overstate it. Same rule, two honest
 * sentences.
 *
 * ── ⚠️THE FOUR STATES, AND THE FOURTH IS THE ONE THAT GETS DROPPED ────────
 *
 * `undefined` is *"we do not know yet"* — loading, or a quote we could not
 * fetch — and it is NOT free, NOT a number, and NOT a reason to hide the
 * button. The advertising-declaration card's post-mortem is the precedent, in
 * its own words: *"a consent surface has four states and the fourth is 'we do
 * not know yet'; treating it as either of the other three is how a form
 * collects an answer nobody gave."* Here the equivalent mistake is quoting a
 * price we do not have.
 */
export function quoteCostSentence(
  quote: { free: boolean; peaks: number } | undefined,
): string {
  if (!quote) return "Uses Peaks.";
  if (quote.free) return "Free — you are never charged for this.";
  // WARN `formatPeaks`, NOT A BARE `toLocaleString()` (round 1). The default
  // locale is the host's, so an en-IN merchant reads 'Costs 1,00,000 Peaks.'
  // beside '100,000' rendered by the pricing card two components away --
  // which `pricing.ts` pinned en-US for in the first place.
  return `Costs ${formatPeaks(quote.peaks)} Peaks.`;
}

/**
 * A quote's price, for a figure rendered on its own (a chip, a table cell).
 *
 * ★THE SAME RULE AS `peaksPrice`, READ OFF THE QUOTE'S OWN `free`. A quote's
 * `peaks` is 0 when it is free — the api says so and says why: *"`peaks` is 0
 * rather than absent so a client that ignores the flag renders a wrong number
 * instead of crashing"*. This is the caller that does not ignore it.
 */
export function quotePrice(quote: { free: boolean; peaks: number }): PeaksPrice {
  if (quote.free) return { label: "Free", free: true };
  return { label: formatPeaks(quote.peaks), free: false };
}
