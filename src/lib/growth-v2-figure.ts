import type { AdPlatform, Figure, HomeResponse, Money, OutcomeKind } from "@/lib/api/growth-v2";

/**
 * Reading and formatting plan 2.10 figures.
 *
 * ★ABSENT IS NOT ZERO. A `Figure` is `{ value }` or `{ absent: reason }`, and
 * every helper here keeps the two apart: nothing coerces an absent figure to 0,
 * averages one in, or lets arithmetic reach it. `figureValue` returns
 * `undefined` for an absent figure, never 0, and the formatters return a
 * labelled absence, never "0".
 */

export function isAbsent(f: Figure | Money | undefined): f is { absent: string } {
  return f === undefined || "absent" in f;
}

/** The number, or `undefined` when absent. Never 0 for "unknown". */
export function figureValue(f: Figure | Money | undefined): number | undefined {
  return f !== undefined && "value" in f ? f.value : undefined;
}

/** Why a figure is absent, when it is. */
export function absentReason(f: Figure | Money | undefined): string | undefined {
  return f !== undefined && "absent" in f ? f.absent : undefined;
}

/** What a screen prints for a figure it does not have. */
export const ABSENT_LABEL = "Not available";

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
}

export function formatMoney(value: number, currency: string): string {
  // No currency known: print the bare number rather than guess a symbol.
  if (!currency) return formatCount(value);
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // An unknown currency code throws RangeError; show the code rather than a wrong symbol.
    return `${currency} ${formatCount(value)}`;
  }
}

/** A fraction as a whole percent: 0.65 -> "65%". */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** A change fraction with its sign: 0.18 -> "+18%", -0.093 -> "-9%". */
export function formatChange(fraction: number): string {
  const pct = Math.round(fraction * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/** The text of a figure, or the absence label. */
export function figureText(f: Figure | Money | undefined, format: (n: number) => string = formatCount): string {
  const v = figureValue(f);
  return v === undefined ? ABSENT_LABEL : format(v);
}

/** The text of a money figure, in its own currency. */
export function moneyText(m: Money | undefined): string {
  return m !== undefined && "value" in m ? formatMoney(m.value, m.currency) : ABSENT_LABEL;
}

// -- Platforms ----------------------------------------------------------------

export const PLATFORM_LABEL: Record<AdPlatform, string> = {
  meta: "Meta Ads",
  google_ads: "Google Ads",
  x: "X Ads",
  linkedin: "LinkedIn Ads",
};

/** The chart token each platform draws with. */
export const PLATFORM_COLOR: Record<AdPlatform, string> = {
  meta: "var(--chart-4)",
  google_ads: "var(--chart-3)",
  x: "var(--chart-5)",
  linkedin: "var(--chart-2)",
};

// -- Dates --------------------------------------------------------------------

/** "26 Oct". Pinned to UTC and en-GB so the text does not depend on the host. */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

/** "2 Oct 2026". Pinned to UTC and en-GB, like `formatDay`. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Whole hours from `now` to `iso`, never negative. */
export function hoursUntil(iso: string, now: number): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 3_600_000));
}

// -- The home headline ----------------------------------------------------------

/**
 * The home page's one-sentence answer, built only from figures that are present.
 *
 * ★EVERY CLAUSE IS CONDITIONAL ON ITS FIGURE. A missing cost does not become
 * "at 0 each", and a missing lift does not become "none of them were caused by
 * your ads". The sentence just gets shorter.
 */
export function homeHeadline(home: HomeResponse, currency: string): string {
  const label = home.outcome.label.toLowerCase();
  const count = figureValue(home.kpis.find((k) => k.key === "outcomes")?.figure) ?? figureValue(home.goal?.soFar);
  const cost = figureValue(home.efficiency.you);
  const costKpi = home.kpis.find((k) => k.key === "cost_per_outcome");
  const costChange = figureValue(costKpi?.change);
  const extra = figureValue(home.kpis.find((k) => k.key === "incremental")?.figure);

  if (count === undefined) return `We don't have a count of your ${label} for this month yet.`;
  let s = `You got ${formatCount(count)} ${label}`;
  if (home.efficiency.metric === "cost_per_outcome" && cost !== undefined) {
    s += ` at ${formatMoney(cost, currency)} each`;
    if (costChange !== undefined && costChange !== 0) {
      s += `, ${formatPercent(Math.abs(costChange))} ${costChange < 0 ? "cheaper" : "dearer"} than last month`;
    }
  } else if (home.efficiency.metric === "roas" && cost !== undefined) {
    s += ` at ${cost.toFixed(1)}x return on ad spend`;
  }
  s += ".";
  if (extra !== undefined) {
    s += ` ${formatCount(extra)} of them would not have happened without your ads, measured against a holdout.`;
  }
  return s;
}

// -- Outcomes and currency -----------------------------------------------------------

/** What one outcome of a kind is called, singular and plural. */
export const OUTCOME_UNIT: Record<OutcomeKind, { one: string; many: string }> = {
  sales: { one: "order", many: "orders" },
  bookings: { one: "booking", many: "bookings" },
  leads: { one: "lead", many: "leads" },
  calls: { one: "call", many: "calls" },
  store_visits: { one: "store visit", many: "store visits" },
};

/** The currency of the first present money figure, or "" when none is. */
export function currencyOf(...monies: Array<Money | undefined>): string {
  for (const m of monies) if (m !== undefined && "currency" in m) return m.currency;
  return "";
}
