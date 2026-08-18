"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
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
  const { business } = useAuth();
  return useQuery<AudienceSetsResponse>({
    // The filters are part of the key: a cache shared across filters would
    // show the previous filter's rows under the new filter's heading, which is
    // a list that lies about what it is showing.
    // ★AND SO IS THE BUSINESS, which every other business-scoped hook in this
    // directory pins. `switchBusiness` clears the whole cache today, so this is
    // belt on top of braces — but the route is business-scoped server-side, and
    // a key that does not say which business is one `clear()` away from
    // rendering another one's audiences.
    queryKey: ["audience-sets", business?._id ?? "none", query],
    queryFn: () => audienceLibraryApi.listSets(query),
    // ★THE PREVIOUS PAGE STAYS ON SCREEN WHILE THE NEXT LOADS. Without it
    // every filter keystroke and every page turn replaces the list with
    // skeletons, because a new key is `isPending` — so a customer refining a
    // search watches their library disappear and come back on each character.
    placeholderData: keepPreviousData,
  });
}
