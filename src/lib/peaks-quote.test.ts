import { describe, it, expect } from "vitest";
import { quoteCostSentence, quotePrice, peaksPrice } from "@/lib/peaks-price-label";

/**
 * ★★THE PRICE BEFORE THE ASK (P-10, §7.0.1 requirement 4).
 *
 * ── ⚠️THE DEFECT THIS EXISTS FOR, WHICH HAS HAPPENED ONCE ALREADY ─────────
 *
 * `RateCardUseCase.free` carried the instruction *"RENDER 'Free', NEVER
 * '0 Peaks' … Callers must branch on THIS"* in its own field comment, and **no
 * caller branched on it**, because the field was never added to any client
 * type. Five surfaces then rendered a free act five different wrong ways —
 * `—`, *"Uses Peaks."* beside the button, `0`, literally `0 Peaks`, and the row
 * omitted entirely (§7.0.1's correction box).
 *
 * The quote carries the same flag for the same reason, and these are the tests
 * that make the next surface inherit the answer rather than re-derive it.
 */

const free = { free: true, peaks: 0 };
const billable = { free: false, peaks: 40 };
/** ⚠️A row can be FREE and still carry a non-zero figure — `customerBillable:
 *  false` with a price left on the row. `linkedin.lead_qualify` and
 *  `growth.ask_design` are in that state today, so this is not hypothetical. */
const freeButPriced = { free: true, peaks: 10 };

describe("★★quoteCostSentence — the sentence beside the button", () => {
  it("★★says Free, never a zero", () => {
    expect(quoteCostSentence(free)).toBe("Free — you are never charged for this.");
    expect(quoteCostSentence(free)).not.toMatch(/0/);
  });

  it("★★says Free even when the row still carries a number", () => {
    // `free` is authoritative and the figure is not. Reading the number first
    // would put a price on an act we never charge for.
    expect(quoteCostSentence(freeButPriced)).toBe("Free — you are never charged for this.");
    expect(quoteCostSentence(freeButPriced)).not.toMatch(/10/);
  });

  it("★states an EXACT figure for a quote, where the rate card hedges", () => {
    // A quote is the api's own total for this act, signed and honoured — there
    // is nothing to hedge. Saying "about" beside a binding number would
    // understate what we are promising.
    expect(quoteCostSentence(billable)).toBe("Costs 40 Peaks.");
    expect(quoteCostSentence(billable)).not.toMatch(/about/i);
  });

  it("★★an ABSENT quote is neither free nor a number", () => {
    // ⚠️THE FOURTH STATE. "We do not know yet" is not "free" and not a price:
    // quoting a figure we do not have is the false-price-at-the-moment-of-the-ask
    // that this whole requirement exists to remove.
    expect(quoteCostSentence(undefined)).toBe("Uses Peaks.");
    expect(quoteCostSentence(undefined)).not.toMatch(/free/i);
    expect(quoteCostSentence(undefined)).not.toMatch(/\d/);
  });
});

describe("quotePrice — the figure on its own", () => {
  it("renders Free rather than 0", () => {
    expect(quotePrice(free)).toEqual({ label: "Free", free: true });
  });

  it("★and Free rather than the number a free row still carries", () => {
    expect(quotePrice(freeButPriced)).toEqual({ label: "Free", free: true });
  });

  it("groups a large figure the way a merchant reads one", () => {
    expect(quotePrice({ free: false, peaks: 12000 }).label).toBe("12,000");
  });
});

describe("★the quote and rate-card renderers agree about free", () => {
  it("both say Free for a free act, from their own flag", () => {
    // Two renderers, one rule. They took different arguments because they read
    // different sources — that is precisely how the last pair came to disagree,
    // and why the agreement is asserted rather than assumed.
    expect(quotePrice(free).label).toBe(
      peaksPrice({ free: true, minCreditsPerCall: 0 }).label,
    );
    expect(quotePrice(freeButPriced).label).toBe(
      peaksPrice({ free: true, minCreditsPerCall: 10 }).label,
    );
  });
});
