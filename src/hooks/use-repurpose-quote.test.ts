import { describe, expect, it } from "vitest";
import { deriveRepurposeQuote } from "./use-repurpose-quote";
import { QUOTE_CLOCK_SKEW_MS } from "./use-peaks-quote";
import type { RepurposeQuote } from "@/lib/api/repurpose";
import { channelPriceText, nothingToWrite, repurposeFooterText } from "@/lib/repurpose-price";

const NOW = 1_000_000_000_000;
const q = (over: Partial<RepurposeQuote> = {}): RepurposeQuote =>
  ({
    channels: [{ channel: "linkedin", kind: "post", pieces: 1, peaks: 75 }],
    posts: { units: 1, quote: { token: "tp", expiresAt: NOW + 10 * 60_000 } },
    articles: null,
    totalPeaks: 75,
    free: false,
    ...over,
  }) as unknown as RepurposeQuote;

describe("deriveRepurposeQuote", () => {
  it("holds the price and hands out the receipts only while it is held", () => {
    const withArticle = q({ articles: { units: 1, quote: { token: "ta", expiresAt: NOW + 10 * 60_000 } } as never });
    expect(deriveRepurposeQuote({ enabled: true, isFetching: false, data: withArticle, now: NOW })).toMatchObject({
      loading: false,
      unavailable: false,
      tokens: { posts: "tp", articles: "ta" },
    });
    expect(deriveRepurposeQuote({ enabled: true, isFetching: false, data: q(), now: NOW }).tokens).toEqual({ posts: "tp" });
  });

  it("loading is a request in flight with nothing to show, and a refetch never hides a price already on screen", () => {
    expect(deriveRepurposeQuote({ enabled: true, isFetching: true, data: undefined, now: NOW })).toMatchObject({ loading: true, unavailable: false, quote: undefined, tokens: {} });
    expect(deriveRepurposeQuote({ enabled: true, isFetching: true, data: q(), now: NOW })).toMatchObject({ loading: false, quote: expect.anything() });
  });

  it("retry asks again", () => {
    let asked = 0;
    deriveRepurposeQuote({ enabled: true, isFetching: false, data: undefined, now: NOW, refetch: () => void asked++ }).retry();
    expect(asked).toBe(1);
  });

  it("unavailable is asked, not fetching, nothing to show; a surface that has not asked is not 'unavailable'", () => {
    expect(deriveRepurposeQuote({ enabled: true, isFetching: false, data: undefined, now: NOW }).unavailable).toBe(true);
    expect(deriveRepurposeQuote({ enabled: false, isFetching: false, data: undefined, now: NOW }).unavailable).toBe(false);
  });

  it("a receipt that has lapsed (or lapses inside the clock-skew margin) is withheld, not sent: the api would refuse the press", () => {
    const lapsing = q({ posts: { units: 1, quote: { token: "tp", expiresAt: NOW + QUOTE_CLOCK_SKEW_MS } } as never });
    const s = deriveRepurposeQuote({ enabled: true, isFetching: false, data: lapsing, now: NOW });
    expect(s.quote).toBeUndefined();
    expect(s.tokens).toEqual({});
  });

  it("the EARLIEST receipt decides: a posts receipt that is fine does not carry a lapsed article receipt", () => {
    const mixed = q({
      posts: { units: 1, quote: { token: "tp", expiresAt: NOW + 10 * 60_000 } } as never,
      articles: { units: 1, quote: { token: "ta", expiresAt: NOW - 1 } } as never,
    });
    expect(deriveRepurposeQuote({ enabled: true, isFetching: false, data: mixed, now: NOW }).quote).toBeUndefined();
  });
});

describe("the sheet's price words", () => {
  it("a channel says its price in Peaks, Free when free, nothing when nothing is written", () => {
    expect(channelPriceText({ channel: "x", kind: "post", pieces: 2, peaks: 1500 }, false)).toBe("1,500 Peaks");
    expect(channelPriceText({ channel: "x", kind: "post", pieces: 2, peaks: 0 }, false)).toBe("Free");
    expect(channelPriceText({ channel: "x", kind: "post", pieces: 2, peaks: 150 }, true)).toBe("Free");
    // a channel nothing is written for says so, rather than sitting silent
    expect(channelPriceText({ channel: "peakhoursite", kind: "none", pieces: 0, peaks: 0 }, false)).toBe("Not written here");
    expect(channelPriceText(undefined, false)).toBeNull();
  });

  it("the footer always says why Generate is on or off", () => {
    const base = { quote: undefined, loading: false, unavailable: false, tokens: {}, retry: () => {} };
    expect(repurposeFooterText(base, 0)).toBe("Tick a channel to see the price.");
    expect(repurposeFooterText({ ...base, loading: true }, 2)).toBe("Working out the price…");
    expect(repurposeFooterText({ ...base, unavailable: true }, 2)).toContain("cannot show the price");
    expect(repurposeFooterText({ ...base, quote: q({ totalPeaks: 2250 }) }, 2)).toBe("Costs up to 2,250 Peaks. You pay only for what is written.");
    expect(repurposeFooterText({ ...base, quote: q({ free: true, totalPeaks: 0 }) }, 2)).toBe("Free — you are never charged for this.");
    // nothing ticked is written by a model: not "Free", and nothing to press Generate for
    const none = { ...base, quote: q({ posts: null, articles: null, totalPeaks: 0, free: false }) };
    expect(nothingToWrite(none)).toBe(true);
    expect(nothingToWrite({ ...base, quote: q() })).toBe(false);
    expect(repurposeFooterText(none, 1)).toBe("Nothing is written for the channels ticked, so there is nothing to generate.");
  });
});
