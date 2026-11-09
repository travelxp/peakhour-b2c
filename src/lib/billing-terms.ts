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

/**
 * Whether a plan card is the CURRENT plan on `term` (billing plan D21, P4.2):
 * a plan held on a billed line is current on the term it is held on only
 * (`heldTerm`, from `GET /v1/billing/plans`); on another term it is a plan
 * change checkout will make. A current plan with no held term (the base plan,
 * a comp, or an older api) is current on every term, as before.
 */
export function currentOnTerm(
  p: { isCurrent: boolean; heldTerm?: BillingTerm | null },
  term: BillingTerm | null | undefined,
): boolean {
  return p.isCurrent && (p.heldTerm == null || p.heldTerm === term);
}

/** What the price of an UNKNOWN amount reads as (api#1510): never 0. */
export const PRICE_UNAVAILABLE = "Price unavailable";

/** The parts of `/v1/billing/summary` the recurring-total reading needs. */
export interface RecurringTotalsish {
  monthlyTotal: number | null;
  quarterlyTotal?: number | null;
  yearlyTotal?: number | null;
  monthlyTotalComplete: boolean;
  products: ReadonlyArray<{ amountKnown: boolean; interval: string | null; endsAt?: string | null }>;
}

/**
 * The recurring totals whose figures are KNOWN, formatted and joined
 * ("₹4,999/mo + ₹74,997/quarter"), or null when none is.
 *
 * ★AN UNKNOWN AMOUNT IS NEVER A 0 (P4.3b, api#1510). The api prices a line it
 * cannot price for the country as `amount: null`, but SUMS it as 0 into its
 * period's total and flags the summary incomplete. So a period holding only
 * unknown billed lines totals 0, and was read "₹0/quarter" beside a priced
 * Suite: an Agency charge stated as free. Such a period is left out here; the
 * caller says the total is incomplete (`recurringTotalText`). A period with a
 * priced line and an unknown one keeps its figure, a floor.
 */
export function knownRecurringTotal(
  s: RecurringTotalsish,
  format: (amount: number) => string,
): string | null {
  const unknownIn = new Set(
    s.products.filter((p) => !p.endsAt && !p.amountKnown).map((p) => intervalOf(p.interval)),
  );
  const parts = periodTotals(s)
    .filter((t) => !(t.amount === 0 && unknownIn.has(t.interval)))
    .map((t) => `${format(t.amount)}${intervalSuffix(t.interval)}`);
  return parts.join(" + ") || null;
}

/**
 * The billing page's "Recurring total" figure: the known totals, with a "+"
 * when some line's amount is unknown (a floor, not the charge); "Price
 * unavailable" when no figure is known and some line's amount is unknown; an
 * em dash when there is nothing to total (no billed line, or lines in several
 * currencies, which the api will not sum).
 */
export function recurringTotalText(
  s: RecurringTotalsish | undefined,
  format: (amount: number) => string,
): string {
  if (!s) return "—";
  const known = knownRecurringTotal(s, format);
  if (known) return s.monthlyTotalComplete ? known : `${known}+`;
  return s.monthlyTotalComplete ? "—" : PRICE_UNAVAILABLE;
}

/**
 * One line's price on the billing page: its amount and interval, or "Price
 * unavailable" for a line the api could not price (`amountKnown: false`,
 * `amount: null`); null when the summary has no such line (not loaded yet),
 * which says nothing about the price.
 */
export function lineCostText(
  line: { amount: number | null; amountKnown: boolean; interval: string | null } | undefined,
  format: (amount: number) => string,
): string | null {
  if (!line) return null;
  if (!line.amountKnown || line.amount == null) return PRICE_UNAVAILABLE;
  return `${format(line.amount)}${intervalSuffix(line.interval)}`;
}

/** A held line's interval, an absent or unknown one read as monthly
 *  (`intervalSuffix`'s rule). */
function intervalOf(interval: string | null | undefined): BillingInterval {
  return interval === "quarter" || interval === "year" ? interval : "month";
}
