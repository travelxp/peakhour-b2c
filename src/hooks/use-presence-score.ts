"use client";

import { useQuery } from "@tanstack/react-query";
import { presenceScoreApi } from "@/lib/api/presence-score";
import { presenceScoreQueryKey } from "@/lib/presence-score";

/** The listing score for the listing the Presence page is showing. Keyed by listing, so switching never shows another's score from cache. */
export function useListingScore(location?: string, network?: string) {
  return useQuery({
    queryKey: presenceScoreQueryKey(location, network),
    queryFn: () => presenceScoreApi.score(location, network),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
