import type { PackBlockedReason, PeaksPack } from "@/hooks/use-peaks-packs";

/**
 * What the Peaks page says when a pack can't be bought. Moved out of the page
 * (no DOM in this repo's tests) so the sentences are tested, not copied.
 *
 * Every org buys Peaks on this page, Shopify-connected or not (billing plan
 * D18 revised 2026-10-06: Peaks are global by design, and where the plan was
 * bought does not change where Peaks are bought; P4.10a drops the api's
 * refusal, P4.10b this page's "buy in your Shopify admin" branch). Nothing
 * here may send a buyer elsewhere to buy.
 */

/** Said for a reason this page does not know — today the api's retired D18
 *  marker `shopify_billed`, which an api that has not yet shipped P4.10a still
 *  sends, and tomorrow whatever the api adds before this union catches up. */
const UNKNOWN_REASON_COPY = "This pack isn't available on your account right now.";

/** Why a pack can't be bought, in the buyer's words. EVERY reason the api can
 *  return is named — an unexplained row of greyed-out Buy buttons under a sales
 *  pitch is worse than not showing the section at all. */
export function blockedCopy(reason: PackBlockedReason | null): string | null {
  switch (reason) {
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
      // ...but the build cannot see the wire. Returning `_exhaustive` printed
      // the raw code under the button, and between the api and b2c deploys of
      // D18 revised that code is `shopify_billed`: a sentence, never a code.
      void _exhaustive;
      return UNKNOWN_REASON_COPY;
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
 * The country notice wins over every pack reason. "Shopify before country"
 * (b2c#587 review R1) existed only because a Shopify-connected org bought
 * elsewhere whatever its country; with D18 revised it buys here like everyone
 * else, so the country gate, which the api enforces on the POST, is again the
 * first thing to say.
 */
export function packReason(countryBlocked: string | null, reason: PackBlockedReason | null): string | null {
  return countryBlocked ?? blockedCopy(reason);
}

/** The card-level reason, with the same precedence as `packReason`. */
export function cardReason(countryBlocked: string | null, packs: PeaksPack[]): string | null {
  return countryBlocked ?? cardBlockedCopy(packs);
}

/**
 * Refusals from POST /v1/billing/packs/checkout whose `message` is written for
 * the buyer and is the most useful thing we can show. Everything NOT on this
 * list — transport failures, auth expiry, parse errors, config errors — goes
 * through the shared handler, which never renders a raw message.
 *
 * An allowlist rather than a denylist on purpose: a new api error code should
 * default to the safe generic copy, not to whatever string it happens to carry.
 *
 * No `SHOPIFY_BILLED`: its message told the buyer to buy in the Shopify admin,
 * the one place D18 revised says Peaks are never bought. An api that has not
 * yet shipped P4.10a can still send it (from a listing cached 5 minutes), and
 * then the generic copy is right, not the old pointer. Moved here from the page
 * so that absence is tested.
 */
const BUYER_FACING_CODES = new Set([
  "ORG_NOT_BILLABLE",
  "COUNTRY_UNAVAILABLE",
  "COUNTRY_COMING_SOON",
  "PACK_UNAVAILABLE",
  "PACK_CURRENCY_UNAVAILABLE",
  "PACK_TAX_CONFIG_INVALID",
  "PACK_NOT_PURCHASABLE",
  "WALLET_UNLIMITED",
  "PLAN_REQUIRED",
  "GATEWAY_UNAVAILABLE",
  "BILLING_UNAVAILABLE",
]);

/** Whether a pack-checkout refusal's own `message` is shown to the buyer. */
export function packRefusalShownAsIs(code: string): boolean {
  return BUYER_FACING_CODES.has(code);
}
