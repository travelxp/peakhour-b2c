/**
 * What 1,000 Peaks cost in a pack, and which pack is the best value.
 *
 * Shown on every Peaks pack, like the "per 100 g" line on a biscuit packet, so
 * a buyer can compare packs without doing the division. Per 1,000 rather than
 * per Peak (owner, 2026-11-12): one Peak is a tenth of a cent, which rounds to
 * "$0.00" at two decimals and hides the gap between packs.
 *
 * ★"BEST VALUE" IS DERIVED FROM THESE NUMBERS, NOT STORED. The badge used to
 * come from `cfg_addons.display.highlight`, which sat on Peaks Value ($0.90 per
 * 1,000) while Peaks Pro was cheaper ($0.80): printing the unit price beside a
 * stored badge would have contradicted it on the same card. Deriving it means
 * the badge and the line under it cannot disagree.
 *
 * ★ONE ROUNDING. `pricePerThousand` rounds to the cent once; the badge compares
 * that number and every surface formats that same number. Comparing one
 * rounding and printing another is how two cards could show the same price
 * with a badge on only one of them.
 */

/** The fields both pack shapes (public /peaks and in-app billing) share. */
export interface PackForUnitPrice {
  key: string;
  /** Decimal string as the api sends it, e.g. "18.00". */
  amount: string;
  credits: number;
  currency: string;
}

/** Price of 1,000 Peaks in this pack, rounded to the cent, or null when the
 *  pack can't say. */
export function pricePerThousand(pack: Pick<PackForUnitPrice, "amount" | "credits">): number | null {
  const amount = Number(pack.amount);
  // `Number("")` and `Number(" ")` are 0 and finite, so `<= 0` is also what
  // stops an empty amount from printing as a unit price of zero.
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!Number.isFinite(pack.credits) || pack.credits <= 0) return null;
  return Math.round((amount * 1000 * 100) / pack.credits) / 100;
}

/**
 * The key of the pack with the lowest price per 1,000 Peaks, or null.
 *
 * Pass only the packs the buyer can act on: a badge on a pack they cannot buy
 * points them at a greyed-out button.
 *
 * Null when fewer than two packs can be compared, when they are not all in one
 * currency (a cheaper number in another currency is not cheaper), or when the
 * lowest price is shared: "best" with a tie would be a coin toss on the badge.
 */
export function bestValueKey(packs: readonly PackForUnitPrice[]): string | null {
  const priced = packs
    .map((p) => ({ key: p.key, currency: p.currency, unit: pricePerThousand(p) }))
    .filter((p): p is { key: string; currency: string; unit: number } => p.unit !== null);
  if (priced.length < 2) return null;
  if (new Set(priced.map((p) => p.currency)).size !== 1) return null;
  // Whole cents, so float noise in two equal prices cannot break a tie.
  const cents = (n: number) => Math.round(n * 100);
  const lowest = Math.min(...priced.map((p) => cents(p.unit)));
  const winners = priced.filter((p) => cents(p.unit) === lowest);
  return winners.length === 1 ? winners[0].key : null;
}

/** The suffix every surface prints after the formatted unit price. */
export const PER_THOUSAND_SUFFIX = "per 1,000 Peaks";

/**
 * "$0.90 per 1,000 Peaks", or null. `formatMoney` is the surface's own price
 * formatter, so the unit line reads like the pack price on the same card.
 */
export function perThousandLabel(
  pack: Pick<PackForUnitPrice, "amount" | "credits">,
  formatMoney: (n: number) => string,
): string | null {
  const unit = pricePerThousand(pack);
  return unit === null ? null : `${formatMoney(unit)} ${PER_THOUSAND_SUFFIX}`;
}
