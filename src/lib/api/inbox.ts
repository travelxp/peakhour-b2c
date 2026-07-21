import { api } from "@/lib/api";

/**
 * Unified Inbox client (D-inbox) — the owner-facing /v1/support/inbox
 * surface over `sup_inbox`: ONE queue for everything inbound, every
 * channel an adapter. First lane shipped here: LinkedIn lead-gen leads
 * (G2 — source linkedin, kind lead, priority from the qualifier score,
 * SLA clock on).
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
  sla?: {
    firstResponseDueAt?: string;
    resolveDueAt?: string;
    firstRespondedAt?: string;
    breached?: boolean;
  };
  status: InboxStatus;
  createdAt: string;
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
};
