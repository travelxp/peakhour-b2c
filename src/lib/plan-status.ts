/**
 * What a business holds, and what the dashboard should say about it.
 *
 * ── ONE CATALOG, THREE STATES (billing plan D19, P4.7) ──────────────────────
 *
 * The catalog is Peakhour Suite, Agency and Enterprise. The per-product plans
 * (`commerce_assistant`, `content_studio`, `growth`, `support_inbox`,
 * `presence`, each `.free` and `.paid`) are scrapped and there is no free tier.
 * A new business starts on a Suite trial; when it ends the business holds no
 * plan (padlocked) until it buys. So a business is in exactly one of:
 *
 *   - `paid`  — it holds a bought line (`products[]`, active or on a checkout
 *               trial) or a base CONTRACT row (a CMS-set plan, Enterprise);
 *   - `trial` — its base row is the Suite trial and the trial is live;
 *   - `none`  — neither: no plan, buy to continue.
 *
 * `/v1/dashboard/org` returns both sources: `subscription` (the base row: the
 * Suite trial, or a contract) and `products[]` (bought lines). ★Both surfaces
 * that state the plan (the top-bar badge and the billing page) read this one
 * module, because a guard written in one file and dropped in the next is how
 * the badge once told a Suite buyer to upgrade on every page.
 *
 * ── THE STATE IS THE ACTIVE BUSINESS'S (independent review on b2c#591) ──────
 *
 * D19's padlock is per business: the trial covers the org's first business
 * only, and each other business is bought on its own plan. The active
 * business's own answer is `/v1/auth/me` `entitlements.coverage` (`trial` /
 * `paid` / `none`, the rule the gates and the workspace switcher's
 * `planActive` share), so it decides the state whenever it is served
 * (`BusinessPlanish`).
 *
 * ★THE LINES ARE THE BUSINESS'S OWN (P4.3b, api#1510). `/v1/dashboard/org` and
 * `/v1/billing/summary` list only the signed-in business's lines (its stamped
 * rows, plus unstamped legacy rows, which every business lists until their
 * owner is known), and every line carries its `businessId`. So a paid
 * business is named by its own lines (`businessLines`), and nothing here reads
 * a line another business holds. ★The base row (`subscription`) is still the
 * ORG's (the first business's trial, or a contract): it names the trial, and
 * a contract, but never a paid business's purchase.
 *
 * With no coverage served (an entitlements failure on `/me`), the state is
 * derived from the business's own lines and the base row (`planState`).
 */

/** One held line, as `/v1/dashboard/org` returns it. */
export interface HeldProduct {
  tier: string;
  state?: string;
  name?: string;
  productKey?: string | null;
  endsAt?: string | null;
  /** The business holding the line (api#1510), or null for an unstamped
   *  legacy row, which the api lists for every business of the org. */
  businessId?: string | null;
}

export interface PlanSummaryish {
  subscription?: {
    /** Null when the org has no live base row (api#1510). */
    plan?: string | null;
    planName?: string | null;
    trialActive?: boolean;
    trialEndsAt?: string | null;
  };
  products?: HeldProduct[];
}

export type PlanState = "paid" | "trial" | "none";

/**
 * The active business, as `plan-status` reads it: its `/v1/auth/me` coverage
 * (`entitlements.coverage`, why the business is usable) and its id (which
 * lines are its own). Both optional: `/me` omits `coverage` when entitlements
 * failed, and names no business before one is picked. Build it with
 * `activeBusiness`.
 */
export interface BusinessPlanish {
  coverage?: string | null;
  businessId?: string | null;
}

/** The active business from `useAuth()`'s `entitlements` and `business`. */
export function activeBusiness(
  entitlements: { coverage?: string | null } | null | undefined,
  business: { _id: string } | null | undefined,
): BusinessPlanish {
  return { coverage: entitlements?.coverage ?? null, businessId: business?._id ?? null };
}

