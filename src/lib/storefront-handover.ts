/**
 * SA-9: a storefront chat the assistant has handed to the team. The words and the decisions behind the thread view's
 * live-reply parts, kept out of the markup so each can be tested.
 *
 * Contract: peakhour-api `/v1/storefront-chats` (reply, handoff, resume, suggest-reply, summary, contact-data).
 *
 * @package peakhour-b2c
 */

import { ApiError } from "@/lib/api";
import { KNOWN_ON_5XX, canReply, type ReplyErrorCopy } from "@/lib/wa-inbox-reply";

/** The longest reply the api takes on a storefront chat. */
export const STOREFRONT_REPLY_MAX = 2000;

export type StorefrontDelivery = "visitor_here" | "visitor_away" | "visitor_away_email";
export type HandoverKind = "refund" | "discount" | "payment";

export interface StorefrontHandover {
  reason: string;
  reasonLabel: string;
  at: string | null;
  note: string | null;
  kind: HandoverKind | null;
  orderNumber: string | null;
  adminUrl: string | null;
  lastAsks: string[];
}

export function isStorefrontThread(threadId: string | null | undefined): boolean {
  return Boolean(threadId?.startsWith("storefront:"));
}

/** The api mount for one storefront chat. */
export function storefrontMount(threadId: string): string {
  return `/v1/storefront-chats/${encodeURIComponent(threadId)}`;
}

/** The request a storefront reply makes: the text trimmed, as the key was bound to it. */
export function storefrontReplyRequest(threadId: string, text: string, idempotencyKey: string): { path: string; body: { text: string; idempotencyKey: string } } {
  return { path: `${storefrontMount(threadId)}/reply`, body: { text: text.trim(), idempotencyKey } };
}

/** Resume sends the version the view rendered, so a stale view is a refusal and not a release. Absent when the read had none. */
export function storefrontResumeBody(thread: { statusVersion?: unknown } | null | undefined): { statusVersion: number } | undefined {
  const v = thread?.statusVersion;
  return typeof v === "number" && Number.isInteger(v) ? { statusVersion: v } : undefined;
}

/** What sits under the thread: the reply box, or a read-only note with a way to take over. */
export type StorefrontFooter =
  | { kind: "composer" }
  | { kind: "takeover"; note: string }
  | { kind: "readonly"; note: string };

export const STOREFRONT_READONLY_NOTE = "The assistant is handling this chat. You can read it here, or take it over to reply yourself.";
export const STOREFRONT_TEST_NOTE = "This is your own test chat, so it is here to read, not to reply to.";
export const STOREFRONT_VIEWER_NOTE = "You can read this chat, but replying to visitors needs Editor access or above.";

export function storefrontFooter(args: { readOnly: boolean; role: string | null | undefined; test?: boolean }): StorefrontFooter {
  if (args.test) return { kind: "readonly", note: STOREFRONT_TEST_NOTE };
  if (!canReply(args.role)) return { kind: "readonly", note: STOREFRONT_VIEWER_NOTE };
  if (args.readOnly) return { kind: "takeover", note: STOREFRONT_READONLY_NOTE };
  return { kind: "composer" };
}

/** The line under the box. Never says "delivered" when the visitor is away. */
export function deliveryLine(d: StorefrontDelivery | null | undefined): string | null {
  switch (d) {
    case "visitor_here":
      return "The visitor has this chat open and sees your reply now.";
    case "visitor_away":
      return "The visitor is not in the chat right now. They see your reply if they come back to it.";
    case "visitor_away_email":
      return "The visitor is not in the chat right now. They left an email: follow up there as well.";
    default:
      return null;
  }
}

export function storefrontTextProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return "Write a reply first.";
  if (t.length > STOREFRONT_REPLY_MAX) return `At most ${STOREFRONT_REPLY_MAX.toLocaleString("en-US")} characters (this is ${t.length.toLocaleString("en-US")}).`;
  return null;
}

const NOTHING_SENT = "Nothing was sent.";

