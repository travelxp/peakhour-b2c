import { ApiError } from "@/lib/api";
import { canReply } from "@/lib/wa-inbox-reply";

/**
 * What the Inbox's customer panel, Suggest a reply and Refresh summary decide, kept apart from the markup so it can be tested without a
 * DOM (Inbox phase 2). The rules that matter are the api's: who may see which contact detail, which orders belong to the customer, what a
 * press costs. This file is what the page says about the answer.
 */

// ── the api's answer ───────────────────────────────────────────────────────────────────────────────────────────────

export type CodState = "pending" | "asked" | "confirmed" | "declined" | "unconfirmed" | "unreachable";

export interface PanelOrder {
  orderId: string;
  name: string;
  createdAt: string;
  cancelledAt?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  total?: { amount: string; currency: string };
  tracking: Array<{ company?: string; number?: string; url?: string }>;
  cod: { isCod: boolean; state?: CodState };
}

export type OrdersState = "ok" | "no_customer" | "no_store" | "unavailable";

export interface CustomerPanelData {
  channel: "whatsapp" | "storefront";
  anonymous: boolean;
  message?: string;
  /** `name` and `phone` are absent for a viewer; `phone` is masked to its last four digits for everyone. */
  contact?: { name?: string | null; phone?: string | null; locale: string | null; firstSeenAt: string | null; conversationCount: number };
  summary?: { text: string | null; sentiment: "positive" | "neutral" | "negative" | null; topics: string[]; updatedAt: string | null };
  orders?: {
    state: OrdersState;
    items: PanelOrder[];
    nextCursor: string | null;
    lifetime: { orderCount: number; amountSpent: { amount: string; currency: string } } | null;
    windowLimited: boolean;
  };
  prices: { customerSummary: number | null };
}

export interface InboxPrices {
  suggestReply: number | null;
  customerSummary: number | null;
  askInbox: number | null;
}

// ── price ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The price of a button, in words: "10 AI credits", "1 AI credit", "Free", or null when the rate card has no price for it.
 * ★NULL IS NOT "FREE": a missing row says nothing, and a button must not advertise a price nobody set (the api refuses the act then).
 */
export function creditsLabel(price: number | null | undefined): string | null {
  if (price === null || price === undefined || !Number.isFinite(price) || price < 0) return null;
  if (price === 0) return "Free";
  return `${price.toLocaleString("en-GB")} AI credit${price === 1 ? "" : "s"}`;
}

/** "Suggest a reply · 10 AI credits": the price is on the button, before it is pressed. With no price the button says it is not available. */
export function priced(label: string, price: number | null | undefined): { text: string; available: boolean } {
  const cost = creditsLabel(price);
  return cost === null ? { text: label, available: false } : { text: `${label} · ${cost}`, available: true };
}

// ── the panel's words ──────────────────────────────────────────────────────────────────────────────────────────────

const LOCALE = "en-GB";

export function orderDate(iso: string | null | undefined, timeZone?: string): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", ...(timeZone ? { timeZone } : {}) });
}

/** "₹1,499.00" for a known currency, "1499.00 XYZ" for one the host does not know: never a blank. */
export function money(m: { amount: string; currency: string } | null | undefined): string {
  if (!m) return "";
  const n = Number(m.amount);
  if (!Number.isFinite(n)) return `${m.amount} ${m.currency}`.trim();
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: m.currency || "USD" }).format(n);
  } catch {
    return `${m.amount} ${m.currency}`.trim();
  }
}

