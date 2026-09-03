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
 * ⚠️★This set is NOT the whole answer and never was — see `holdsPaidProduct`.
 */
const UPGRADABLE_BASE = new Set(["free", "starter", "growth"]);

/**
 * Is this a product the org PAID for?
 *
 * ⚠️★A `.free` TIER IS A GRANT, NOT A PURCHASE — the Shopify claim hands an org
 * a free floor product, and counting it as paid would silence the upgrade CTA
 * for exactly the orgs it is meant for. ★This is the billing page's own
 * `paidCount` rule, moved here rather than copied, so the two cannot disagree
 * about what "paid" means.
 */
export function isPaidProduct(product: HeldProduct | undefined): boolean {
  return !!product && typeof product.tier === "string" && !product.tier.endsWith(".free");
}

/**
 * Does the org hold at least one paid product?
 *
 * ★THE ENDPOINT ALREADY FILTERS TO `active`/`trial`, and this does not re-filter:
 * a second copy of that rule is the thing this module exists to prevent. 🚫What
 * it does guard is the SHAPE — a malformed entry must not throw in a top-bar
 * component that renders on every dashboard page.
 */
export function holdsPaidProduct(summary: PlanSummaryish | undefined): boolean {
  const products = summary?.products;
  return Array.isArray(products) && products.some(isPaidProduct);
}

/**
 * Should the dashboard tell this org to upgrade?
 *
 * ★★TWO CONDITIONS, AND THE SECOND IS THE ONE THAT WAS MISSING: the base tier
 * has to be one an upgrade means something for, **and** the org must not
 * already have bought something. 🚫Either alone is wrong — dropping the first
 * would nag an enterprise org, and dropping the second is the reported bug.
 */
export function showUpgradeCta(summary: PlanSummaryish | undefined): boolean {
  const plan = summary?.subscription?.plan;
  if (typeof plan !== "string" || !UPGRADABLE_BASE.has(plan)) return false;
  return !holdsPaidProduct(summary);
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
  const paid = (summary?.products ?? []).filter(isPaidProduct);
  const base = summary?.subscription;
  if (base?.planName) return base.planName;

  // ★ONE PAID PRODUCT NAMES ITSELF; SEVERAL ARE COUNTED RATHER THAN LISTED,
  //  because a top-bar chip has room for one phrase and *"Suite + 2 more"* is
  //  a promise the billing page keeps. 🚫Naming only the first would hide the
  //  rest behind a label that looks complete.
  if (paid.length === 1 && paid[0]?.name) return paid[0].name;
  if (paid.length > 1) return `${paid.length} products`;

  const plan = base?.plan;
  if (typeof plan !== "string" || plan === "") return null;
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
