import { describe, it, expect, vi } from "vitest";
import { quoteCostSentence, quotePrice, peaksPrice } from "@/lib/peaks-price-label";
import { formatPeaks } from "@/lib/pricing";

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

  it("★groups a large figure through the PINNED formatter", () => {
    // ⚠️COMPUTED, NOT HARDCODED (round 1). A literal "12,000" passes against
    // a bare `toLocaleString()` on an en-US host and fails on an en-IN one,
    // which is the host-locale drift `pricing.ts` pinned en-US to remove —
    // so the literal would have asserted the defect away. The sibling test in
    // `peaks-price-label.test.ts` already computes it.
    expect(quotePrice({ free: false, peaks: 12000 }).label).toBe(formatPeaks(12000));
    expect(quoteCostSentence({ free: false, peaks: 12000 })).toContain(formatPeaks(12000));
  });
});

describe("★the quote and rate-card renderers agree about free", () => {
  it("both say Free for a free act, from their own flag", () => {
    // Two renderers, one rule. They took different arguments because they read
    // different sources — that is precisely how the last pair came to disagree,
    // and why the agreement is asserted rather than assumed.
    expect(quotePrice(free).label).toBe(
      peaksPrice({ free: true, creditMultiplier: 0 }).label,
    );
    expect(quotePrice(freeButPriced).label).toBe(
      peaksPrice({ free: true, creditMultiplier: 10 }).label,
    );
  });
});

describe("★★the PINNED formatter, proven against the host locale (round 2)", () => {
  /**
   * ── ⚠️★★WHY A SPY AND NOT A LITERAL, AND THE MUTATION RUN IS THE REASON
   *
   * `formatPeaks` pins **en-US**, and the host this suite runs on IS en-US
   * — so `(12000).toLocaleString()` and `formatPeaks(12000)` produce the
   * SAME STRING here. Swapping the pinned formatter for a bare
   * `toLocaleString()` therefore left both renderers green, and only the
   * mutation run knew. The sibling test above computes its expectation
   * through `formatPeaks` precisely so it is not a hardcoded literal, and
   * that still does not help: both sides of the comparison move together.
   *
   * ★THE DEFECT ONLY SHOWS ON AN en-IN HOST, which is the one place this
   * suite never runs — the same shape as a date assertion that is green
   * locally and red on CI, one locale later. What distinguishes the two
   * calls EVERYWHERE is not the output, it is the ARGUMENT: the pinned
   * call names a locale and the host-locale call names nothing. So that
   * is what is asserted.
   */
  function assertNeverFormatsWithoutALocale(render: () => unknown) {
    const spy = vi.spyOn(Number.prototype, "toLocaleString");
    try {
      render();
      // ⚠️A RENDERER THAT FORMATTED NOTHING would pass the loop below
      // vacuously — nought calls, nought bad calls.
      expect(spy).toHaveBeenCalled();
      for (const call of spy.mock.calls) {
        expect(call.length).toBeGreaterThan(0);
      }
    } finally {
      spy.mockRestore();
    }
  }

  it("★★quoteCostSentence names the locale it formats in", () => {
    assertNeverFormatsWithoutALocale(() =>
      quoteCostSentence({ free: false, peaks: 12000 }),
    );
  });

  it("★★quotePrice names the locale it formats in", () => {
    assertNeverFormatsWithoutALocale(() => quotePrice({ free: false, peaks: 12000 }));
  });

  it("★★and so does peaksPrice — the renderer this pair must AGREE with", () => {
    // ⚠️★FOUND BY THIS VERY RUN, AND IT WAS NOT THIS ROW’S CODE.
    // `peaksPrice` read a BARE `toLocaleString()` while `quotePrice`,
    // eight lines below it in the same file, was pinned -- so on an
    // en-IN browser the rate card rendered "1,00,000" beside a quote
    // reading "100,000". That is the precise inconsistency
    // `pricing.ts` pinned a locale to END: *"prices and Peaks used to
    // run through different code paths, so an en-IN host rendered
    // ₹2,49,999 beside 100,000"*.
    //
    // ★AND ITS OWN TEST COULD NOT SEE IT: it asserted against
    // `(1500).toLocaleString()`, a bare call on BOTH sides of the
    // comparison, so the expectation moved with the host exactly as
    // the thing it was checking did.
    assertNeverFormatsWithoutALocale(() =>
      peaksPrice({ free: false, creditMultiplier: 12000 }),
    );
  });
});
