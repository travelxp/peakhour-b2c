import { describe, it, expect } from "vitest";
import { peaksPrice, peaksCostSentence } from "./peaks-price-label";
import { formatPeaks } from "@/lib/pricing";

/**
 * ★THE TRANSPARENCY RULE, AS A SPEC.
 *
 * "Anything free is shown as Free — never absent, never '0 Peaks'." Both
 * surfaces broke it in different directions before this existed: the rate card
 * rendered a free task as "—", and the Explain card said "Uses Peaks." beside
 * the button, BEFORE the click, about something that costs nothing.
 */
describe("peaksPrice — the rate card's figure", () => {
  it("★★says Free, not a dash and not a zero", () => {
    const p = peaksPrice({ free: true, minCreditsPerCall: 0 });
    expect(p.label).toBe("Free");
    expect(p.label).not.toBe("—");
    expect(p.label).not.toBe("0");
  });

  it("★★trusts `free` over the number — a free row can still carry a price", () => {
    // Real rows are in this state: customerBillable:false with a multiplier
    // left over from before. Reading the number first would charge for them.
    expect(peaksPrice({ free: true, minCreditsPerCall: 10 }).label).toBe("Free");
  });

  it("shows the figure for a priced task", () => {
    expect(peaksPrice({ free: false, minCreditsPerCall: 30 }).label).toBe("30");
  });

  it("★a priced task that happens to total zero is NOT relabelled Free", () => {
    // The inverse mistake: `minCreditsPerCall > 0` collapsed "free" and
    // "priced but currently zero", which are different promises.
    expect(peaksPrice({ free: false, minCreditsPerCall: 0 }).free).toBe(false);
  });

  it("groups thousands through the PINNED formatter, so a big number is readable", () => {
    // ⚠️AGAINST `formatPeaks`, NOT A BARE `toLocaleString()` (round 2).
    // Both sides of this comparison used to be host-locale calls, so it
    // passed on every host and could not distinguish a pinned renderer
    // from an unpinned one — which is how `peaksPrice` stayed unpinned
    // while its two siblings in the same file were fixed in round 1.
    expect(peaksPrice({ free: false, minCreditsPerCall: 1500 }).label).toBe(
      formatPeaks(1500),
    );
  });
});

describe("peaksCostSentence — the price shown BEFORE the ask", () => {
  it("★★never tells a merchant that a free action uses Peaks", () => {
    const s = peaksCostSentence({ free: true, creditMultiplier: 0 });
    expect(s).toMatch(/free/i);
    expect(s).not.toMatch(/uses about/i);
  });

  it("★a free row with a leftover multiplier still reads as free", () => {
    expect(peaksCostSentence({ free: true, creditMultiplier: 10 })).toMatch(/free/i);
  });

  it("quotes the multiplier for a priced action", () => {
    expect(peaksCostSentence({ free: false, creditMultiplier: 25 })).toContain("25");
  });

  it("★★an UNLOADED rate card is not the same as free", () => {
    // The distinction that matters: we do not know the price yet, so we say so
    // rather than quoting a number we do not have or implying it is free.
    const s = peaksCostSentence(undefined);
    expect(s).toBe("Uses Peaks.");
    expect(s).not.toMatch(/free/i);
    expect(s).not.toMatch(/\d/);
  });
});
