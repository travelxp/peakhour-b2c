"use client";

import { useQuery } from "@tanstack/react-query";
import { presenceApi } from "@/lib/api/presence";
import { PRESENCE_LISTING_QUERY_KEY } from "@/lib/presence-panels";

/** One request answers both the Listing and Insights panels (same key and options). */
export function useListingQuery() {
  return useQuery({
    queryKey: PRESENCE_LISTING_QUERY_KEY,
    queryFn: () => presenceApi.listing(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
