import { api } from "@/lib/api";
import { presenceQuery } from "@/lib/api/presence";
import type { ChangeView, ListingScoreResponse } from "@/lib/presence-score";

/**
 * `/v1/presence/score` and the change routes a prepared fix goes through (PE-10).
 *
 * Preparing a fix only PROPOSES it. Nothing is sent until a person approves the card, and the api sets the source from the signed-in user.
 */
export const presenceScoreApi = {
  score: (location?: string) => api.get<ListingScoreResponse>(`/v1/presence/score${presenceQuery({ location })}`),

  /** Propose one change. The api checks it at once, so the card that comes back carries the network's answer. */
  propose: (body: { listingId: string; network: string; changes: Array<{ field: string; value: unknown }> }) =>
    api.post<{ items: ChangeView[]; notChecked: Array<{ id: string; code: string; message: string }> }>("/v1/presence/changes", body),

  approve: (id: string) => api.post<{ item: ChangeView }>(`/v1/presence/changes/${id}/approve`, {}),

  reject: (id: string) => api.post<{ item: ChangeView }>(`/v1/presence/changes/${id}/reject`, {}),
};
