/**
 * What an org actually holds, and whether telling them to upgrade is true.
 *
 * ── ⚠️🚫★★THE BUG THIS EXISTS FOR: TWO SOURCES OF TRUTH, AND THE TOP BAR READ
 *    THE OLDER ONE ────────────────────────────────────────────────────────────
 *
 * `/v1/dashboard/org` returns **both**:
 *
 *   - `subscription.plan` — the legacy BASE tier (`free`/`starter`/`growth`/…),
 *     and
 *   - `products[]` — the product-portfolio subscriptions an org has actually
 *     bought (T4 native billing).
 *
 * ★★**THE BASE PLAN CAN BE `free` WHILE THE ORG OWNS A PAID PRODUCT.** The
 * billing page's own comment says so in as many words — *"without this, the
 * page reads 'Free' and prompts a re-purchase"* — and it guards against it. 🚫The
 * top-bar `PlanBadge` did not, so an org that had bought Peakhour Suite (and
 * Peaks) was told to **upgrade, on every dashboard page, permanently**, while
 * the billing page it linked to showed the Suite as current and offered nothing
 * to buy. **A guard written in one file and dropped in the next**, which is why
 * the rule now lives in ONE place that both read.
 *
 * ★It is a pure function of the summary, so the decision is testable without a
 * DOM and the two surfaces cannot drift apart again.
 */

/** One product-portfolio subscription, as `/v1/dashboard/org` returns it. */
export interface HeldProduct {
  tier: string;
  state?: string;
  name?: string;
}

export interface PlanSummaryish {
  subscription?: { plan?: string; planName?: string };
  products?: HeldProduct[];
}

/**
 * Plans where an upgrade is meaningful ON THE BASE LADDER.
 *
 * ★`agency` and `enterprise` are at or near the top, so the CTA is noise there.
 * ⚠️★This set is NOT the whole answer and never was — the second half is
 * `baseTierMisrepresents`, which `showUpgradeCta` ANDs with it. 🚫A first version
 * of this line pointed at a predicate `showUpgradeCta` does not use, and
 * following it re-introduces the trial regression the tests guard.
 */
const UPGRADABLE_BASE = new Set(["free", "starter", "growth"]);

/**
 * ⏸⚠️★★AND THIS SET IS DELIBERATELY **NOT** WIDENED TO DOTTED FREE TIERS.
 *
 * An org on `commerce_assistant.free` matches nothing here, so it has never seen
 * this CTA — and adding one would turn a prompt ON for a whole population that
 * has never had it, which is a product decision and not what was reported. ★It
 * is recorded rather than silently left: `plan-keys.ts` warns that a table keyed
 * by bare account plans *"finds nothing"* for a held tier, and this is that
 * shape, kept on purpose. ⏸Worth deciding separately.
 *
 * ★The consequence is that the suppression below only ever applies to a BARE
 * `free`, which is the tier the reported org is on. `isFreeTier` is still the
 * right question to ask — it keeps this function and `planDisplayName` agreeing
 * about what "free" means — but it cannot currently be reached with a dotted
 * key, and saying so is better than leaving a reader to work it out.
 */

/**
 * Is this tier key one that costs nothing?
 *
 * ★THE VOCABULARY IS `peakhour-api`'s, NOT INVENTED HERE: bare `free`, and the
 * `.free` / `.lens` suffixes. Everything else — `.paid`, `.pro`, `.studio`,
 * `.commerce` — is on the paid side of the same split the Peaks buy gate uses.
 */
export function isFreeTier(key: string | undefined): boolean {
  if (typeof key !== "string" || key === "") return false;
  // ⚠️🚫★★`.lens` IS A FREE SUFFIX AND A FIRST VERSION MISSED IT.
  //  `peakhour-api`'s `credits.ts` states it twice — *"the free tiers (free,
  //  `*.lens`) cost nothing"* — and it is the rule the Peaks buy gate applies.
  //  🚫Counting a grandfathered `content_studio.lens` org as PAID would suppress
  //  their upgrade prompt permanently: the inverted form of the reported bug,
  //  introduced by the fix for it.
  return key === "free" || key.endsWith(".free") || key.endsWith(".lens");
}

