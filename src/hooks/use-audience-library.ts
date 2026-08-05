"use client";

import { useQuery } from "@tanstack/react-query";
import {
  audienceLibraryApi,
  type AudienceSetsQuery,
  type AudienceSetsResponse,
} from "@/lib/api/audiences";

/**
 * The audience library (G1).
 *
 * ★THE FIRST READER `biz_audience_sets` HAS EVER HAD FROM A SCREEN. The engine
 * has been planning portfolios, importing the audiences a business actually
 * ran, scoring them and resolving them per channel since B2 — every row of it
 * API-only. "Built" means a caller can reach it.
 */
export function useAudienceSets(query: AudienceSetsQuery = {}) {
  return useQuery<AudienceSetsResponse>({
    // The filters are part of the key: a cache shared across filters would
    // show the previous filter's rows under the new filter's heading, which is
    // a list that lies about what it is showing.
    queryKey: ["audience-sets", query],
    queryFn: () => audienceLibraryApi.listSets(query),
    // A library is a durable object, not a feed — it changes when somebody
    // plans, imports or discards, all of which happen on this surface and
    // invalidate it directly.
    staleTime: 30_000,
  });
}

/** Every query this feature owns, for a caller that has just changed one. */
export const AUDIENCE_LIBRARY_KEY = ["audience-sets"] as const;
