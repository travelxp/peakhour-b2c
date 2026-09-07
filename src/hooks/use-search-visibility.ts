"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { VisibilityResult } from "@/lib/search-visibility";

/**
 * Per-product Google Search verdicts (GET /v1/commerce/search-visibility,
 * api#1251/#1253). Backs the Search visibility panel on Catalog & Listings.
 *
 * ★THE RESULT IS PASSED THROUGH WHOLE, STATE AND BLOCKERS INCLUDED. It is a
 * discriminated union so the panel can render "connect Search Console", "pick a
 * property", "no catalog", "still gathering" and "here is the answer" as five
 * different states with five different fixes; unwrapping it here would hand the
 * panel an empty list and no way to say which of the five it was looking at.
 *
 * ★AND `retry: false`, LIKE ITS SIBLING. This read costs a full catalog scan on
 * the api side, and none of its failure modes are transient in a way a retry
 * would fix — a missing connection stays missing.
 */

const KEY = "commerce-search-visibility";

/** Matches the api's DEFAULT_PRODUCT_LIMIT ceiling of 500. The panel shows the
 *  worklist head, not the whole catalogue — the api already orders by what is
 *  actionable first. */
export const VISIBILITY_LIMIT = 100;

export function useSearchVisibility(limit = VISIBILITY_LIMIT) {
  const { isAuthenticated, org } = useAuth();
  return useQuery<VisibilityResult>({
    queryKey: [KEY, org?._id ?? null, limit],
    queryFn: () =>
      api.get<VisibilityResult>(`/v1/commerce/search-visibility?limit=${limit}`),
    enabled: isAuthenticated && !!org?._id,
    // The underlying slice refreshes about once a day, so a five-minute window
    // is generous and still never serves a merchant a figure from last week's
    // session. Same figure the catalog read uses.
    staleTime: 5 * 60_000,
    retry: false,
  });
}
