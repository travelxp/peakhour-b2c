/**
 * One place that decides how a change between two periods is shown, so Home,
 * Website traffic and Search Console cannot disagree about what "up 12%" means.
 *
 * The rules, each one a way a comparison goes wrong if left to the caller:
 *   - No prior value (null, undefined, NaN) is `null`, never "0%". The caller
 *     renders nothing.
 *   - A previous value of 0 cannot give a percent (division by zero), so the
 *     change is shown as a count ("+12"), not as infinity or as "100%".
 *   - A small previous value makes a percent misleading (3 to 6 is "+100%"
 *     but means three more), so below SMALL_BASE the change is a count too.
 *   - A change that rounds to nothing is "no change", not "+0%".
 *   - Direction (up/down) is separate from tone (good/bad): for a metric where
 *     lower is better, such as search position, a fall is good.
 */

/** Below this previous value a percent is not shown, the absolute change is. */
export const SMALL_BASE = 20;

export type DeltaDirection = "up" | "down" | "flat";
export type DeltaTone = "good" | "bad" | "neutral";

export interface PeriodDelta {
  direction: DeltaDirection;
  tone: DeltaTone;
  /** "percent" is a relative change; "absolute" is the raw difference in the metric's own unit. */
  basis: "percent" | "absolute";
  /** Size of the change, unsigned and already rounded. 0 when direction is "flat". */
  amount: number;
  /** Unit word for an absolute change ("pts", "places"); empty for a plain count or a percent. */
  unit: string;
}

export interface PeriodDeltaOptions {
  /** Previous value under which a percent is replaced by the absolute change. Default SMALL_BASE. */
  smallBase?: number;
  /** Lower is better (search position): a fall reads as good. */
  lowerIsBetter?: boolean;
  /** Never give a percent. For rates and positions, where the difference is the honest figure. */
  absoluteOnly?: boolean;
  /** Unit word for an absolute change. */
  unit?: string;
  /** Decimal places for an absolute change. Default 0. */
  decimals?: number;
  /** A previous value of exactly 0 means "was not measured" (no ranking), not "was zero". */
  zeroIsMissing?: boolean;
}

function present(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** The change from `prev` to `now`, or null when there is no prior period to compare with. */
export function periodDelta(
  now: number | null | undefined,
  prev: number | null | undefined,
  options: PeriodDeltaOptions = {},
): PeriodDelta | null {
  if (!present(now) || !present(prev)) return null;
  const {
    smallBase = SMALL_BASE,
    lowerIsBetter = false,
    absoluteOnly = false,
    unit = "",
    decimals = 0,
    zeroIsMissing = false,
  } = options;
  if (zeroIsMissing && prev === 0) return null;

  const diff = now - prev;
  const useAbsolute = absoluteOnly || prev === 0 || Math.abs(prev) < smallBase;
  const basis = useAbsolute ? "absolute" : "percent";
  const amount = useAbsolute ? round(Math.abs(diff), decimals) : round(Math.abs(diff / prev) * 100, 0);
  const unitOut = useAbsolute ? unit : "";

  if (amount === 0) {
    return { direction: "flat", tone: "neutral", basis, amount: 0, unit: unitOut };
  }
  const direction: DeltaDirection = diff > 0 ? "up" : "down";
  const good = lowerIsBetter ? direction === "down" : direction === "up";
  return { direction, tone: good ? "good" : "bad", basis, amount, unit: unitOut };
}

function sizeText(d: PeriodDelta): string {
  if (d.basis === "percent") return `${d.amount}%`;
  return `${d.amount.toLocaleString("en-US")}${d.unit ? ` ${d.unit}` : ""}`;
}

/** Short visible text: "+12%", "-3", "+2.5 pts", "no change". */
export function deltaText(d: PeriodDelta): string {
  if (d.direction === "flat") return "no change";
  return `${d.direction === "up" ? "+" : "-"}${sizeText(d)}`;
}

/**
 * The full sentence a screen reader gets: "People: up 12% compared with the
 * week before." `comparedWith` is a phrase such as "the week before". For a
 * lower-is-better metric the verdict is spelled out, because an arrow pointing
 * down does not say that it is good news.
 */
export function deltaSentence(
  label: string,
  d: PeriodDelta,
  comparedWith: string,
  lowerIsBetter = false,
): string {
  if (d.direction === "flat") return `${label}: no change compared with ${comparedWith}.`;
  const verdict = lowerIsBetter ? (d.tone === "good" ? ", which is better" : ", which is worse") : "";
  return `${label}: ${d.direction} ${sizeText(d)} compared with ${comparedWith}${verdict}.`;
}