/**
 * Is this a product the org HOLDS on a paid tier — trials included?
 *
 * ⚠️★A FREE TIER IS A GRANT, NOT A PURCHASE. The Shopify claim hands an org a
 * free floor product, and counting it as paid would silence the upgrade CTA for
 * exactly the orgs it is meant for. ★This is the billing page's own `paidCount`
 * rule, moved here rather than copied, so the two cannot disagree about what
 * "paid" means.
 *
 * 🚫**It says nothing about `state`** — see `isConvertedProduct` for the
 * question the CTA asks.
 */
export function isPaidProduct(product: HeldProduct | undefined): boolean {
  return !!product && typeof product.tier === "string" && !isFreeTier(product.tier);
}

/**
 * Paid AND actually being paid for.
 *
 * ── ⚠️🚫★★A TRIAL IS NOT A PURCHASE, AND THE TWO QUESTIONS WANT DIFFERENT
 *    ANSWERS ─────────────────────────────────────────────────────────────────
 *
 * The endpoint returns `active` and `trial` rows together. ★For **naming** what
 * an org holds, a trial counts — somebody trialing the Suite is not on a free
 * plan in any sense they would recognise. 🚫For **suppressing the upgrade CTA**
 * it must not: they have paid nothing, and converting a trial is exactly what
 * that control is for. **Hiding it for the length of a trial removes the prompt
 * at the only moment it is the right prompt.**
 *
 * ★A round found this: `state` was declared on the type and never read.
 */
export function isConvertedProduct(product: HeldProduct | undefined): boolean {
  return isPaidProduct(product) && product?.state === "active";
}

/**
 * Does the badge name a PRODUCT rather than the base tier?
 *
 * ★Exported so the chip can be STYLED as what it says. ⚠️🚫★A round found the
 * accent still keyed on the base tier while the label named a product — so a
 * paying org read "Peakhour Suite" in the muted FREE-tier chip. **A label and
 * its colour disagreeing is the same wrong answer in two channels.**
 *
 * 🚫★AND `holdsPaidProduct` WAS REMOVED RATHER THAN LEFT. It had no caller, and
 * its name invited exactly the substitution the tests guard against: the CTA
 * asks `isConvertedProduct` (a trial has paid nothing), not "holds anything
 * paid". **An uncalled helper that reads like the one you want is worse than
 * no helper.**
 */
export function namesAProduct(summary: PlanSummaryish | undefined): boolean {
  if (!isFreeTier(summary?.subscription?.plan)) return false;
  return (summary?.products ?? []).some(isPaidProduct);
}

/**
 * Does the base tier MISREPRESENT what this org has?
 *
 * ★★THAT IS THE ACTUAL DEFECT, AND NAMING IT IS WHAT KEEPS THE TWO FIXES IN
 * STEP. `free` beside a converted purchase is a false statement — about the
 * plan's NAME and about whether an upgrade is owed — and both surfaces need the
 * same answer.
 *
 * ⚠️🚫★AND IT IS ONLY THE `free` TIER, WHICH A FIRST VERSION GOT WRONG. It ANDed
 * "holds no paid product" onto **every** upgradable tier, so an org on `starter`
 * that bought anything permanently lost its base-ladder prompt — and
 * starter → growth is a real upgrade whatever products they own. ★The product
 * check disambiguates `free` and nothing else.
 */
function baseTierMisrepresents(summary: PlanSummaryish | undefined): boolean {
  // ⚠️🚫★★AND IT ASKS `isFreeTier`, NOT `=== "free"`. `plan-keys.ts` says it in
  //  as many words: *"`org.subscription.plan` holds a TIER key, which since
  //  migration 106 is normally the DOTTED kind"* — Shopify autoprovision writes
  //  `commerce_assistant.free` — and it records `planToPriority` making exactly
  //  this mistake and silently charging every such org the free tier's
  //  priority. 🚫A first version compared the bare string, so the orgs the
  //  report is about would still have been named "Free".
  if (!isFreeTier(summary?.subscription?.plan)) return false;
  const products = summary?.products;
  return Array.isArray(products) && products.some(isConvertedProduct);
}

/**
 * Should the dashboard tell this org to upgrade?
 *
 * ★★TWO CONDITIONS, AND THE SECOND IS THE ONE THAT WAS MISSING: the base tier
 * has to be one an upgrade means something for, **and** it must not be a `free`
 * that is lying about a converted purchase. 🚫Either alone is wrong — dropping
 * the first nags an enterprise org, and dropping the second is the reported bug.
 */