/** The active business's coverage when it is one of the three states, else null. */
function coverageOf(business: BusinessPlanish | null | undefined): PlanState | null {
  const c = business?.coverage;
  return c === "trial" || c === "paid" || c === "none" ? c : null;
}

/**
 * A tier key that names no plan: absent, empty, `"none"` (the api's
 * `NO_PLAN_KEY`), or the bare `free`. The "Your plans" list and every count
 * reach this one predicate through `isHeldPlan` / `heldLines`.
 *
 * ★THE DOTTED FREE TIERS ARE NOT SPECIAL ANY MORE (P4.5). This also read
 * `<product>.free` and the grandfathered `.lens` tiers as no plan, while a
 * stored row could still carry one. Migration 394 (mongodb#917) deleted every
 * per-product plan and every row naming one, and api#1532 deletes the api's
 * own free-tier predicate with them.
 *
 * ★THE BARE `free` STAYS (review R1 on b2c#599): 394 deletes DOTTED tiers
 * only and leaves every bare-tier row alone, and 388 rewrote only the
 * `channel: "free"` base rows, so a bare `free` on another channel is not
 * proved gone everywhere (dev holds none). Read as no plan, it can never be
 * listed with Cancel or counted as paid.
 *
 * ⚠️ORDER: ship after api#1532 and after 394 has run in the environment.
 */
export function isNoPlanKey(key: string | null | undefined): boolean {
  return !key || key === "none" || key === "free";
}

/** A line that is a plan the business holds: a real tier, not one naming no plan. */
export function isHeldPlan(product: HeldProduct | undefined): boolean {
  return !!product && typeof product.tier === "string" && !isNoPlanKey(product.tier);
}

/** The bought lines worth listing: lines naming no plan left out. */
export function heldLines<T extends HeldProduct>(products: ReadonlyArray<T | undefined> | undefined): T[] {
  return (products ?? []).filter((p): p is T => isHeldPlan(p));
}

/**
 * The held lines that are the business's own (P4.3b): stamped with its id, or
 * unstamped (a legacy row the api counts for every business of the org until
 * its owner is known, `rowsForBusiness`). ★A line stamped with another
 * business is never this one's, and with no business known only the
 * unstamped lines are anybody's to claim.
 */
export function businessLines<T extends HeldProduct>(
  products: ReadonlyArray<T | undefined> | undefined,
  businessId: string | null | undefined,
): T[] {
  return heldLines(products).filter((p) => p.businessId == null || (!!businessId && p.businessId === businessId));
}

/**
 * Which of the three states the ACTIVE business is in, or null before the
 * summary has loaded (no flash of "No plan" for a paying business). ★A caller
 * renders null as its own neutral state, never as `none`: a summary that
 * failed or never fetched says nothing about the plan (`planHeadline`).
 *
 * ★The business's own coverage decides whenever `/me` serves it (module
 * docblock): the first business's trial says nothing about this one.
 *
 * Without coverage: ★a line of the business's own (`businessLines`) is paid,
 * and beats a live trial, because buying during the trial ends it for the
 * trial business (P4.3a). ★A base row is a CONTRACT when it carries no trial
 * date (P4.3: `channel` is "trial" exactly when `trialEndsAt` is set); one
 * whose trial date has passed is the record that the trial was used, not a
 * plan.
 */
export function planState(
  summary: PlanSummaryish | undefined,
  business?: BusinessPlanish | null,
): PlanState | null {
  const base = summary?.subscription;
  if (!base) return null;
  const coverage = coverageOf(business);
  if (coverage) return coverage;
  if (businessLines(summary?.products, business?.businessId).length > 0) return "paid";
  if (isNoPlanKey(base.plan)) return "none";
  if (base.trialActive === true) return "trial";
  if (!base.trialEndsAt) return "paid";
  return "none";
}

/**
 * One held LINE, as both `/dashboard/org` and `/v1/billing/summary` list it
 * (D21, review R2 on b2c#589). During a plan change on the same plan (Suite
 * monthly to Suite yearly) the business holds two lines of one tier: the one
 * ending and its replacement. The tier alone named both, so the rows shared a
 * React key and the ending line showed the replacement's price. A tier has at
 * most one live line, and an ending line carries its own `endsAt`.
 */
