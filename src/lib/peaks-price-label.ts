import type { RateCardUseCase } from "@/hooks/use-credits";

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
  return { label: u.minCreditsPerCall.toLocaleString(), free: false };
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