/** Shopify's display statuses (PAID, PARTIALLY_REFUNDED, UNFULFILLED) in plain words. */
export function plainStatus(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.toLowerCase().replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const COD_LABEL: Record<CodState, string> = {
  pending: "Cash on delivery · waiting to ask the customer",
  asked: "Cash on delivery · asked the customer to confirm",
  confirmed: "Cash on delivery · customer confirmed",
  declined: "Cash on delivery · customer declined",
  unconfirmed: "Cash on delivery · no reply from the customer",
  unreachable: "Cash on delivery · couldn’t reach the customer",
};

/** The cash-on-delivery line of an order, or null for a prepaid order. */
export function codLine(cod: PanelOrder["cod"]): string | null {
  if (!cod.isCod) return null;
  return cod.state ? COD_LABEL[cod.state] : "Cash on delivery";
}

const SENTIMENT: Record<NonNullable<NonNullable<CustomerPanelData["summary"]>["sentiment"]>, string> = {
  positive: "Mostly positive",
  neutral: "Neutral",
  negative: "Unhappy lately",
};
export function sentimentLabel(s: NonNullable<CustomerPanelData["summary"]>["sentiment"]): string | null {
  return s ? SENTIMENT[s] : null;
}

/** The sentence when the orders cannot be listed. ★Each state says what it is; none reads as "no orders". */
export function ordersNote(state: OrdersState): string | null {
  switch (state) {
    case "no_customer":
      return "No matching customer was found in your store for this conversation, so there are no orders to show.";
    case "no_store":
      return "Connect your Shopify store to see this customer’s orders here.";
    case "unavailable":
      return "Orders could not be loaded just now. Try again in a moment.";
    default:
      return null;
  }
}

/**
 * Said when the store has not approved full order history. ★IT IS THAT STORE'S LIMIT, NOT PEAKHOUR'S CHOICE (never worded as a
 * 60-day option or a setting): Shopify only shares what the store's approval allows.
 */
export const WINDOW_LIMITED_NOTE = "This store hasn’t approved full order history yet, so Shopify only shares the last 60 days of orders.";

export const ORDERS_EMPTY = "No orders yet for this customer.";

/** "7 orders · ₹18,400.50 spent" from Shopify's own figures. */
export function lifetimeLine(l: NonNullable<NonNullable<CustomerPanelData["orders"]>["lifetime"]>): string {
  return `${l.orderCount.toLocaleString("en-GB")} order${l.orderCount === 1 ? "" : "s"} · ${money(l.amountSpent)} spent`;
}

/** "Seen first 2 Jan 2026". */
export function firstSeenLine(iso: string | null | undefined): string | null {
  const d = orderDate(iso);
  return d ? `First seen ${d}` : null;
}

// ── who may do what ────────────────────────────────────────────────────────────────────────────────────────────────

/** The api's `requireRole("editor")`: Mark done, Suggest a reply, Refresh summary. */
export const canChangeConversation = canReply;

/** The api's `requireRole("admin")` on the contact-data erase. */
export function canDeleteContactData(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export const DELETE_CONTACT_TITLE = "Delete this customer’s data?";
export const DELETE_CONTACT_BODY =
  "This permanently deletes what Peakhour holds about this customer for your business: their WhatsApp conversations, their contact record (name, number, language and summary) and any messages still waiting to be sent. Orders in your Shopify store are not touched, and a conversation you are keeping under a legal hold stays until you lift the hold. This can’t be undone.";
export const DELETE_CONTACT_CONFIRM = "Delete their data";

/** What the api's erase answer means for the person: held conversations are kept, and that is said. */
export function deleteContactToast(res: { held?: { deferred?: number } } | null | undefined): string {
  const deferred = res?.held?.deferred ?? 0;
  return deferred > 0
    ? `Deleted. ${deferred === 1 ? "One conversation is" : `${deferred} conversations are`} under a legal hold, so ${deferred === 1 ? "it was" : "they were"} kept and will be deleted when you lift the hold.`
    : "Deleted this customer’s data.";
}

// ── refusals ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The api's own sentence for a refusal (it names the fix), else one with a next step. Never a bare code. */
export function actionError(e: unknown, whatFailed: string): string {
  if (e instanceof ApiError && e.message && e.status >= 400 && e.status < 500) return e.message;
  if (e instanceof ApiError && e.status === 503) return e.message || `${whatFailed} isn’t available right now.`;
  return `${whatFailed} didn’t work just now. Check your connection and try again.`;
}
