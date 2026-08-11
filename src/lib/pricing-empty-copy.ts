import type { PricingPlan } from "@/hooks/use-commerce-pricer";

/**
 * What to say when the markdown plan is empty, and what to say above a plan
 * that is not empty but is not the whole shelf either.
 *
 * ★AN EMPTY PLAN HAS FIVE CAUSES AND ONLY ONE OF THEM IS GOOD NEWS. The Pricing
 * panel used to render the reassuring one — "nothing is sitting with tied-up
 * capital" — for all of them, keyed off `scanned` alone.
 *
 * ★THE ORDERING IS THE API'S, NOT OURS. `emptyReason` is decided in
 * `services/commerce/pricer.ts` from the flags it has just computed, precisely
 * so four surfaces stop each re-deriving it and each being one missed branch
 * from a false all-clear. This module chooses words, not causes — with one
 * deliberate exception, `legacyEmptyReason`, which exists only for an api that
 * predates the field.
 *
 * ★EXTRACTED SO IT CAN BE TESTED. It was a seven-branch pure function living
 * inside a React component, while the api shipped nine tests for the same
 * decision. The repo already co-locates `src/lib/*-rules.ts` tests for exactly
 * this shape.
 */

const CLEAR =
  "No slow stock to mark down right now — nothing is sitting with tied-up capital.";
const NOT_SCANNED =
  "No products have synced yet. Your markdown plan appears once your catalog and recent orders sync.";
const MARKDOWNS_OFF =
  // ★DOES NOT PROMISE CANDIDATES EXIST — the plan carries no slow count, so
  // "raise it to see your candidates" would assert something unknowable.
  "Markdowns are switched off — your clearance ceiling is 0%, so nothing is being proposed. Raise it to see whether anything qualifies.";
const SCAN_TRUNCATED =
  "Nothing to mark down among the products Peakhour could scan — but your catalog is larger than one pass covers, so this isn't the whole shelf.";
/**
 * ★NAMING AT-RISK STOCK IS SOUND HERE, AND ONLY HERE. The api's flag is
 * `slow.length < counts.slow`, which on its own does not say what crowded the
 * slow items out. But this branch is reached only when the plan is EMPTY —
 * meaning ZERO slow items came back while some were counted — and
 * `scoreInventory` sorts at-risk first, slow second. Zero slow returned
 * therefore means the 200 slots were consumed by at-risk products before the
 * sort ever reached slow. Clearing them really is the action that lets a plan
 * build. The NON-EMPTY caveat below cannot make that claim and does not.
 */
const CANDIDATES_TRUNCATED =
  "Peakhour checked the products needing the most urgent attention first and ran out of room before reaching your slow-moving stock — so this isn't a clean bill of health. Clearing your at-risk products will let a plan build.";

/**
 * The ordering, re-derived — for an api that predates `emptyReason` ONLY.
 *
 * ★THIS IS THE LIVE PATH TODAY, which is why it is not a token fallback. The
 * production api trails master, so until it catches up every merchant sees
 * this branch — and the first version of it kept the old two-state behaviour,
 * keyed off `scanned` alone. That meant a partial-scan store still heard
 * "nothing is sitting with tied-up capital", and a store with a 0% ceiling
 * heard it directly beneath a "Discount ceiling 0%" badge.
 *
 * `truncated` and `guardrails.maxDiscountPct` are both sent by the OLD api, so
 * three of the five causes are recoverable without it. `candidates_truncated`
 * is not — that flag is new — and its absence is the honest limit of this path.
 */
function legacyEmptyCopy(plan: PricingPlan): string {
  if (!plan.scanned) return NOT_SCANNED;
  if (plan.guardrails.maxDiscountPct != null && plan.guardrails.maxDiscountPct <= 0) {
    return MARKDOWNS_OFF;
  }
  if (plan.truncated) return SCAN_TRUNCATED;
  return CLEAR;
}

export function emptyPlanCopy(plan: PricingPlan): string {
  switch (plan.emptyReason) {
    case "not_scanned":
      return NOT_SCANNED;
    case "markdowns_off":
      return MARKDOWNS_OFF;
    case "candidates_truncated":
      return CANDIDATES_TRUNCATED;
    case "scan_truncated":
      return SCAN_TRUNCATED;
    case "clear":
      return CLEAR;
    // ★`none` MEANS THE PLAN IS NOT EMPTY, so reaching it here is impossible by
    // construction — and mapping an impossible state onto the single most
    // reassuring sentence is the worst available default. It falls through to
    // the legacy derivation, which reasons from the flags rather than assuming.
    case "none":
    default:
      return legacyEmptyCopy(plan);
  }
}

/**
 * The caveat above a plan that HAS proposals but is not the whole shelf — the
 * quieter failure, because such a plan looks complete.
 *
 * ★IT DOES NOT BLAME AT-RISK STOCK, unlike the empty case. With proposals
 * present, slow items DID make the candidate set, so the cap was reached partway
 * through them — which happens on a catalog of 300 slow products and no at-risk
 * ones at all. "Clear your at-risk stock" would be advice about products that
 * may not exist.
 */
export function partialPlanCopy(plan: PricingPlan): string | null {
  if (plan.truncatedCandidates) {
    return "Peakhour checks the most urgent products first and ran out of room, so there may be slow-moving stock this plan hasn't reached.";
  }
  if (plan.truncated) {
    return "Your catalog is larger than one pass covers, so this plan is built from the products that were scanned.";
  }
  return null;
}
