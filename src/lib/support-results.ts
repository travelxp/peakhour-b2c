/**
 * The support results page (Inbox CSAT and support analytics, I3c): what the page says about the numbers the API computes.
 *
 * ★NOTHING IS COMPUTED HERE. Every figure comes from `GET /v1/meta/whatsapp/support-analytics` (the api's
 * `services/support/support-analytics.ts` owns the maths and the definitions); this file only formats them and words them, so the
 * page, the CSV and the Shopify app block cannot disagree. Kept apart from the page so it can be tested without a DOM.
 */

export type SupportChannel = "all" | "whatsapp" | "storefront";

export interface Spread {
  count: number;
  medianMs: number | null;
  p90Ms: number | null;
}

export interface SupportMetrics {
  from: string;
  to: string;
  channel: SupportChannel;
  timeZone: string;
  conversations: { total: number; whatsapp: number; storefront: number };
  truncated: boolean;
  firstReply: Spread;
  resolution: Spread;
  aiResolved: { count: number; settled: number; share: number | null; measured: boolean };
  handOver: { count: number; rate: number | null; reasons: Array<{ reason: string; label: string; count: number }> };
  csat: {
    asked: number;
    responses: number;
    average: number | null;
    distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
    byResolvedBy: { ai: { responses: number; average: number | null }; human: { responses: number; average: number | null } };
  };
  volume: { byChannel: { whatsapp: number; storefront: number }; byHour: Array<{ hour: number; whatsapp: number; storefront: number }> };
}

export interface ChatRevenueSide {
  orders: number;
  value: number | null;
  currency: string | null;
}

export interface ChatRevenue {
  basis: "estimated";
  orders: number;
  value: number | null;
  currency: string | null;
  mixedCurrency: boolean;
  truncated: boolean;
  byChannel: { whatsapp: ChatRevenueSide | null; storefront: ChatRevenueSide | null };
}

export interface SupportResults {
  metrics: SupportMetrics;
  revenue: ChatRevenue;
  csatEnabled: boolean;
}

export interface SupportParams {
  /** YYYY-MM-DD; both empty = the API's default (the last 30 days). */
  from: string;
  to: string;
  channel: SupportChannel;
  timeZone: string;
}

export const CHANNEL_LABEL: Record<SupportChannel, string> = { all: "All channels", whatsapp: "WhatsApp", storefront: "Storefront chat" };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 180;
const DAY_MS = 86_400_000;

