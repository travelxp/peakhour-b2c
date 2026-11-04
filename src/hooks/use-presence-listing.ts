"use client";

import { useQuery } from "@tanstack/react-query";
import { presenceApi } from "@/lib/api/presence";
import { presenceListingQueryKey } from "@/lib/presence-panels";

/**
 * One request answers both the Listing and Insights panels (same key and
 * options). `location` is the Presence page's choice among the listings one
 * Google connection manages - a page choice, never a session pin. Undefined asks
 * for the api's default (the first listing).
 */
export function useListingQuery(location?: string) {
  return useQuery({
    queryKey: presenceListingQueryKey(location),
    queryFn: () => presenceApi.listing(location),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
