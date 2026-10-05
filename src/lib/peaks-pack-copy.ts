import type { PackBlockedReason, PeaksPack } from "@/hooks/use-peaks-packs";

/**
 * What the Peaks page says when a pack can't be bought. Moved out of the page
 * (no DOM in this repo's tests) so the sentences are tested, not copied.
 */

/** Why a pack can't be bought, in the buyer's words. EVERY reason the api can
 *  return is named — an unexplained row of greyed-out Buy buttons under a sales
 *  pitch is worse than not showing the section at all. */
export function blockedCopy(reason: PackBlockedReason | null): string | null {
  switch (reason) {
    case "shopify_billed":
      // D18 / App Store rule 1.2.1: not a dead end, a pointer to where it IS
      // sold. Never a link to buy here.
      return "Your account has a Shopify store, so Peaks are bought in the Peakhour app in your Shopify admin. Your balance, usage and purchases still show here.";
    case "unlimited":
      return "Your plan already includes unlimited Peaks.";
    case "plan_required":
      return "Peaks packs need an active paid plan.";
    case "not_priced_here":
      // Real, not hypothetical: a pack priced only in USD viewed by an Indian
      // org resolves a currency the gateway for that country can't charge.
      return "These packs aren't priced for your region yet.";
    case "no_wallet":
      return "We couldn't load your Peaks wallet. Please contact support.";
    case null:
      return null;
    default: {
      // A fifth reason added on the api side is a BUILD failure here, not a
      // silent regression to the original defect (a greyed button with no
      // explanation). The union is hand-mirrored from the api, so nothing else
      // enforces that they stay in step.
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

/** The card-level reason, only when NOTHING is buyable. A real reduction, not
 *  `packs[0]` — `planRequired` and the pricing row are both per-pack, so a
 *  catalogue mixing two reasons would otherwise show copy for neither. */
export function cardBlockedCopy(packs: PeaksPack[]): string | null {
  if (packs.length === 0 || packs.some((p) => p.purchasable)) return null;
  const reasons = new Set(packs.map((p) => p.blockedReason));
  if (reasons.size === 1) return blockedCopy(packs[0].blockedReason);
  return "None of these packs is available on your account right now.";
}

/**
 * ★SHOPIFY BEFORE COUNTRY (review R1). A Shopify-connected org buys Peaks in
 * its Shopify admin whatever its country (the api refuses it before the
 * country check), so "coming soon in your country" over its packs would hide
 * the one thing it can do. Every other reason still yields to the country.
 */
export function packReason(countryBlocked: string | null, reason: PackBlockedReason | null): string | null {
  if (reason === "shopify_billed") return blockedCopy(reason);
  return countryBlocked ?? blockedCopy(reason);
}

/** The card-level reason, with the same precedence as `packReason`. */
export function cardReason(countryBlocked: string | null, packs: PeaksPack[]): string | null {
  if (packs.some((p) => p.blockedReason === "shopify_billed")) return blockedCopy("shopify_billed");
  return countryBlocked ?? cardBlockedCopy(packs);
}