export function lineKey(p: { tier: string | null; endsAt?: string | null }): string {
  return `${p.tier ?? ""}|${p.endsAt ?? ""}`;
}

/**
 * A line the business is still billed for: a held plan, not ending (D21,
 * review R3 on b2c#589). During a plan change the ending line and its
 * replacement are both held, but only the replacement is paid for; the api's
 * `/summary` totals leave ending lines out the same way.
 */
export function isBilledLine(p: HeldProduct | undefined): boolean {
  return isHeldPlan(p) && !p?.endsAt;
}

/**
 * The one action a held line's row offers on the billing page. An ENDING line
 * (a cancel or a plan change scheduled it, D21) offers nothing: it already
 * ends, and the api's cancel acts on the line of that product NOT ending, so
 * "Cancel" on the ending row would cancel its replacement (review R2 on
 * b2c#589). A line naming no plan is not listed at all (`heldLines`), and
 * offers nothing if it reaches here.
 */
export function productRowAction(p: HeldProduct | undefined): "cancel" | null {
  if (!isHeldPlan(p) || p?.endsAt) return null;
  return "cancel";
}

/**
 * The top-bar call to action, or null when there is nothing to buy.
 *
 * ★A paid business is not told to upgrade (the reported bug this module was
 * first written for). On the trial the CTA is the purchase that keeps the
 * Suite; with no plan it is the only way back in, and says so.
 */
export function upgradeCta(
  summary: PlanSummaryish | undefined,
  business?: BusinessPlanish | null,
): { label: string; title: string } | null {
  const state = planState(summary, business);
  if (state === "trial") return { label: "Upgrade", title: "Buy a plan before your trial ends" };
  if (state === "none") return { label: "Buy a plan", title: "You have no plan. Buy one to keep using Peakhour" };
  return null;
}

/**
 * The trial-expiry banner's days left, or null when it should not show: only
 * on the ACTIVE business's own trial, inside the warning window. ★The summary's
 * `trialActive` is the base row's, which is the first business's: read alone
 * it warned a sibling business, paid or padlocked, that "your trial" ends
 * (independent review on b2c#591), so the state comes from `planState`, as the
 * badge's does.
 */
export function trialWarningDays(
  summary: (PlanSummaryish & { subscription?: { trialDaysRemaining?: number } }) | undefined,
  business: BusinessPlanish | null | undefined,
  windowDays: number,
): number | null {
  if (planState(summary, business) !== "trial") return null;
  const days = summary?.subscription?.trialDaysRemaining ?? 0;
  return days > windowDays ? null : days;
}

/** The billing page's plan button: a paid business changes plan (D21); the
 *  trial and no plan buy one; an unknown state only looks (the picker still
 *  opens, but the page does not claim the business has nothing to change). */
export function planButtonLabel(state: PlanState | null): string {
  if (state === null) return "See plans";
  return state === "paid" ? "Change plan" : "Buy a plan";
}

/**
 * The billing page's plan header: the chip, whether the padlock notice shows,
 * and the button (independent review on b2c#591).
 *
 * ★NULL IS ITS OWN STATE. The page's only early return is react-query's
 * `isLoading`, which is false when `/v1/dashboard/org` errored, is paused
 * offline, or is disabled until `/me` names a business; in each the summary is
 * undefined. Reading that as `none` told a business paying for Suite it had
 * no plan, in the warning colour, with the padlock notice and "Buy a plan".
 * The top-bar badge renders nothing for the same null; the page, which must
 * render something, says only that the plan did not load.
 */
