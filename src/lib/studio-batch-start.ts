import type { BatchBody, BatchQuote } from "@/lib/api/creative-studio";
import { MAX_BATCH_PRODUCTS } from "@/lib/studio-flow";

/** Pure helpers for starting a batch (UX spec S4 batch mode, S16). No React, no fetching: tested directly. */

/** Previews made for each product when the merchant does not say (the plan screen's own default). */
export const DEFAULT_BATCH_COUNT: 3 | 4 = 4;
export const BATCH_COUNTS: Array<3 | 4> = [3, 4];

/** "Make previews for several" is a Pro tools piece for people who may spend Peaks; a novice and a viewer never see it. */
export const canStartBatch = (a: { proTools: boolean; canMake: boolean }): boolean => a.proTools && a.canMake;

/** The ids to send: no repeats, at most the cap (the api refuses more, and refuses a repeat as one product anyway). */
export function batchIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].slice(0, MAX_BATCH_PRODUCTS);
}

export function batchBody(ids: readonly string[], count: 3 | 4, language = "en"): BatchBody {
  return { productIds: batchIds(ids), language, count };
}

/** One more tick is refused at the cap (the picker says so inline). */
export const atBatchCap = (n: number): boolean => n >= MAX_BATCH_PRODUCTS;

/**
 * After CREDITS_EXHAUSTED on a batch: how many of the chosen products the balance still covers, fewer than chosen ("Make {k} instead", U11).
 * A product costs `count` previews at the quote's own per-preview price, plus its cut-out when its photo needs one. The cut-outs are priced at the
 * most the quote could ask (one per product, up to the number it holds), so the offer is never more than the balance covers. Undefined when it
 * covers none, or the sums cannot be worked out.
 */
export function affordableProducts(left: number | undefined, quote: BatchQuote | undefined, chosen: number): number | undefined {
  if (left === undefined || !quote || quote.products < 1 || !(quote.main.peaks > 0)) return undefined;
  const perProduct = quote.main.peaks / quote.products;
  const cut = quote.cutout && quote.cutout.units && quote.cutout.units > 0 ? quote.cutout.peaks / quote.cutout.units : 0;
  const maxCuts = quote.cutout?.units ?? 0;
  let best: number | undefined;
  for (let k = 1; k < chosen; k++) {
    const need = perProduct * k + cut * Math.min(k, maxCuts);
    if (need <= left) best = k;
    else break;
  }
  return best;
}

/** What the "Why this price" help lists, from the quote alone (never a figure of ours). */
export function whyLines(q: BatchQuote): { previews: { units: number; products: number; each: number }; photos: number } {
  return { previews: { units: q.main.units ?? q.products * q.previewsEach, products: q.products, each: q.previewsEach }, photos: q.cutout?.units ?? 0 };
}
