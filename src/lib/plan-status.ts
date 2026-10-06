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
 * Which of the three states the business is in, or null before the summary has
 * loaded (no flash of "No plan" for a paying business).
 *
 * ★A bought line beats a live trial: buying during the trial ends it (P4.3),
 * and for the moment both are listed the business has paid. ★A base row is a
 * CONTRACT when it carries no trial date (P4.3: `channel` is "trial" exactly
 * when `trialEndsAt` is set); one whose trial date has passed is the record
 * that the trial was used, not a plan.
 */
export function planState(summary: PlanSummaryish | undefined): PlanState | null {
  const base = summary?.subscription;
  if (!base) return null;
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
export function upgradeCta(summary: PlanSummaryish | undefined): { label: string; title: string } | null {
  const state = planState(summary);
  if (state === "trial") return { label: "Upgrade", title: "Buy a plan before your trial ends" };
  if (state === "none") return { label: "Buy a plan", title: "You have no plan. Buy one to keep using Peakhour" };
  return null;
}

/** The billing page's plan button: a paid business changes plan (D21); the
 *  others buy one. */
export function planButtonLabel(state: PlanState | null): string {
  return state === "paid" ? "Change plan" : "Buy a plan";
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
 */
export function planDisplayName(summary: PlanSummaryish | undefined): string | null {
  const state = planState(summary);
  if (state === null) return null;
  if (state === "none") return "No plan";

  const held = heldLines(summary?.products);
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
