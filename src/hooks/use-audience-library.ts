"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
    // ★THE PREVIOUS PAGE STAYS ON SCREEN WHILE THE NEXT LOADS. Without it
    // every filter keystroke and every page turn replaces the list with
    // skeletons, because a new key is `isPending` — so a customer refining a
    // search watches their library disappear and come back on each character.
    placeholderData: keepPreviousData,
  });
}
