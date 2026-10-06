/**
 * Billing terms on the web (billing plan P3.1a, api#1493 / api#1495).
 *
 * The catalog sells Peakhour Suite monthly and yearly, Agency quarterly and
 * yearly (RBI's ₹15,000 cap on OTP-free recurring debits, D5), and Enterprise
 * through sales. The api prices every term a plan sells (`GET /v1/billing/plans`
 * → `termPrices`), takes the term at checkout (`{ tier, term }`), and stamps an
 * INTERVAL on every held line (`month` / `quarter` / `year`). These helpers are
 * the page's one reading of both, so no surface hard-codes "/mo" again: a
 * quarterly Agency line read "₹74,997/mo" on the billing page before this.
 */

export type BillingTerm = "monthly" | "quarterly" | "yearly";
export type BillingInterval = "month" | "quarter" | "year";

export const TERMS: readonly BillingTerm[] = ["monthly", "quarterly", "yearly"];
export const TERM_LABEL: Record<BillingTerm, string> = { monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };

const INTERVAL_OF: Record<BillingTerm, BillingInterval> = { monthly: "month", quarterly: "quarter", yearly: "year" };
const SUFFIX: Record<BillingInterval, string> = { month: "/mo", quarter: "/quarter", year: "/yr" };

/** One sellable term of a plan, as checkout will charge it. */
export interface TermPrice {
  term: BillingTerm;
  amount: number;
  /** The list price when a campaign discounts `amount`. */
  listAmount?: number;
  discountPct?: number;
}

/** A held line's interval as a price suffix. An absent or unknown interval is
 *  a line sold before terms existed, which was monthly. */
export function intervalSuffix(interval: string | null | undefined): string {
  return SUFFIX[interval === "quarter" || interval === "year" ? interval : "month"];
}

export function termSuffix(term: BillingTerm): string {
  return SUFFIX[INTERVAL_OF[term]];
}

/** The terms any of the plans sells, in month → quarter → year order: what
 *  the picker's switch offers. */
export function termOptions(plans: ReadonlyArray<{ termPrices?: TermPrice[] }>): BillingTerm[] {
  const sold = new Set(plans.flatMap((p) => (p.termPrices ?? []).map((t) => t.term)));
  return TERMS.filter((t) => sold.has(t));
}

/**
 * The price a plan's card shows, and the term its checkout sends, when the
 * buyer has picked `term`: that term if the plan sells it, else the plan's
 * first sold term (Agency under "Monthly" shows its quarterly price, flagged
 * `fallback`, rather than a monthly figure it is never sold at). Null for a
 * plan with no sellable term (contact sales). An api without `termPrices`
 * (older) prices it monthly from `amount`, as it always did.
 */
export function priceForTerm(
  plan: { amount: number; termPrices?: TermPrice[] },
  term: BillingTerm,
): (TermPrice & { fallback: boolean }) | null {
  if (!plan.termPrices) return { term: "monthly", amount: plan.amount, fallback: term !== "monthly" };
  const exact = plan.termPrices.find((t) => t.term === term);
  if (exact) return { ...exact, fallback: false };
  const first = plan.termPrices[0];
  return first ? { ...first, fallback: true } : null;
}

/** Recurring totals, one per period present, in month → quarter → year order
 *  (`/v1/billing/summary`'s `monthlyTotal` / `quarterlyTotal` / `yearlyTotal`,
 *  an order confirmation's string totals). Monthly is listed when it is above
 *  zero or when nothing else is, so a quarterly-only business never reads
 *  "₹0/mo"; a period with no line (null / absent) is left out. */
export function periodTotals(t: {
  monthlyTotal: number | string | null | undefined;
  quarterlyTotal?: number | string | null;
  yearlyTotal?: number | string | null;
}): Array<{ interval: BillingInterval; amount: number }> {
  const num = (v: number | string | null | undefined) => (v == null ? null : Number(v));
  const q = num(t.quarterlyTotal);
  const y = num(t.yearlyTotal);
  const m = num(t.monthlyTotal);
  const out: Array<{ interval: BillingInterval; amount: number }> = [];
  if (m != null && (m > 0 || (q == null && y == null))) out.push({ interval: "month", amount: m });
  if (q != null) out.push({ interval: "quarter", amount: q });
  if (y != null) out.push({ interval: "year", amount: y });
  return out;
}