export function planHeadline(
  summary: PlanSummaryish | undefined,
  business?: BusinessPlanish | null,
): { state: PlanState | null; label: string; padlocked: boolean; button: string } {
  const state = planState(summary, business);
  return {
    state,
    // ★With no business picked the summary is not fetched at all (it answers
    //  for one business, P4.3b): say what is missing, not that a load failed.
    label: planDisplayName(summary, business) ?? (business?.businessId === null ? "No business picked" : "Plan not loaded"),
    padlocked: state === "none",
    button: planButtonLabel(state),
  };
}

/**
 * What to CALL the business's plan, or null before the summary has loaded.
 *
 * ★`planName` over the machine key: the summary's own type says so, and
 * rendering the key is what once showed customers "Commerce_assistant.Free".
 *
 * ★A PAID BUSINESS IS NAMED BY ITS OWN LINES (P4.3b). Every line carries its
 * `businessId` (api#1510), so the lines named are this business's
 * (`businessLines`), never a sibling's. This replaces matching `/me`'s plan
 * key against every line in the org, which named a trial business that
 * bought Agency "Peakhour Suite" when a sibling held Suite (b2c#591 R1, R3).
 *
 * ★A bought line names itself. During a plan change (D21) the business holds
 * the ending line and its replacement of one product; the name shown is the
 * line already charging, the ending one, until its `endsAt` (the D21 rule for
 * readers that pick one line per product), so the replacement is left out.
 * Several distinct plans otherwise are counted, because a top-bar chip has room
 * for one phrase. A `name` that is really the tier key (no `cfg_plans` row
 * resolved) is refused: "1 plan" is plain and true where "Suite.pro" is
 * neither.
 *
 * ★The trial is named by the base row, and so is a paid business with no line
 * of its own when the base row is a CONTRACT (no trial date, `planState`'s
 * rule). A TRIAL base row never names a paid business (a trial is no paid
 * plan), and a base key that means no plan (`isNoPlanKey`, or null: no live
 * base row, api#1510) never names anything. With nothing left that names its
 * plan, the business is a "Paid plan": true, where a name would be a guess.
 */
export function planDisplayName(
  summary: PlanSummaryish | undefined,
  business?: BusinessPlanish | null,
): string | null {
  const state = planState(summary, business);
  if (state === null) return null;
  if (state === "none") return "No plan";

  const base = summary?.subscription;
  // The base row names a plan when its key is one, and it is either the trial
  // this business is on or a contract (no trial date, `planState`'s rule).
  const baseNames = !isNoPlanKey(base?.plan) && (state === "trial" || !base?.trialEndsAt);
  // Only a paid business is named by lines: on the trial the base row names it.
  const held = state === "paid" ? businessLines(summary?.products, business?.businessId) : [];
  if (held.length > 0) {
    const ending = held.filter((p) => p.endsAt);
    const shown = held.filter(
      (p) => p.endsAt || !ending.some((e) => e.productKey && e.productKey === p.productKey),
    );
    const tiers = new Set(shown.map((p) => p.tier));
    const named = shown.filter((p) => p.name && p.name !== p.tier);
    if (tiers.size === 1 && named.length === shown.length) return named[0]!.name!;
    return `${tiers.size} plan${tiers.size === 1 ? "" : "s"}`;
  }

  if (!baseNames) return state === "paid" ? "Paid plan" : "Trial";
  if (base?.planName && base.planName !== base.plan) return base.planName;
  const plan = base?.plan ?? "";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

/**
 * The settings page's Plan row: the plan's name, "No business picked" when
 * `/me` names no business, or an em dash before it loads.
 *
 * ★WITH NO BUSINESS PICKED THE ROW NAMES NOTHING (review R2 on b2c#592). The
 * settings page fetches `/v1/dashboard/org` itself, and with no business in
 * the session the api answers for the org's FIRST business
 * (`requireBusiness`), whose stamped lines `businessLines` cannot claim for
 * an unknown business: the row read that business's plan, or "No plan",
 * beside a billing page saying "No business picked".
 */
export function planRowLabel(
  summary: PlanSummaryish | undefined,
  business: BusinessPlanish,
): string {
  if (!business.businessId) return "No business picked";
  return planDisplayName(summary, business) ?? "—";
}
