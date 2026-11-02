import { API_BASE_URL } from "@/lib/api";

/**
 * Conversation export and the expiry banner for the Inbox (privacy programme H2).
 *
 * The rules live in the API (`services/support/conversation-export.ts`): the scope, the caps, the rate limit and the audit.
 * This file is what the page says and does with the answer, kept apart so it can be tested without a DOM.
 */

export type ExportFormat = "txt" | "jsonl";

const BASE = "/v1/meta/whatsapp/conversations/export";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Owner and admin only: a copy of every shopper's messages is more than an editor or viewer is asked to hold. */
export function canExportConversations(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** A calendar day that exists (2026-02-31 matches the shape and is not one). */
function isRealDay(v: string): boolean {
  if (!DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** The query for one conversation. The thread id is URL-encoded: it is an opaque key and never shown. */
export function threadExportPath(threadId: string, format: ExportFormat = "txt"): string {
  return `${BASE}?threadId=${encodeURIComponent(threadId)}&format=${format}`;
}

/**
 * The query for a date range; `null` when the first day is not chosen or the last day is filled in but is not a date.
 * A MALFORMED LAST DAY IS REFUSED, NOT DROPPED: dropping it would export from the first day to TODAY, up to a year of
 * messages when the merchant meant a week. An EMPTY last day is "today" and is fine.
 */
export function rangeExportPath(from: string, to: string, format: ExportFormat = "txt"): string | null {
  const f = from.trim();
  const t = to.trim();
  if (!isRealDay(f)) return null;
  if (t !== "" && !isRealDay(t)) return null;
  if (t !== "" && t < f) return null; // YYYY-MM-DD sorts as dates do
  return `${BASE}?from=${encodeURIComponent(f)}${t ? `&to=${encodeURIComponent(t)}` : ""}&format=${format}`;
}

/** The sentence for a refused export, from the API's status and code - never the raw server text. */
export function exportFailure(status: number, code?: string): string {
  if (status === 403) return "Only an owner or admin can export conversations.";
  if (status === 404) return code === "NO_CONVERSATIONS" ? "There are no conversations with messages in those days." : "That conversation is no longer available.";
  if (status === 413) return "That is more than one file can hold. Choose fewer days and try again.";
  if (status === 429) return "You exported a moment ago. Wait a minute and try again.";
  if (status === 400) return "Check the dates: the first day must be a real date, not after the last, and at most a year apart.";
  if (status === 401) return "Your session expired. Refresh the page and try again.";
  return "We couldn't make that export. Try again in a moment.";
}

function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** The banner's heading and body for `count` conversations about to be deleted, or null when there is nothing to say. */
export function expiryBanner(count: number | null | undefined, firstIso: string | null | undefined): { heading: string; body: string } | null {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 1) return null;
  const first = dateLabel(firstIso);
  return {
    heading: count === 1 ? "1 conversation will be deleted soon" : `${count} conversations will be deleted soon`,
    body:
      `Conversations are deleted 180 days after their last message.${first ? ` The first goes on or after ${first}.` : ""} ` +
      "If you need to keep any of them, export them first.",
  };
}

/** The file name the API chose, from its Content-Disposition; a fixed fallback when absent or odd. */
export function filenameFrom(disposition: string | null, fallback = "peakhour-conversations.txt"): string {
  // (the header is readable cross-origin only if the API exposes it; the caller's fallback names the format either way)
  const m = /filename="([A-Za-z0-9._-]{1,120})"/.exec(disposition ?? "");
  return m ? m[1] : fallback;
}

export type ExportOutcome = { ok: true; filename: string } | { ok: false; message: string };

/**
 * Fetch the file (cookie auth) and hand it to the browser as a download. A blob fetch rather than a link, so an expired
 * session or a refusal is a sentence on the page, not a JSON error in a dead tab (as the tax-invoice download does).
 */
export async function downloadConversationExport(path: string): Promise<ExportOutcome> {
  try {
    let res = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
    // An idle tab's access token has usually expired while its refresh cookie has not: renew once and retry, as the api client does.
    if (res.status === 401) {
      const refreshed = await fetch(`${API_BASE_URL}/v1/auth/refresh`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } }).then((r) => r.ok, () => false);
      if (refreshed) res = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
    }
    if (!res.ok) {
      let code: string | undefined;
      try {
        code = ((await res.json()) as { error?: { code?: string } }).error?.code;
      } catch {
        code = undefined;
      }
      return { ok: false, message: exportFailure(res.status, code) };
    }
    const filename = filenameFrom(res.headers.get("content-disposition"), /format=jsonl/.test(path) ? "peakhour-conversations.jsonl" : "peakhour-conversations.txt");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // after the click has started the download (Safari reads the URL late)
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true, filename };
  } catch {
    return { ok: false, message: exportFailure(500) };
  }
}

/**
 * `placeholderData` for the conversations list: the previous rows stay on screen while the OTHER filter loads, but never
 * across a business switch (the key is `["wa-conversations", business, mode]`), or business A's conversations and expiry
 * banner would show under business B.
 */
export function keepWithinBusiness<T>(prev: T | undefined, prevKey: readonly unknown[] | undefined, businessId: string): T | undefined {
  return prevKey?.[1] === businessId ? prev : undefined;
}
