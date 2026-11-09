import { api } from "@/lib/api";

/**
 * `/v1/presence/changes/*`: the listing change engine (PE-06). Ask Peakhour's card (PE-09) reads one change and presses Approve or Discard
 * through it, the same two calls the edit forms use. The assistant itself can only PREPARE a change; a person's press here is the approval.
 */

/** One change, as the api's view of the stored row. */
export interface ListingChangeView {
  id: string;
  status: string;
  field: string;
  riskTier: string;
  notes: string[];
  reason: { code: string; message: string } | null;
  /** Set when the change is approved but the network is switched off for now. */
  held: { reason: string } | null;
  expiresAt: string;
  submittedAt: string | null;
  liveAt: string | null;
  liveCheck: { outcome: string; note: string | null } | null;
  /** The before and after of the change, and the checks it failed. Present on every view the api returns (PE-10 draws a card from them). */
  before?: unknown;
  after?: unknown;
  validation?: { issues: Array<{ code: string; message: string }> } | null;
}

export const presenceChangesApi = {
  /** Propose changes. This only PREPARES them; the api sets the source from the signed-in user and checks each at once. */
  propose: (body: { listingId: string; network: string; changes: Array<{ field: string; value: unknown }> }) =>
    api.post<{ items: ListingChangeView[]; notChecked: Array<{ id: string; code: string; message: string }> }>("/v1/presence/changes", body),

  get: (id: string) => api.get<{ item: ListingChangeView }>(`/v1/presence/changes/${id}`),
  /** A person approves. The api checks the change first, then queues the write: one press is enough. */
  approve: (id: string) => api.post<{ item: ListingChangeView }>(`/v1/presence/changes/${id}/approve`, {}),
  reject: (id: string) => api.post<{ item: ListingChangeView }>(`/v1/presence/changes/${id}/reject`, {}),
};