export function showUpgradeCta(summary: PlanSummaryish | undefined): boolean {
  const plan = summary?.subscription?.plan;
  if (typeof plan !== "string" || !UPGRADABLE_BASE.has(plan)) return false;
  return !baseTierMisrepresents(summary);
}

/**
 * What to CALL the org's plan.
 *
 * ── ⚠️🚫★★THE SUMMARY'S OWN TYPE SAYS *"ALWAYS PREFER `planName`"*, AND THE
 *    TOP BAR DID NOT ────────────────────────────────────────────────────────
 *
 * `plan` is a machine tier key — `commerce_assistant.free` — and the type's
 * docblock records what rendering it did last time: **customers were shown
 * *"Commerce_assistant.Free"* as their plan name.** The billing page prefers
 * `planName`; the badge capitalised the key. ★So the badge and the billing page
 * it links to could name the same plan two different things, which is the
 * second half of the same report.
 *
 * ★AND A PAID PRODUCT'S NAME BEATS A FREE BASE TIER. An org whose base plan is
 * `free` and who has bought the Suite is not on a free plan in any sense the
 * customer would recognise; naming them "Free" beside a paid invoice is the
 * same wrong answer the CTA was giving.
 */
export function planDisplayName(summary: PlanSummaryish | undefined): string | null {
  const base = summary?.subscription;

  // ── ⚠️🚫★★★THE PRODUCT CHECK COMES **FIRST**, AND A ROUND PROVED WHY ───────
  //
  // 🚫★A FIRST VERSION RETURNED `planName` BEFORE LOOKING AT THE PRODUCTS, AND
  //  THAT BRANCH IS UNREACHABLE IN PRODUCTION: the server's `resolvePlanName`
  //  ends `return name || key`, so `planName` is **always** a non-empty string.
  //  An org on a `free` base holding the Suite therefore came back **"Free"** —
  //  *the exact outcome this module was written to fix*, shipped inside the fix.
  //
  // ⚠️★★AND THE TESTS PASSED, because their fixture omitted `planName` — a
  //  field the server always sends. **A fixture that does not match what the
  //  server produces will agree with any implementation you like.**
  //
  // ★SO: a `free` base beside something the org holds is named by what they
  //  hold; every other tier is named by `planName`, which is the summary's own
  //  instruction and is right for a real tier.
  if (isFreeTier(base?.plan)) {
    // ★TRIALS COUNT HERE and not in the CTA — see `isConvertedProduct`.
    //  Somebody trialing the Suite is not on a free plan in any sense they
    //  would recognise, even though they have paid nothing yet.
    const held = (summary?.products ?? []).filter(isPaidProduct);
    // ★ONE PRODUCT NAMES ITSELF; SEVERAL ARE COUNTED RATHER THAN LISTED,
    //  because a top-bar chip has room for one phrase. 🚫Naming only the first
    //  would hide the rest behind a label that looks complete.
    //
    // ⚠️🚫★AND A `name` THAT IS REALLY THE TIER KEY IS REFUSED. The endpoint
    //  falls back to the raw key when no `cfg_plans` row resolves, so a
    //  not-yet-effective row would print **"Peakhour_suite.pro"** under this
    //  badge's `capitalize` — the same failure the docblock above cites as the
    //  reason for preferring a name at all. ★Falling through to `planName` is
    //  the honest answer: a wrong-looking name is worse than a plain one.
    const named = held.filter((p) => p.name && p.name !== p.tier);
    if (held.length === 1 && named.length === 1) return named[0]!.name!;
    // ⚠️🚫★★AND AN UNUSABLE NAME FALLS BACK TO A **COUNT**, NEVER TO `planName`.
    //  A round found the worse combination: with the CTA suppressed AND the
    //  label dropping through, a Suite-holding org read **"Free"** with no
    //  upgrade affordance left — the reported symptom, and now with nothing to
    //  click. ★"1 product" is short of ideal and it is TRUE, which the
    //  alternative is not.
    if (held.length > 0) return `${held.length} product${held.length === 1 ? "" : "s"}`;
  }

  if (base?.planName) return base.planName;

  const plan = base?.plan;
  if (typeof plan !== "string" || plan === "") return null;
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