/** A calendar day that exists (2026-02-31 matches the shape and is not one). */
export function isRealDay(v: string): boolean {
  if (!DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** The `YYYY-MM-DD` of `now` minus `daysBack` days, in UTC (the API reads days as UTC days). */
export function dayString(now: Date, daysBack: number): string {
  return new Date(now.getTime() - daysBack * DAY_MS).toISOString().slice(0, 10);
}

/** The range for a preset: the last `days` days, today included. */
export function presetRange(days: 7 | 30 | 90, now: Date = new Date()): { from: string; to: string } {
  return { from: dayString(now, days - 1), to: dayString(now, 0) };
}

/** Why the chosen dates cannot be sent, as a sentence, or null when they can. */
export function rangeProblem(from: string, to: string): string | null {
  if (!from && !to) return null;
  if ((from && !isRealDay(from)) || (to && !isRealDay(to))) return "Choose real dates.";
  if (from && to && from > to) return "The first day must not be after the last day.";
  if (from && to && (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS + 1 > MAX_DAYS) return `Choose at most ${MAX_DAYS} days.`;
  return null;
}

/** The query string for the API. A half-chosen range is not sent (the API would read the missing end as today / 30 days back). */
export function supportQuery(p: SupportParams): string {
  const q = new URLSearchParams();
  if (p.from && p.to) {
    q.set("from", p.from);
    q.set("to", p.to);
  }
  if (p.channel !== "all") q.set("channel", p.channel);
  q.set("tz", p.timeZone);
  return q.toString();
}

export const supportResultsPath = (p: SupportParams): string => `/v1/meta/whatsapp/support-analytics?${supportQuery(p)}`;
export const supportExportPath = (p: SupportParams): string => `/v1/meta/whatsapp/support-analytics/export?${supportQuery(p)}`;

/** A wait as a person says it: "45 sec", "12 min", "1 h 5 min", "2 d 3 h". Null (nothing measured) is "No replies yet", never zero. */
export function formatWait(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "No replies yet";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} sec`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 === 0 ? `${h} h` : `${h} h ${m % 60} min`;
  const d = Math.floor(h / 24);
  return h % 24 === 0 ? `${d} d` : `${d} d ${h % 24} h`;
}

export function formatPercent(share: number | null): string {
  return share === null || !Number.isFinite(share) ? "Not enough yet" : `${Math.round(share * 100)}%`;
}

export function formatRating(avg: number | null): string {
  return avg === null ? "No ratings yet" : `${avg.toFixed(1)} out of 5`;
}

/** Money in the store's currency; the amount is a major-unit figure. A currency code the runtime does not know falls back to code + number. */
export function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-IN")}`;
  }
}

/** The revenue headline: a figure when one can be stated, else why not (never a made-up zero). */
export function revenueHeadline(r: ChatRevenue): { value: string; note: string } {
  const estimate = "Orders that included items from the assistant's chats. Shoppers might have bought them anyway, so this is an estimate.";
  if (r.orders === 0) return { value: "No orders yet", note: "No order has come through a chat in this range." };
  if (r.truncated) return { value: `${r.orders.toLocaleString("en-IN")} orders`, note: "There were too many orders to add up in one go, so no total is shown." };
  if (r.mixedCurrency) return { value: `${r.orders.toLocaleString("en-IN")} orders`, note: "These orders are in more than one currency, so no total is shown." };
  if (r.value === null || r.currency === null) return { value: `${r.orders.toLocaleString("en-IN")} orders`, note: "Some items had no usable price, so no total is shown." };
  return { value: formatMoney(r.value, r.currency), note: estimate };
}

/** The sub-line under the AI-resolved share. */
export function resolvedNote(m: SupportMetrics): string {
  if (m.aiResolved.settled === 0) return "No conversation has settled in this range yet.";
  return `${m.aiResolved.count.toLocaleString("en-IN")} of ${m.aiResolved.settled.toLocaleString("en-IN")} settled conversations were resolved by the assistant.`;
}

export function firstReplyNote(s: Spread): string {
  if (s.count === 0 || s.p90Ms === null) return "No conversation in this range was answered by a person.";
  return `9 in 10 first replies came within ${formatWait(s.p90Ms)} (${s.count.toLocaleString("en-IN")} measured).`;
}

export function ratingNote(m: SupportMetrics, csatEnabled: boolean): string {
  if (m.csat.responses > 0) return `From ${m.csat.responses.toLocaleString("en-IN")} ${m.csat.responses === 1 ? "rating" : "ratings"}${m.csat.asked > m.csat.responses ? ` out of ${m.csat.asked.toLocaleString("en-IN")} asked` : ""}.`;
  if (!csatEnabled) return "Customers are not being asked to rate. Turn it on below.";
  return m.csat.asked > 0 ? `${m.csat.asked.toLocaleString("en-IN")} asked, none answered yet.` : "No one has been asked in this range yet.";
}

/** The label for an hour bucket: "09:00". */
export const hourLabel = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;

/** The refusal sentence for a switch change, from the status; never the raw server text. */
export function csatSwitchFailure(status: number): string {
  if (status === 403) return "Only an editor, admin or owner can change this.";
  if (status === 401) return "Your session expired. Refresh the page and try again.";
  return "We couldn't save that. Try again in a moment.";
}

/** The sentence that says what the switch does, for the label under it. */
export const CSAT_SWITCH_LABEL = "Ask customers to rate a conversation when it closes";
export const CSAT_SWITCH_HELP =
  "A WhatsApp customer gets one question, \"How did we do?\", with ratings from 1 to 5. It is sent only within 24 hours of their last message, and at most once a week per conversation. It is off until you turn it on.";

/** How each figure is counted, in plain words; the page prints these under the numbers. */
export const DEFINITIONS: ReadonlyArray<{ term: string; text: string }> = [
  { term: "Median and 9 in 10", text: "The median is the middle wait: half the replies were quicker and half slower. \"9 in 10\" is the wait that nine in ten replies were quicker than." },
  { term: "First reply by a person", text: "The time from the customer message a person answered to that person's first reply. Replies from the assistant are not counted." },
  { term: "Time to resolve", text: "From the customer's first message to the moment a person marked the conversation as done, for conversations marked done in this range." },
  { term: "Resolved by the assistant", text: "A WhatsApp conversation the assistant closed with no person replying (the outcome check billed it), or a storefront chat the assistant answered start to finish: the visitor wrote, the assistant replied, and the chat was never handed to the team, no person wrote in it, and nothing new has come for 24 hours. The share is of the conversations that have settled: the assistant resolved them, or a person handled or closed them, or the chat was handed to the team and has gone quiet for 24 hours. A conversation still open is not counted either way." },
  { term: "Handed over", text: "A WhatsApp or storefront conversation the assistant passed to the team, because the customer asked for a person, could not be answered twice running, was upset more than once, or raised a payment, refund or discount problem. The rate is of the conversations in the range. A person taking a conversation over on their own is not a hand-over." },
  { term: "Customer rating", text: "Answers received in this range, from 1 (Poor) to 5 (Great)." },
  { term: "Revenue from chats", text: "The value of order items that came through the assistant on your storefront or in WhatsApp. It is an estimate: those shoppers might have bought the items anyway." },
  { term: "Test chats", text: "Your own Test on your store chats are never counted." },
];

/** The reason line for a hand-over: the API's label, with the count. */
export function reasonLine(r: { label: string; count: number }): string {
  return `${r.label}: ${r.count.toLocaleString("en-IN")}`;
}

/** Bar widths (percent of the biggest) for a list of counts; 0 when everything is 0. */
export function barWidths(counts: readonly number[]): number[] {
  const max = Math.max(0, ...counts);
  return counts.map((c) => (max === 0 ? 0 : Math.round((c / max) * 100)));
}
