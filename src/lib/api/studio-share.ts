import { API_BASE_URL } from "@/lib/api";

/**
 * Approval by link, the visitor's side (UX spec S18). PUBLIC: the person has no Peakhour account, so these calls carry no cookie and no CSRF
 * token and do not use the signed-in `api` client (which demands the `{ ok }` envelope and refreshes a session). The token in the address is the
 * only credential: the api opens ONE preview's 768 px picture and the business's name with it, never anything else of theirs.
 *
 * An address that is unknown, revoked or past its seven days is one answer (410 "stopped"), so nothing can be learned from the difference.
 */

export interface ApprovalPicture {
  business: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
  /** Set when this link was already answered. */
  answered: "approved" | "rejected" | null;
  expiresAt: string;
}

export type ApprovalPageState =
  | { kind: "ready"; picture: ApprovalPicture }
  /** Unknown, revoked, expired or the picture changed since: one answer. `business` is there when the api gave it. */
  | { kind: "stopped"; business?: string }
  | { kind: "error" };

export type ApprovalAnswerResult =
  | { kind: "thanks"; message: string }
  | { kind: "already" }
  | { kind: "stopped"; business?: string }
  | { kind: "busy"; message: string }
  | { kind: "error" };

const path = (token: string) => `${API_BASE_URL}/v1/creative/share/${encodeURIComponent(token)}`;

interface Envelope {
  success?: boolean;
  data?: Record<string, unknown>;
  error?: { code?: string; message?: string };
}

/** "…Ask {business} for a new one." The api words it; the name is read back from it so the page can say whose picture it was. */
const businessFrom = (message: unknown): string | undefined => {
  const m = typeof message === "string" ? /^This link has stopped working\. Ask (.+) for a new one\.$/.exec(message) : null;
  return m?.[1] && m[1] !== "the business" ? m[1] : undefined;
};

const text = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const size = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** Look at the link. Opening it records nothing but the fact it was read; the answer is a separate press. */
export async function fetchApproval(token: string, doFetch: typeof fetch = fetch): Promise<ApprovalPageState> {
  try {
    const res = await doFetch(path(token), { credentials: "omit", redirect: "error", headers: { Accept: "application/json" } });
    const body = (await res.json().catch(() => null)) as Envelope | null;
    if (res.status === 404 || res.status === 410) return { kind: "stopped", business: businessFrom(body?.error?.message) };
    const d = body?.data;
    const business = text(d?.business);
    const imageUrl = text(d?.imageUrl);
    if (!res.ok || body?.success !== true || !d || !business || !imageUrl) return { kind: "error" };
    const answered = d.answered === "approved" || d.answered === "rejected" ? d.answered : null;
    return { kind: "ready", picture: { business, imageUrl, width: size(d.width), height: size(d.height), answered, expiresAt: text(d.expiresAt) ?? "" } };
  } catch {
    return { kind: "error" };
  }
}

/** Send the answer: "approved" counts as the heart (U1), "rejected" leaves the picture as it is. One answer per link. */
export async function answerApproval(
  token: string,
  body: { answer: "approved" | "rejected"; name: string; comment?: string },
  doFetch: typeof fetch = fetch,
): Promise<ApprovalAnswerResult> {
  try {
    const res = await doFetch(path(token), {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ answer: body.answer, name: body.name.trim(), ...(body.comment?.trim() ? { comment: body.comment.trim() } : {}) }),
    });
    const env = (await res.json().catch(() => null)) as Envelope | null;
    if (res.ok && env?.success === true) return { kind: "thanks", message: text(env.data?.message) ?? "" };
    if (res.status === 410) return { kind: "stopped", business: businessFrom(env?.error?.message) };
    if (res.status === 409 && env?.error?.code === "ALREADY_ANSWERED") return { kind: "already" };
    if (res.status === 409 && env?.error?.code === "LINK_BUSY") return { kind: "busy", message: text(env.error.message) ?? "" };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
