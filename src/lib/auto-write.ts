/**
 * Automatic writing, in Peaks (Content Wave 2, W2-A): the settings card's data and wording.
 *
 * The api is `GET/PUT /v1/content/auto-write`. Every job is OFF until the merchant switches it on here AND sets one monthly limit for all of them: Peakhour writes
 * nothing on its own before that. NO PRICE IS TYPED HERE: every number on screen is the api's, which reads the rate card. A price that is null (no row) is said, never
 * shown as 0 or hidden. Peaks only: no currency figure beside a price. Automatic work only ever writes DRAFTS into Needs your OK; a person approves.
 */
import { parseCap, peaksWord } from "@/lib/wordpress-ai-images";

export { parseCap, peaksWord };

export type AutoWriteJobKey = "weekly_plan" | "new_blog_post" | "new_product" | "sale_or_festival" | "recycle_top_post" | "fresh_recurring";

export interface AutoWriteJobStatus {
  job: AutoWriteJobKey;
  label: string;
  what: string;
  enabled: boolean;
  /** Today's price per draft; null when the api cannot price it. */
  pricePerDraftPeaks: number | null;
  acceptedPricePeaks: number | null;
  /** The price went up after they accepted: the job stays off until they accept again. */
  needsReaccept: boolean;
}

export interface AutoWriteStatus {
  /** The one monthly limit for every job; null until they set one. */
  monthlyCapPeaks: number | null;
  usedPeaks: number;
  remainingPeaks: number | null;
  month: string;
  jobs: AutoWriteJobStatus[];
  /** At least one job is on AND a limit is set. */
  runs: boolean;
}

export interface AutoWriteInput {
  monthlyCapPeaks?: number | null;
  jobs?: Partial<Record<AutoWriteJobKey, { enabled: boolean; acceptedPricePeaks?: number }>>;
}

/** How many drafts a limit covers at a price, whole drafts only. */
export function draftsCovered(capPeaks: number, pricePeaks: number): number {
  return pricePeaks > 0 ? Math.floor(capPeaks / pricePeaks) : 0;
}

/** The limit offered first: five drafts' worth. */
export function suggestedCap(pricePeaks: number): number {
  return Math.round(pricePeaks * 5);
}

export const AUTO_WRITE_COPY = {
  title: "Automatic writing",
  intro: "Let Peakhour write drafts for you without being asked. Every job is off until you turn it on, and Peakhour never goes past the monthly limit you set. Nothing is posted: each draft waits for your OK.",
  on: "On",
  off: "Off",
  limitLabel: "Monthly limit for all automatic writing (Peaks)",
  saveLimit: "Save limit",
  noLimit: "No limit is set, so nothing is written automatically yet.",
  confirmTitle: "Turn this on?",
  yes: "Yes, turn on",
  no: "No",
  needsReaccept: "The price has changed, so this is paused. Check the new price and turn it on again.",
  reaccept: "Accept the new price",
  noPrice: "The price of a draft is not set yet, so this cannot be turned on.",
  adminOnly: "Changing this uses Peaks, so it takes an owner or admin.",
  loadFailed: "Automatic writing settings could not be loaded.",
  limitInvalid: "Enter a whole number of Peaks, 1 or more.",
  limitBelowPrice: "The limit must cover at least one draft.",
} as const;

/** "Each draft costs 225 Peaks, and only when the draft is written." */
export function priceLine(price: number | null): string | null {
  return price === null ? null : `Each draft costs ${peaksWord(price)}, and only when the draft is written.`;
}

/** "Used this month: 450 of 5,000 Peaks." */
export function usageLine(s: Pick<AutoWriteStatus, "usedPeaks" | "monthlyCapPeaks">): string | null {
  return s.monthlyCapPeaks === null ? null : `Used this month: ${s.usedPeaks.toLocaleString("en-US")} of ${peaksWord(s.monthlyCapPeaks)}.`;
}

/** The one plain sentence in the confirmation: the job, the price, the limit, and that nothing posts without an OK. */
export function confirmSentence(label: string, price: number, cap: number): string {
  const n = draftsCovered(cap, price);
  return `${label}: each draft costs ${peaksWord(price)}, charged only when the draft is written. Peakhour will stop at ${peaksWord(cap)} a month, which is ${n} ${n === 1 ? "draft" : "drafts"}. Nothing is posted until you say OK.`;
}

/** The api's own sentence when it sent one, else a next step: never a bare code. */
export function autoWriteErrorMessage(err: unknown): string {
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" && m.trim() ? m : "That did not work. Check your connection and try again.";
}
