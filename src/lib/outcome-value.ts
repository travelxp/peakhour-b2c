/**
 * What the `value` block on Outcomes may be RENDERED as.
 *
 * ── ★★THE API DECIDES WHAT IS TRUE; THIS FILE DECIDES HOW IT READS ─────────
 *
 * Every judgement is already made upstream (api#1261): whether an amount may be
 * shown at all, which source it came from, how much of the period it covers,
 * and why it is missing. That was done in one place on purpose — this page and
 * the Shopify app must not be able to answer those questions differently.
 *
 * ★SO NOTHING HERE DECIDES. It formats an amount, names a source, and turns a
 * coverage into a sentence. It must never invent a zero, substitute a fallback
 * figure, or compute a period of its own — the three ways a surface undoes an
 * honest-absence contract while looking completely reasonable.
 *
 * ── ★★AND THE SHOPIFY APP SAYS THE SAME THING, BY DERIVING IT THE SAME WAY ──
 *
 * peakhour-shopify's `lib/outcome-value.ts` is this file's twin. They cannot
 * import from each other — separate repos, no shared package — so what keeps
 * them honest is that NEITHER decides anything: both read `available`,
 * `source`, `partial` and the covered dates and phrase exactly what those say.
 *
 * ⏸IF THESE TWO EVER DIVERGE, the fix is to move the decision further into the
 * api rather than to sync the copy. A rule that lives in two places is a rule
 * that will differ in two places.
 */

export interface ValueAvailable {
  available: true;
  source: "commerce" | "analytics";
  amount: number;
  currency: string;
  transactions?: number;
  transactionDays?: number;
  coveredSince: string;
  coveredUntil: string;
  daysMeasured: number;
  daysInWindow: number;
  partial: boolean;
}

export interface ValueUnavailable {
  available: false;
  reason: "not_reported" | "mixed_currency" | "unconfirmed_zero";
  message: string;
  transactions?: number;
  transactionDays?: number;
  daysInWindow?: number;
}

export type OutcomeValue = ValueAvailable | ValueUnavailable;

/**
 * The amount, in the currency the api said it was in.
 *
 * ★★THE CODE COMES FROM THE RESPONSE, NEVER FROM THE BROWSER. `undefined` as
 * the locale lets the viewer's own formatting rules apply — separators, symbol
 * placement, digit grouping — while the CURRENCY stays the merchant's. Deriving
 * it from the locale instead would relabel an Indian merchant's rupees as
 * dollars for a reader in New York, which is the one thing a money figure must
 * never do.
 */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    // ★A CODE Intl REFUSES MUST NOT TAKE THE PAGE DOWN. The api validates
    // against ISO-4217, so this is defence rather than expectation — but an
    // uncaught throw here would blank the whole Outcomes view over a formatting
    // detail, and the amount is still perfectly reportable beside its code.
    return `${currency} ${new Intl.NumberFormat(undefined).format(amount)}`;
  }
}

/**
 * Where the figure came from, in words.
 *
 * ★ALWAYS SHOWN, because a figure nobody can argue with is magic. It is also
 * the difference a merchant needs the moment this number disagrees with the one
 * in their own store admin.
 */
export function sourceLabel(source: ValueAvailable["source"]): string {
  return source === "commerce" ? "From your store's own orders" : "Measured by Google Analytics";
}

/** A date a shopkeeper reads, in their own locale. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * The sentence under the amount.
 *
 * ★★THE DATES ARE SAID OUT LOUD WHEN THE FIGURE DOES NOT COVER THE PERIOD. A
 * total summed over 22 of 30 days is a true number and a false answer to the
 * question the period heading just asked, and the reader has no way to tell
 * unless the span is stated. `partial` is the api's own flag — this does not
 * recompute it from the day counts, because two surfaces recomputing the same
 * rule is how they come to disagree.
 */
export function provenanceLine(value: ValueAvailable): string {
  const base = sourceLabel(value.source);
  if (!value.partial) return base;
  return `${base} · covers ${shortDate(value.coveredSince)} to ${shortDate(
    value.coveredUntil,
  )}, not the whole period`;
}

/**
 * The order count, where there is one, and how much of the period it covers.
 *
 * ★IT SURVIVES A REFUSAL, which is the point of returning something at all
 * here. A purchase count needs no currency, so a window we cannot total still
 * has one — and on a two-currency store it is the only money-adjacent figure
 * there is. Returns null when the api sent none, never "0 orders": a count
 * nobody took is not a count of nought.
 */
export function orderCountLine(value: OutcomeValue): string | null {
  if (value.transactions === undefined) return null;
  const noun = value.transactions === 1 ? "order" : "orders";
  const count = new Intl.NumberFormat(undefined).format(value.transactions);
  if (value.available) return `from ${count} ${noun}`;

  // ★AND IT IS DATED ON A REFUSAL. Without the coverage, a bare "17 orders in
  // this period" claims the whole period for a count that may cover half of it
  // — the same false claim the amount above it was withheld to avoid.
  const short =
    value.transactionDays !== undefined &&
    value.daysInWindow !== undefined &&
    value.transactionDays < value.daysInWindow;
  return short
    ? `${count} ${noun} in this period (counted on ${value.transactionDays} of ${value.daysInWindow} days)`
    : `${count} ${noun} in this period`;
}
