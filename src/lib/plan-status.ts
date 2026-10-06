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
 * only, and each other business is bought on its own plan. `/v1/dashboard/org`
 * is ORG-wide (every business's lines, the one base row), so on its own it
 * badged a padlocked business "Peakhour Suite" because a sibling bought Suite,
 * and a business with no plan "on trial" because the first one was. The
 * active business's own answer is `/v1/auth/me` `entitlements.coverage`
 * (`trial` / `paid` / `none`, the rule the gates and the workspace switcher's
 * `planActive` share), so it decides the state whenever it is served
 * (`BusinessPlanish`). The org-wide derivation stays only as the fallback for
 * a `/me` that carries no such coverage (no business picked, an entitlements
 * failure, or an api older than P4.3a, whose `free` is not one of the three).
 *
 * ── STORED LEFTOVERS UNTIL P4.5 ──────────────────────────────────────────────
 *
 * Until the per-product rows are deleted (P4.5) and the api stops falling back
 * to `"free"` (P4.3b), a summary may still carry `plan: "free"`, a held
 * `commerce_assistant.free` base row or line, or `"none"`. None of them is a
 * plan anybody holds, so each reads as NO plan: never named, never styled as a
 * product, never a reason to crash (`isNoPlanKey`).
 */

/** One held line, as `/v1/dashboard/org` returns it. */
export interface HeldProduct {
  tier: string;
  state?: string;
  name?: string;
  productKey?: string | null;
  endsAt?: string | null;
}

export interface PlanSummaryish {
  subscription?: {
    plan?: string;
    planName?: string;
    trialActive?: boolean;
    trialEndsAt?: string | null;
  };
  products?: HeldProduct[];
}

export type PlanState = "paid" | "trial" | "none";

/**
 * The active business's own plan, as `/v1/auth/me` serves it on `entitlements`
 * (`useAuth().entitlements`): `coverage` is why the business is usable, and
 * `plan` the tier its grant comes from. Both optional: `/me` omits `coverage`
 * on an org-level read, and an api older than P4.3a serves `free`.
 */
export interface BusinessPlanish {
  coverage?: string | null;
  plan?: string | null;
}

/** The active business's coverage when it is one of the three states, else null. */
function coverageOf(business: BusinessPlanish | null | undefined): PlanState | null {
  const c = business?.coverage;
  return c === "trial" || c === "paid" || c === "none" ? c : null;
}

/**
 * A tier key that names no plan: absent, `"none"`, or a free-tier key a stored
 * row may still carry until P4.5 (`free`, `<product>.free`). ★Not a free tier
 * the catalog sells (D19: there is none); the reading of a leftover, so the UI
 * renders it neutrally instead of naming it.
 */
export function isNoPlanKey(key: string | null | undefined): boolean {
  if (typeof key !== "string" || key === "") return true;
  return key === "none" || key === "free" || key.endsWith(".free");
}

/** A line that is a plan the business holds: a real tier, not a leftover. */
export function isHeldPlan(product: HeldProduct | undefined): boolean {
  return !!product && typeof product.tier === "string" && !isNoPlanKey(product.tier);
}

/** The bought lines worth listing: leftover `.free` rows left out. */
export function heldLines<T extends HeldProduct>(products: ReadonlyArray<T | undefined> | undefined): T[] {
  return (products ?? []).filter((p): p is T => isHeldPlan(p));
}

/**
 * Which of the three states the ACTIVE business is in, or null before the
 * summary has loaded (no flash of "No plan" for a paying business). ★A caller
 * renders null as its own neutral state, never as `none`: a summary that
 * failed or never fetched says nothing about the plan (`planHeadline`).
 *
 * ★The business's own coverage decides whenever `/me` serves it (module
 * docblock): a sibling's purchase or the first business's trial says nothing
 * about this one.
 *
 * The org-wide FALLBACK: ★a bought line beats a live trial, because buying
 * during the trial ends it for the trial business (P4.3a); not so when a
 * different business bought, which is why coverage comes first. ★A base row
 * is a CONTRACT when it carries no trial date (P4.3: `channel` is "trial"
 * exactly when `trialEndsAt` is set); one whose trial date has passed is the
 * record that the trial was used, not a plan.
 */
export function planState(
  summary: PlanSummaryish | undefined,
  business?: BusinessPlanish | null,
): PlanState | null {
  const base = summary?.subscription;
  if (!base) return null;
  const coverage = coverageOf(business);
  if (coverage) return coverage;
  if (heldLines(summary?.products).length > 0) return "paid";
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
 * b2c#589). A leftover `.free` row is not listed at all (`heldLines`), and
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
 * offline, or is disabled until `/me` names an org; in each the summary is
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
    label: planDisplayName(summary, business) ?? "Plan not loaded",
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
 * ★A bought line names itself. During a plan change (D21) the business holds
 * the ending line and its replacement of one product; the name shown is the
 * line already charging, the ending one, until its `endsAt` (the D21 rule for
 * readers that pick one line per product), so the replacement is left out.
 * Several distinct plans otherwise are counted, because a top-bar chip has room
 * for one phrase. A `name` that is really the tier key (no `cfg_plans` row
 * resolved) is refused: "1 plan" is plain and true where "Suite.pro" is
 * neither.
 *
 * ★ONLY THE ACTIVE BUSINESS'S LINES (independent review on b2c#591). The
 * summary lists every business's lines, so with `/me` coverage served: the
 * trial is named by the base row (a sibling's Suite is not this business's
 * plan), and a paid business by the lines of its own grant's tier
 * (`business.plan`), or by the base row when none matches (a contract).
 */
export function planDisplayName(
  summary: PlanSummaryish | undefined,
  business?: BusinessPlanish | null,
): string | null {
  const state = planState(summary, business);
  if (state === null) return null;
  if (state === "none") return "No plan";

  const coverage = coverageOf(business);
  const all = heldLines(summary?.products);
  // A paid business's own lines: its grant's tier, plus the other half of a
  // plan change on the same product (D21), so the rule below still names the
  // line already charging whichever half the grant reads.
  const own = all.filter((p) => p.tier === business?.plan);
  const held =
    coverage === null
      ? all
      : coverage === "paid"
        ? all.filter((p) => own.includes(p) || (!!p.productKey && own.some((o) => o.productKey === p.productKey)))
        : [];
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

  const base = summary?.subscription;
  if (base?.planName && base.planName !== base.plan) return base.planName;
  const plan = base?.plan ?? "";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
