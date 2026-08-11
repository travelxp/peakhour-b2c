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
 * ★IT DOES NOT NAME AT-RISK STOCK, AND AN EARLIER VERSION DID — with a comment
 * arguing that an empty plan meant zero slow items came back, so the 200 slots
 * must have been consumed by at-risk products. That argument is false. The api
 * computes this reason BEFORE the proposal loop, and a plan also ends up empty
 * when slow items WERE examined and every one was filtered out for being out of
 * stock, unpriced, or clamped to nothing (`pricer.ts`). Worse, `scoreInventory`
 * sorts out-of-stock items first inside the slow bucket, so those are the slow
 * items most likely to survive the cap — a store with 150 at-risk and 300 slow
 * whose surviving 50 are all zero-stock would have been told its slow stock was
 * never looked at, and given advice that cannot build a plan.
 *
 * What the flag does establish is that some slow products were not examined.
 * That is what this says.
 */
const CANDIDATES_TRUNCATED =
  "Peakhour checks the most urgent products first and ran out of room, so some of your slow-moving stock wasn't examined — this isn't a clean bill of health.";

/**
 * ★AN `emptyReason` THIS BUILD DOES NOT KNOW. The api's own switch omits a
 * `default` so a new reason is a compile error there; this mirror cannot have
 * that, because the api can ship a sixth reason to an SPA that has not
 * redeployed. Falling back to the flag-based derivation would then answer with
 * the reassuring sentence for a cause it has never heard of — reinstating
 * exactly the false all-clear this whole change removes. Saying less is the
 * only safe answer.
 */
const UNKNOWN_REASON =
  "No markdowns to show right now. If you were expecting some, contact support — Peakhour reported a reason this page doesn't recognise yet.";

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
  // ★"THE API IS OLD" AND "THE API SAID SOMETHING NEW" ARE OPPOSITE SITUATIONS,
  // and one `default` arm was treating them as the same. An absent field means
  // an api that predates it, where the legacy flags genuinely can explain three
  // of the five causes and CLEAR is a correct answer. An unrecognised VALUE
  // means the api knows something this build does not — and answering that with
  // the reassuring sentence is the bug this file exists to remove.
  if (plan.emptyReason === undefined) return legacyEmptyCopy(plan);

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
    // construction — which makes it a bug, and the worst possible response to a
    // bug is the most comforting sentence available.
    case "none":
    default:
      return UNKNOWN_REASON;
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
