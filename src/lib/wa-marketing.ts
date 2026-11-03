/**
 * WhatsApp cart recovery and broadcasts: shapes and words (lane I3d).
 *
 * The api answers (`/v1/commerce/wa-marketing/*`) are the same ones the Shopify admin app reads, so a figure here is the figure
 * there. This file holds only what is worth testing on its own: the sentences, the audience labels, and the arithmetic of a
 * results row.
 */

export type Ready = "ready" | "no_whatsapp" | "template_not_approved" | "no_template";

export interface WaSettings {
  cartRecovery: { enabled: boolean; delayMinutes: number; secondReminder: boolean };
  broadcasts: { enabled: boolean };
  frequencyCap: { max: number; perDays: number };
}

export interface WaOverview {
  supported: boolean;
  stopped: boolean;
  settings: WaSettings;
  recovery: {
    ready: Ready;
    counts: { watching: number; reminded: number; recovered: number };
    recoveredRevenue: Array<{ currency: string; minor: number }>;
    windowDays: number;
  };
  ratesAsOf: string;
}

export type AudienceKind = "all_opted_in" | "purchased_recent" | "bought_product" | "cod_buyers" | "never_purchased";

export interface Audience {
  kind: AudienceKind;
  days?: number;
  sourceProductId?: string;
}

export interface WaTemplate {
  name: string;
  language: string;
  body: string;
  slots: number;
}

export interface Preview {
  audienceSize: number;
  estimate: { currency: string; perMessageMinor: number; totalMinor: number } | null;
  estimateLine: string;
  message: string;
  problems: string[];
}

export interface BroadcastCounts {
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  skipped: number;
  attributedOrders: number;
  attributedMinor: number;
}

export interface Broadcast {
  id: string;
  name: string;
  templateName: string;
  message: string;
  audience: Audience;
  audienceSize: number;
  estimate: { currency: string; totalMinor: number } | null;
  status: "scheduled" | "sending" | "sent" | "cancelled";
  scheduledFor: string;
  startedAt: string | null;
  finishedAt: string | null;
  counts: BroadcastCounts;
  canCancel: boolean;
}

export const AUDIENCE_OPTIONS: ReadonlyArray<{ kind: AudienceKind; label: string; help: string }> = [
  { kind: "all_opted_in", label: "Everyone who opted in", help: "Every shopper who has messaged your store on WhatsApp and agreed to receive offers." },
  { kind: "purchased_recent", label: "Bought recently", help: "Opted-in shoppers with a paid order in the last number of days you choose." },
  { kind: "bought_product", label: "Bought a product", help: "Opted-in shoppers with a paid order that included the product you choose." },
  { kind: "cod_buyers", label: "Cash on delivery buyers", help: "Opted-in shoppers with a cash on delivery order that was not cancelled." },
  { kind: "never_purchased", label: "Never purchased", help: "Opted-in shoppers with no order at all." },
];

export function audienceSentence(a: Audience, productTitle?: string): string {
  switch (a.kind) {
    case "all_opted_in":
      return "Everyone who opted in";
    case "purchased_recent":
      return `Bought in the last ${a.days ?? 0} days`;
    case "bought_product":
      return `Bought ${productTitle ?? "one product"}`;
    case "cod_buyers":
      return "Cash on delivery buyers";
    case "never_purchased":
      return "Never purchased";
  }
}

export const STATUS_LABEL: Record<Broadcast["status"], string> = {
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
};

export function readinessCopy(ready: Ready, stopped: boolean): { tone: "info" | "warning"; heading: string; body: string } | null {
  if (stopped) return { tone: "warning", heading: "Your emergency stop is on", body: "Nothing is sent while it is on. Turn it off in Autopilot when you want messages to go out again." };
  switch (ready) {
    case "ready":
      return null;
    case "no_whatsapp":
      return { tone: "warning", heading: "Connect WhatsApp first", body: "Messages are sent from your own WhatsApp Business number. Connect it, then come back here." };
    case "template_not_approved":
      return {
        tone: "info",
        heading: "Waiting for Meta to approve the reminder message",
        body: "Meta has to approve the reminder message on your WhatsApp account before anything is sent. Until then nothing goes out, even if you switch this on. Meta decides how long that takes, often a day or more.",
      };
    case "no_template":
      return { tone: "info", heading: "Cart reminders are not available for your store yet", body: "Peakhour has not set up the reminder message yet. Nothing is sent until it is. Nothing for you to do." };
  }
}

export const FEES_NOTE = "Meta bills its WhatsApp fees to you directly. Peakhour adds no markup.";
export const CART_INTRO =
  "When a shopper who opted in to WhatsApp leaves items in their cart, Peakhour sends one reminder with a link back to it. Shoppers who have not opted in are never messaged, and anyone can reply STOP at any time.";
export const BROADCAST_INTRO =
  "Send an offer to shoppers who opted in on WhatsApp, using a marketing message Meta has already approved on your account. You see how many people it reaches and an estimate of Meta's cost before anything is sent.";
export const NOT_UNDOABLE = "Once a broadcast starts sending it cannot be cancelled or undone.";

/** The confirmation dialog's body: exactly what is about to happen, in numbers the merchant just saw. */
export function confirmSentence(size: number, estimateLine: string, scheduledFor: Date | null): string {
  const when = scheduledFor ? `at ${scheduledFor.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "now";
  const who = `${size} ${size === 1 ? "shopper" : "shoppers"}`;
  return `This will send a WhatsApp message to ${who}, starting ${when}. ${estimateLine} ${NOT_UNDOABLE}`;
}

const pct = (n: number, of: number) => (of <= 0 ? "0%" : `${Math.round((n / of) * 100)}%`);

/** A results row as the merchant reads it: each figure beside the share of messages sent. */
export function resultsLine(c: BroadcastCounts): Array<{ label: string; value: string }> {
  return [
    { label: "Sent", value: String(c.sent) },
    { label: "Delivered", value: `${c.delivered} (${pct(c.delivered, c.sent)})` },
    { label: "Read", value: `${c.read} (${pct(c.read, c.sent)})` },
    { label: "Replied", value: `${c.replied} (${pct(c.replied, c.sent)})` },
    { label: "Orders within 7 days", value: String(c.attributedOrders) },
  ];
}

/** Why some of the audience was not sent to, in words. Empty when everyone was. */
export function notSentLine(c: BroadcastCounts): string {
  const parts: string[] = [];
  if (c.skipped > 0) parts.push(`${c.skipped} skipped (they opted out since, hit your message limit, or were removed)`);
  if (c.failed > 0) parts.push(`${c.failed} could not be sent`);
  if (c.queued > 0) parts.push(`${c.queued} still waiting`);
  return parts.join("; ");
}

/** Minor units as money in the currency's own precision (₹1,499.00 / ¥1,500). */
export function moneyMinor(minor: number, currency: string): string {
  try {
    const f = new Intl.NumberFormat("en-IN", { style: "currency", currency });
    const digits = f.resolvedOptions().maximumFractionDigits ?? 2;
    return f.format(minor / 10 ** digits);
  } catch {
    return `${minor / 100} ${currency}`;
  }
}
