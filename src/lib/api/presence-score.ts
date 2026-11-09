import { api } from "@/lib/api";
import { presenceQuery } from "@/lib/api/presence";
import type { ListingScoreResponse } from "@/lib/presence-score";

/**
 * `/v1/presence/score` (PE-10). The change calls a prepared fix makes are `presenceChangesApi`'s.
 */
export const presenceScoreApi = {
  score: (location?: string, network?: string) => api.get<ListingScoreResponse>(`/v1/presence/score${presenceQuery({ location, network })}`),
};
