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
/**
 * ★★A ROW AS `getRateCard` ACTUALLY SENDS IT — the wire shape, not our type.
 *
 * The api still emits `minCreditsPerCall`, and on every priced row it is `0`:
 * measured on the dev catalog 2026-09-23, all 70 priced merchant-facing
 * useCases omit the field and `getRateCard` answers `?? 0`. The old fixtures
 * passed `minCreditsPerCall: 30` — a row that does not exist — so the suite
 * agreed with a card that printed **"0" as the price of every paid act**.
 * Typed as the WIRE shape so the extra field survives excess-property checks,
 * which is the point: a renderer handed the real row must still say 30.
 */
const WIRE_PRICED_ROW: { free: boolean; creditMultiplier: number; minCreditsPerCall: number } = {
  free: false,
  creditMultiplier: 30,
  minCreditsPerCall: 0,
};

describe("peaksPrice — the rate card's figure", () => {
  it("★★says Free, not a dash and not a zero", () => {
    const p = peaksPrice({ free: true, creditMultiplier: 0 });
    expect(p.label).toBe("Free");
    expect(p.label).not.toBe("—");
    expect(p.label).not.toBe("0");
  });

  it("★★trusts `free` over the number — a free row can still carry a price", () => {
    // Real rows are in this state: customerBillable:false with a multiplier
    // left over from before. Reading the number first would charge for them.
    expect(peaksPrice({ free: true, creditMultiplier: 10 }).label).toBe("Free");
  });

  it("★★prices a paid row at its MULTIPLIER — what the rollup charges — not at 0", () => {
    // ⚠️⚠️THE CASE THE OLD FIXTURES COULD NOT SEE. Handed the row exactly as
    // the api sends it, the old renderer read `minCreditsPerCall` and said 0.
    expect(peaksPrice(WIRE_PRICED_ROW).label).toBe("30");
    expect(peaksPrice(WIRE_PRICED_ROW).label).not.toBe("0");
    expect(peaksPrice(WIRE_PRICED_ROW).free).toBe(false);
  });

  it("★a priced task that happens to total zero is NOT relabelled Free", () => {
    // The inverse mistake: a number-derived `free` collapses "free" and
    // "priced but currently zero", which are different promises. The api's
    // `free` already covers a zero multiplier; this renderer must not re-derive it.
    expect(peaksPrice({ free: false, creditMultiplier: 0 }).free).toBe(false);
  });

  it("groups thousands through the PINNED formatter, so a big number is readable", () => {
    // ⚠️AGAINST `formatPeaks`, NOT A BARE `toLocaleString()` (round 2).
    // Both sides of this comparison used to be host-locale calls, so it
    // passed on every host and could not distinguish a pinned renderer
    // from an unpinned one — which is how `peaksPrice` stayed unpinned
    // while its two siblings in the same file were fixed in round 1.
    expect(peaksPrice({ free: false, creditMultiplier: 1500 }).label).toBe(
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
