"use client";

import { useQuery } from "@tanstack/react-query";
import { presenceApi } from "@/lib/api/presence";
import { presenceListingQueryKey } from "@/lib/presence-panels";

/**
 * One request answers both the Listing and Insights panels (same key and
 * options). `location` is the Presence page's choice among the listings one
 * connection manages, and `network` its choice among the networks the business
 * is on - page choices, never a session pin. Undefined asks for the api's default
 * (the oldest connection, its first listing).
 */
export function useListingQuery(location?: string, network?: string) {
  return useQuery({
    queryKey: presenceListingQueryKey(location, network),
    queryFn: () => presenceApi.listing(location, network),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
