import { ApiError } from "@/lib/api";
import type { StoragePackOffer, StoragePackView, StorageUsage } from "@/lib/api/media";

/**
 * Words and states for Drive storage (Peakhour Drive Q4). Pure, so the meter, the sidebar and the Add space dialog say the same
 * thing and a test can hold the sentences.
 *
 * WHAT THE MERCHANT IS TOLD, AND WHAT IT RESTS ON:
 *  - Nothing is charged for the space they use. Extra space is a pack they choose, in Peaks, charged when bought and every 30 days.
 *  - USD-facing text says "about", at the LIST price of $1 per 1,000 Peaks. What they actually pay per Peak depends on how they
 *    bought them (top-ups and plan allowances are discounted, and prices are local), so $0.001 is never called the sale price.
 *  - A pack that cannot renew pauses NEW uploads only. The space and every file stay.
 */

export type MeterKind = "unbounded" | "normal" | "warn" | "full" | "paused";

export interface MeterState {
  kind: MeterKind;
  /** 0..100, what the bar fills to. */
  pct: number;
  /** The one sentence under the bar. */
  message: string;
  /** A call to action exists: more space can be bought. */
  canAddSpace: boolean;
}

const WARN_PCT = 80;
const FULL_PCT = 100;

export const gbText = (gb: number): string => (gb < 1 ? gb.toFixed(2) : Number.isInteger(gb) ? String(gb) : gb.toFixed(1));

/** GB USED, rounded DOWN: 4.96 of 5 reads "4.9", never "5.0", so the number never says full before the bar and the state do. */
export const gbUsedText = (gb: number): string => {
  const down = gb < 1 ? Math.floor(gb * 100) / 100 : Math.floor(gb * 10) / 10;
  return gb < 1 ? down.toFixed(2) : Number.isInteger(down) ? String(down) : down.toFixed(1);
};
export const peaksText = (n: number): string => n.toLocaleString("en-US");

/** About what a number of Peaks is in dollars at the LIST price ($1 per 1,000). Never "the price": see the module note. */
export function aboutUsd(peaks: number): string {
  const usd = peaks / 1000;
  return `about $${usd < 10 ? usd.toFixed(2) : Math.round(usd).toLocaleString("en-US")}`;
}

/** "12 November 2026", in UTC and en-US so the same instant reads the same on every machine. */
export function longDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "the renewal date";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function meterState(u: StorageUsage): MeterState {
  if (u.limitBytes === null) {
    return { kind: "unbounded", pct: 0, message: "No storage limit on your plan.", canAddSpace: false };
  }
  // A 0 GB quota has no denominator but is full, not unlimited.
  const pct = u.limitBytes === 0 ? 100 : Math.min(100, u.percentUsed ?? 0);
  // No "Add space" while a pack is paused: the guidance is to top up Peaks, and a new purchase would be gated on the same short wallet.
  const canAddSpace = u.canBuyPacks && u.catalog.length > 0 && !u.paused;
  if (u.paused) {
    return {
      kind: "paused",
      pct,
      message: "A storage pack could not renew because your Peaks are short. New uploads are paused. Your files and your space are safe. Top up your Peaks and uploads resume.",
      canAddSpace,
    };
  }
  if (pct >= FULL_PCT) {
    return {
      kind: "full",
      pct,
      message: u.source === "trial" ? "Your trial storage is full. Choose a plan to add more." : canAddSpace ? "Your Drive is full, so new uploads are paused. Delete files you no longer need or add space." : "Your Drive is full, so new uploads are paused. Delete files you no longer need.",
      canAddSpace,
    };
  }
  if (pct >= WARN_PCT) {
    return {
      kind: "warn",
      pct,
      message: u.source === "trial" ? "Your trial storage is nearly full. Choose a plan to add more." : canAddSpace ? "Your Drive is nearly full. Add space or delete files you no longer need." : "Your Drive is nearly full. Delete files you no longer need.",
      canAddSpace,
    };
  }
  return { kind: "normal", pct, message: poolLine(u), canAddSpace };
}

/** How the pool is made, in a sentence: "50 GB from 2 plans and 10 GB from packs." */
export function poolLine(u: Pick<StorageUsage, "source" | "pool" | "limitGb">): string {
  if (u.source === "trial") return `${gbText(u.pool.planGb)} GB while you try Peakhour.`;
  if (u.source === "override") return `${gbText(u.pool.overrideGb ?? 0)} GB set for your account.`;
  if (u.source === "unbounded") return "No storage limit on your plan.";
  const plans = u.pool.holdings.filter((h) => !h.trial).length;
  const fromPlans = `${gbText(u.pool.planGb)} GB from ${plans === 1 ? "your plan" : `${plans} plans`}`;
  return u.pool.packGb > 0 ? `${fromPlans} and ${gbText(u.pool.packGb)} GB from packs.` : `${fromPlans}.`;
}

export function packCostLine(p: StoragePackOffer): string {
  return `${p.gb} GB for ${peaksText(p.peaksPerMonth)} Peaks a month (${aboutUsd(p.peaksPerMonth)})`;
}

/** What an owned pack is doing, in a sentence. */
export function renewalLine(p: StoragePackView): string {
  if (p.cancelAtPeriodEnd) return `Cancelled. You keep the space until ${longDate(p.nextChargeAt)}.`;
  if (p.paused) return `Paused: not enough Peaks to renew. You keep the space; new uploads are blocked until the ${peaksText(p.peaksPerMonth)} Peaks are there.`;
  return `${peaksText(p.peaksPerMonth)} Peaks a month. Renews on ${longDate(p.nextChargeAt)}.`;
}

export const CONFIRM_BUY = (p: StoragePackOffer): string =>
  `You will be charged ${peaksText(p.peaksPerMonth)} Peaks now (${aboutUsd(p.peaksPerMonth)}) and again every 30 days. You can cancel any time, and the space stays until the date it would have renewed.`;

export const USD_NOTE =
  "Dollar amounts are about, at the list price of $1 per 1,000 Peaks. What you pay depends on how you bought your Peaks. Nothing is charged for the space you use, only for the packs you choose.";

/** Peaks still needed for a pack, or 0 when the balance covers it. */
export function shortBy(p: StoragePackOffer, balance: number | null): number {
  if (balance === null) return 0;
  return Math.max(0, Math.ceil(p.peaksPerMonth - balance));
}

/** The api's 402 for an upload that would pass the limit. */
export function isQuotaError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === "STORAGE_QUOTA_EXCEEDED";
}

/** Sentence for a failed buy or cancel: the api's own message is already plain; a short wallet adds nothing to it. */
export function packErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "STORAGE_PACK_BUSY") return "Another purchase is in progress. Check your packs in a moment before trying again.";
    return err.message || "That did not go through. Nothing was charged.";
  }
  return "That did not go through. Nothing was charged.";
}
