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
 * ── ★★AND THE SHOPIFY APP MUST SAY THE SAME THING ──────────────────────────
 *
 * The embedded app is the other surface on this block. The two cannot import
 * from each other — separate repos, no shared package — so what has to keep
 * them honest is that NEITHER decides anything: both read `available`,
 * `source`, `partial` and the coverage, and phrase exactly what those say.
 * ⏸`search-visibility.ts` and its Shopify counterpart are the established pair;
 * this one is the same arrangement.
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
 * How every number on this card is grouped.
 *
 * ★★`en-US`, MATCHING THE PAGE, AND THAT IS A CONSISTENCY CHOICE RATHER THAN A
 * PREFERENCE. The Outcomes page formats every other figure with a hard-coded
 * `en-US`, so a card reading "1,234 wins" above "from 1.234 orders" is what a
 * viewer-default locale produces here — two conventions inside one sentence,
 * which reads as a bug whichever one is "right".
 *
 * ⏸THE REAL FIX IS APP-WIDE. This app has a `locale.ts` preference that neither
 * this card nor the page consults; when something does, it belongs here and in
 * the page's own `NUM` together, not in one of them.
 */
const LOCALE = "en-US";

/**
 * The amount, in the currency the api said it was in.
 *
 * ★★THE CODE COMES FROM THE RESPONSE, NEVER FROM THE LOCALE. Deriving it from
 * the locale would relabel an Indian merchant's rupees as dollars for a reader
 * in New York, which is the one thing a money figure must never do. The locale
 * decides only how the digits are grouped and where the symbol sits.
 */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(amount);
  } catch {
    // ★A CODE Intl REFUSES MUST NOT TAKE THE PAGE DOWN. The api validates
    // against ISO-4217, so this is defence rather than expectation — but an
    // uncaught throw here would blank the whole Outcomes view over a formatting
    // detail, and the amount is still perfectly reportable beside its code.
    return `${currency} ${new Intl.NumberFormat(LOCALE).format(amount)}`;
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

/**
 * A date a shopkeeper reads, in their own locale but on OUR calendar.
 *
 * ★★`timeZone: "UTC"` IS THE WHOLE FUNCTION. Every date the api sends is a
 * UTC-midnight instant, and formatting one in the viewer's zone shifts it a
 * full day west of UTC: `2026-08-16T00:00:00.000Z` renders "15 Aug" in New
 * York. The span sentence would then be wrong at BOTH ends for every merchant
 * in the Americas, and wrong in the direction that quietly widens the claim.
 *
 * ★THE LOCALE STAYS THE VIEWER'S. Their month names and ordering are theirs;
 * the calendar day is the one the amount was actually summed over.
 */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * The sentence under the amount.
 *
 * ★★A SHORT FIGURE IS SAID OUT LOUD — and HOW depends on the source, because
 * the two put their missing days in different places and one phrasing cannot be
 * right for both.
 *
 *   - THE BOOKS stop where the last completed sync did, so their gap is a
 *     contiguous tail and the span really did narrow. Dates say it exactly, and
 *     the end is an instant the amount includes.
 *   - A MEASUREMENT spans the whole window with holes in it — GA4 can report on
 *     Monday and Wednesday and not Tuesday — so its `covered` is deliberately
 *     the full window. Printing "covers 8 Aug to 7 Sep, not the whole period"
 *     for that is a sentence contradicting its own dates, and the real gap
 *     never gets stated. ★AND ITS END IS EXCLUSIVE (GA4 drops the partial
 *     current day), so rendering it as the last day covered claims a day the
 *     amount holds nothing from. The COUNT is the only honest description.
 *
 * ★`partial` IS THE API'S OWN FLAG and is read, never recomputed from the day
 * counts: it accounts for a short purchase count that `daysMeasured` alone
 * would miss, and two surfaces recomputing one rule is how they come to
 * disagree.
 */
export function provenanceLine(value: ValueAvailable): string {
  const base = sourceLabel(value.source);
  if (!value.partial) return base;
  if (value.source === "analytics") {
    // ★AND ONLY WHEN THE REVENUE COVERAGE IS THE SHORT ONE. `partial` is true
    // if EITHER figure falls short, so a window whose revenue covers every day
    // and whose purchase count does not would print "measured on 30 of 30
    // days" — a shortfall sentence carrying numbers that say the opposite. The
    // count's own line states that case; this one has nothing to add to it.
    if (value.daysMeasured >= value.daysInWindow) return base;
    return `${base} · measured on ${value.daysMeasured} of ${value.daysInWindow} days`;
  }
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
  const count = new Intl.NumberFormat(LOCALE).format(value.transactions);

  // ★★QUALIFIED ON BOTH BRANCHES, and a first version qualified only the
  // refusal. The count's coverage diverges from the revenue's — a property
  // whose currency we could not read records purchases and no revenue — so an
  // AVAILABLE figure can sit beside a count covering twelve of thirty days. A
  // bare "from 17 orders" there claims the whole period for it, which is
  // exactly the claim the other branch takes a clause to avoid.
  //
  // ★BUT NOT WHEN THE LINE ABOVE HAS ALREADY SAID IT. On the commerce path the
  // api sets the two coverages equal, so `short` is true exactly when
  // `partial` is — and the card then states one shortfall twice, once as a span
  // and once as a count. The qualifier exists for the DIVERGENCE, so it fires
  // on the divergence: when the count's coverage differs from the revenue's, or
  // when there is no revenue coverage stated at all because the amount was
  // refused.
  const short =
    value.transactionDays !== undefined &&
    value.daysInWindow !== undefined &&
    value.transactionDays < value.daysInWindow &&
    (!value.available || value.transactionDays !== value.daysMeasured);
  const on = short ? ` (counted on ${value.transactionDays} of ${value.daysInWindow} days)` : "";

  if (value.available) return `from ${count} ${noun}${on}`;
  return `${count} ${noun} in this period${on}`;
}
