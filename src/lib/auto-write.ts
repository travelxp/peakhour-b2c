/**
 * Automatic writing, in Peaks (Content Wave 2, W2-A): the settings card's data and wording.
 *
 * The api is `GET/PUT /v1/content/auto-write`. Every job is OFF until the merchant switches it on here AND sets one monthly limit for all of them: Peakhour writes
 * nothing on its own before that. NO PRICE IS TYPED HERE: every number on screen is the api's, which reads the rate card. A price that is null (no row) is said, never
 * shown as 0 or hidden. Peaks only: no currency figure beside a price. Automatic work only ever writes DRAFTS into Needs your OK; a person approves.
 */
import { formatDateLabel } from "@/lib/scheduler/format";
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

/** The weekly plan's own choices (free to change): the ISO weekday it is written on (1 Monday .. 7 Sunday) and how many drafts each week (1 to 7). The api sends the defaults when never set. */
export interface WeeklyPlanChoice {
  weekday: number;
  count: number;
}

export const WEEKDAYS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];
export const PLAN_COUNTS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

/** The plan's line under the Weekly plan job: "Written every Monday, 3 drafts a week." */
export function weeklyPlanLine(c: WeeklyPlanChoice): string {
  const day = WEEKDAYS.find((d) => d.value === c.weekday)?.label ?? "Monday";
  return `Written every ${day}, ${c.count} ${c.count === 1 ? "draft" : "drafts"} a week.`;
}

export interface AutoWriteStatus {
  /** The one monthly limit for every job; null until they set one. */
  monthlyCapPeaks: number | null;
  usedPeaks: number;
  remainingPeaks: number | null;
  month: string;
  weeklyPlan: WeeklyPlanChoice;
  jobs: AutoWriteJobStatus[];
  /** At least one job is on AND a limit is set. */
  runs: boolean;
  /**
   * Automatic writing could not afford a draft and the wallet is still short (FU-5): jobs were skipped since `since`. Null (or absent from an older api) otherwise. This is the
   * empty-wallet case; the merchant's own monthly limit is `limitReached`, a different message.
   */
  pause?: AutoWritePause | null;
  /** The month's limit is reached: a job is on and none has room for another draft this month. */
  limitReached?: boolean;
}

export interface AutoWritePause {
  reason: "not_enough_peaks";
  /** ISO time of the first skip of this stretch. */
  since: string;
  /** How many jobs were skipped since then. */
  skipped: number;
}

export interface AutoWriteInput {
  monthlyCapPeaks?: number | null;
  jobs?: Partial<Record<AutoWriteJobKey, { enabled: boolean; acceptedPricePeaks?: number }>>;
  weeklyPlan?: Partial<WeeklyPlanChoice>;
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
  planDay: "Day of the week",
  planCount: "Drafts each week",
  pausedTitle: "Paused: not enough Peaks.",
  topUp: "Add Peaks",
  limitReachedTitle: "Monthly limit reached",
  limitReachedNote: "Peakhour will not write more automatically this month. It starts again next month, or when you raise the limit.",
  planNote: "Each draft is charged only when it is written, and the monthly limit still applies. Changing this costs nothing.",
} as const;

/** "Each draft costs 225 Peaks, and only when the draft is written." */
export function priceLine(price: number | null): string | null {
  return price === null ? null : `Each draft costs ${peaksWord(price)}, and only when the draft is written.`;
}

/** "3 jobs were skipped since Fri, 20 Nov." Names the day as the rest of the page does (`formatDateLabel`), in the viewer's own time zone (`timeZone` is for tests). */
export function pauseLine(p: Pick<AutoWritePause, "since" | "skipped">, timeZone?: string): string {
  const d = new Date(p.since);
  const since = Number.isNaN(d.getTime()) ? null : formatDateLabel(d, timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  // a count that is missing or not a number is "1 job", never "NaN jobs"
  const n = Number.isFinite(p.skipped) ? Math.max(1, Math.floor(p.skipped)) : 1;
  const jobs = n === 1 ? "1 job was skipped" : `${n} jobs were skipped`;
  return since ? `${jobs} since ${since}.` : `${jobs}.`;
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
