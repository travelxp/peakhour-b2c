import { api } from "@/lib/api";
import type { ReviewPayload } from "@/lib/review-reply";

/**
 * Unified Inbox client (D-inbox) — the owner-facing /v1/support/inbox
 * surface over `sup_inbox`: ONE queue for everything inbound, every
 * channel an adapter. First lane shipped here: LinkedIn lead-gen leads
 * (G2 — source linkedin, kind lead, priority from the qualifier score,
 * SLA clock on). Second: Google reviews, which are the only lane whose
 * reply leaves Peakhour for a page the merchant's customers read (S0·4).
 */

export type InboxKind =
  | "integration_fit_dispute"
  | "message"
  | "mention"
  | "question"
  | "complaint"
  | "review"
  | "lead"
  | "other";

export type InboxStatus =
  | "queued"
  | "in_review"
  | "waiting_on_customer"
  | "resolved"
  | "closed";

export type InboxPriority = "low" | "normal" | "high" | "urgent";

export interface InboxLeadPayload {
  externalLeadId: string;
  campaignId?: string;
  campaignName?: string;
  formId?: string;
  formName?: string;
  /** Form answers, label → answer. */
  fields?: Record<string, string>;
  qualified?: boolean;
  score?: number;
  fitReasons?: string[];
  riskFlags?: string[];
  suggestedNextStep?: string;
  outcomeBilled?: boolean;
}

export interface InboxItem {
  _id: string;
  source: string;
  kind: InboxKind;
  category?: string;
  priority: InboxPriority;
  contact?: { name?: string; email?: string; handle?: string };
  subject?: string;
  body?: string;
  lead?: InboxLeadPayload;
  /**
   * `sup_inbox.review` — the star rating, the network reference a reply is
   * published against, and what we have already published.
   *
   * ⚠️`review.replyDraft` IS AN AI SUGGESTION, NOT A SENT REPLY. Nothing may
   * default a send body to it; see `lib/review-reply.ts`.
   */
  review?: ReviewPayload;
  sla?: {
    firstResponseDueAt?: string;
    resolveDueAt?: string;
    firstRespondedAt?: string;
    breached?: boolean;
  };
  status: InboxStatus;
  createdAt: string;
}

/**
 * The api's answer to a review reply.
 *
 * ★★★THREE SHAPES, AND TWO OF THEM ARE SUCCESSES THAT LOOK LIKE FAILURES:
 *
 *   { sent: true,  recorded: true  } — on the listing, and filed.
 *   { sent: true,  recorded: false } — ON THE LISTING, and we could not file
 *       it. The customer can see the reply. Rendering this as a failure makes
 *       the merchant send it twice.
 *   { sent: false, reason: "unchanged" } — nothing to send; the words match
 *       what we last published. `force: true` overrides, which is the only way
 *       back from a reply deleted in Google's own console.
 *
 * `lib/review-reply.ts`'s `replyOutcome` is where that is decided; this type
 * only refuses to pretend the fields are not optional.
 */
export interface InboxReplyResult {
  _id: string;
  sent: boolean;
  recorded?: boolean;
  replyPublishedAt?: string;
  reason?: string;
}

export const inboxApi = {
  list: (params: { kind?: InboxKind; source?: string; status?: InboxStatus; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.kind) qs.set("kind", params.kind);
    if (params.source) qs.set("source", params.source);
    if (params.status) qs.set("status", params.status);
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
    return api.get<{ items: InboxItem[] }>(`/v1/support/inbox${suffix}`);
  },

  /** Owner action on their own item. The first transition out of
   *  `queued` stamps the SLA's first-response time api-side. */
  setStatus: (id: string, status: "in_review" | "resolved" | "closed", note?: string) =>
    api.patch<{ _id: string; status: InboxStatus }>(`/v1/support/inbox/${id}`, {
      status,
      ...(note ? { note } : {}),
    }),

  /**
   * Publish a reply back to the customer's review on the merchant's listing.
   *
   * ★EDITOR OR ABOVE, api-side. A viewer gets a 403 — which is correct, and why
   * the composer is not the place to discover it.
   *
   * ⚠️`comment` IS ALWAYS THE TEXT A PERSON PRESSED SEND ON. Never pass
   * `review.replyDraft` on a caller's behalf: the api deliberately never reads
   * the draft, and routing it through this argument would defeat that from the
   * client side.
   */
  reply: (id: string, comment: string, force?: boolean) =>
    api.post<InboxReplyResult>(`/v1/support/inbox/${id}/reply`, {
      comment,
      ...(force ? { force: true } : {}),
    }),
};
