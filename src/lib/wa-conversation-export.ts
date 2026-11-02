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

/** The query for one conversation. The thread id is URL-encoded: it is an opaque key and never shown. */
export function threadExportPath(threadId: string, format: ExportFormat = "txt"): string {
  return `${BASE}?threadId=${encodeURIComponent(threadId)}&format=${format}`;
}

/** The query for a date range; `null` when no first day is chosen (the API would refuse it too). */
export function rangeExportPath(from: string, to: string, format: ExportFormat = "txt"): string | null {
  const f = from.trim();
  if (!DAY.test(f)) return null;
  const t = to.trim();
  return `${BASE}?from=${encodeURIComponent(f)}${DAY.test(t) ? `&to=${encodeURIComponent(t)}` : ""}&format=${format}`;
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
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
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
    const res = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
    if (!res.ok) {
      let code: string | undefined;
      try {
        code = ((await res.json()) as { error?: { code?: string } }).error?.code;
      } catch {
        code = undefined;
      }
      return { ok: false, message: exportFailure(res.status, code) };
    }
    const filename = filenameFrom(res.headers.get("content-disposition"));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true, filename };
  } catch {
    return { ok: false, message: exportFailure(500) };
  }
}
