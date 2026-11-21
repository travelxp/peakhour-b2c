import { describe, expect, it } from "vitest";
import type { BatchQuote } from "@/lib/api/creative-studio";
import { affordableProducts, atBatchCap, batchBody, batchIds, canStartBatch, whyLines } from "@/lib/studio-batch-start";
import { MAX_BATCH_PRODUCTS } from "@/lib/studio-flow";

const quote = (over: Partial<BatchQuote> = {}): BatchQuote => ({
  main: { action: "creative.make_previews", peaks: 1000, units: 20, token: "m", expiresAt: 1 },
  cutout: { action: "creative.cut_out_product", peaks: 100, units: 5, token: "c", expiresAt: 1 },
  totalPeaks: 1100,
  products: 5,
  previewsEach: 4,
  ...over,
});

describe("who sees 'Make previews for several'", () => {
  it("needs Pro tools AND a role that can spend", () => {
    expect(canStartBatch({ proTools: true, canMake: true })).toBe(true);
    expect(canStartBatch({ proTools: false, canMake: true })).toBe(false);
    expect(canStartBatch({ proTools: true, canMake: false })).toBe(false);
  });
});

describe("the ids and the body", () => {
  it("drops repeats and stops at the batch cap", () => {
    expect(batchIds(["a", "b", "a"])).toEqual(["a", "b"]);
    const many = Array.from({ length: MAX_BATCH_PRODUCTS + 5 }, (_, i) => `p${i}`);
    expect(batchIds(many)).toHaveLength(MAX_BATCH_PRODUCTS);
    expect(atBatchCap(MAX_BATCH_PRODUCTS - 1)).toBe(false);
    expect(atBatchCap(MAX_BATCH_PRODUCTS)).toBe(true);
  });
  it("sends the products, the count and a language, nothing priced", () => {
    expect(batchBody(["a", "b"], 3)).toEqual({ productIds: ["a", "b"], language: "en", count: 3 });
  });
});

describe("Make k instead after a short balance", () => {
  it("is the most products the quote's own prices cover, fewer than chosen (200 a product, 20 a cut-out)", () => {
    // 5 products at 200 each and 5 cut-outs at 20: k products cost 220 k
    expect(affordableProducts(700, quote(), 5)).toBe(3);
    expect(affordableProducts(660, quote(), 5)).toBe(3);
    expect(affordableProducts(659, quote(), 5)).toBe(2);
  });
  it("never offers all of them (that is what was refused), and none when not even one is covered", () => {
    expect(affordableProducts(100000, quote(), 5)).toBe(4);
    expect(affordableProducts(219, quote(), 5)).toBeUndefined();
  });
  it("counts no cut-out when the quote has none", () => {
    expect(affordableProducts(400, quote({ cutout: null }), 5)).toBe(2);
  });
  it("says nothing when it cannot work the sum out", () => {
    expect(affordableProducts(undefined, quote(), 5)).toBeUndefined();
    expect(affordableProducts(500, undefined, 5)).toBeUndefined();
    expect(affordableProducts(500, quote({ products: 0 }), 5)).toBeUndefined();
  });
});

describe("what 'Why this price' lists", () => {
  it("is the previews and the photos, from the quote", () => {
    expect(whyLines(quote())).toEqual({ previews: { units: 20, products: 5, each: 4 }, photos: 5 });
    expect(whyLines(quote({ cutout: null })).photos).toBe(0);
  });
});