function said(err: ApiError, fallback: string): string {
  const m = err.message?.trim();
  return m && m !== "Request failed" ? m : fallback;
}

/** What each way a storefront reply can fail says. Every one says whether the visitor may have got it. */
export function storefrontReplyError(err: unknown): ReplyErrorCopy {
  const base = { attempt: "keep" as const, refetchTemplates: false, closesWindow: false };
  if (!(err instanceof ApiError) || err.code === "PARSE_ERROR" || (err.status >= 500 && err.code !== "CHANNEL_UNAVAILABLE" && !KNOWN_ON_5XX.has(err.code ?? ""))) {
    return {
      ...base,
      title: "We lost touch before we heard back",
      detail: "We can't tell yet whether this reply went. Pressing Send again without changing anything is safe: it will not appear twice.",
    };
  }
  switch (err.code) {
    case "REPLY_OUTCOME_UNKNOWN":
      return {
        ...base,
        attempt: "unknown",
        title: "We can't tell whether this reply was saved",
        detail: "Check this chat before sending anything else: sending it again could show it twice.",
      };
    case "REPLY_IN_PROGRESS":
      return { ...base, title: "This reply is still being handled", detail: "We are still working on this exact message, and it will not appear twice. Check the chat in a moment." };
    case "STATUS_CHANGED":
      return { ...base, title: "This chat changed hands", detail: `${said(err, "Refresh it and try again.")} ${NOTHING_SENT}` };
    case "CHANNEL_UNAVAILABLE":
      return { ...base, attempt: "fresh", title: "This chat can't take a reply right now", detail: `${said(err, "Try again in a moment.")} ${NOTHING_SENT}` };
    case "TEXT_TOO_LONG":
    case "VALIDATION_ERROR":
      return {
        ...base,
        title: "This reply can't be sent as written",
        detail: `It must not be empty, and must be at most ${STOREFRONT_REPLY_MAX.toLocaleString("en-US")} characters. ${NOTHING_SENT}`,
      };
    case "FORBIDDEN":
      return { ...base, title: "You don't have permission to reply", detail: `Replying to visitors needs Editor access or above. ${NOTHING_SENT}` };
    case "NOT_FOUND":
      return { ...base, title: "This chat isn't available any more", detail: NOTHING_SENT };
    default:
      return {
        ...base,
        title: "We couldn't confirm this reply",
        detail: `${said(err, "Something went wrong while sending.")} Pressing Send again without changing anything is safe: it will not appear twice.`,
      };
  }
}

// ── the handover card ──────────────────────────────────────────────────────────────────────────────────────────────

/** The heading over the prepared note. */
export function noteHeading(kind: HandoverKind | null, orderNumber: string | null): string {
  const order = orderNumber ? ` for order ${orderNumber}` : "";
  if (kind === "refund") return `Refund request${order}`;
  if (kind === "discount") return `Discount request${order}`;
  if (kind === "payment") return `Payment problem${order}`;
  return "Note from the assistant";
}

/** The email line: the address for an editor and above, a plain fact for a viewer, nothing when none was left. */
export function emailLine(contactEmail: string | null | undefined, hasContactEmail: boolean | undefined): string | null {
  if (contactEmail) return `The visitor left an email: ${contactEmail}`;
  if (hasContactEmail) return "The visitor left an email";
  return null;
}

/** The order link opens only when it is the Shopify admin over https. */
export function safeAdminUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "admin.shopify.com" ? u.toString() : null;
  } catch {
    return null;
  }
}

export const DELETE_VISITOR_TITLE = "Delete this visitor’s chat?";
export const DELETE_VISITOR_BODY =
  "This permanently deletes this chat and anything the visitor left, including an email. Orders in your Shopify store are not touched, and a chat you are keeping under a legal hold stays until you lift the hold. This can’t be undone.";
export const DELETE_VISITOR_CONFIRM = "Delete the chat";
export const DELETE_VISITOR_TOAST = "Deleted this visitor’s chat and anything they left.";
