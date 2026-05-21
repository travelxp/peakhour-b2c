"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/** Shape of `/v1/dashboard/org` as relevant to plan/trial surfaces.
 *  Other fields (taxonomy, integrations, business meta) are returned by
 *  the endpoint but consumers of this hook only need plan/trial state. */
export interface DashboardOrgPlanSummary {
  name?: string;
  subscription?: {
    plan?: string;
    planVersion?: number;
    trialEndsAt?: string | null;
    trialActive?: boolean;
    trialDaysRemaining?: number;
    selfServeExtensionUsed?: boolean;
  };
  entitlements?: {
    plan?: string;
    planVersion?: number;
    computedAt?: string | null;
    features?: string[];
  } | null;
  billing?: { plan?: string };
  createdAt?: string;
}

export interface TrialExtendResponse {
  trialEndsAt: string;
  addedDays: number;
}

/** Shared cache key — every consumer of /v1/dashboard/org reads through
 *  this so a single fetch (and the extend mutation's invalidation)
 *  refreshes the badge, the banner, and the billing page atomically. */
const DASHBOARD_ORG_KEY = "/v1/dashboard/org";

/**
 * Read `/v1/dashboard/org` via react-query so the PlanBadge, the
 * trial-expiry banner, and the billing page share one network round-trip
 * + one cache entry. Refetched on org-id change (agency operators
 * flipping between client orgs see each one's plan).
 *
 * `enabled` guards prevent the fetch from firing before /me resolves
 * — the auth context's org is the gate for "we know which org to fetch
 * for."
 */
export function useDashboardOrg() {
  const { org, isAuthenticated } = useAuth();
  return useQuery<DashboardOrgPlanSummary>({
    queryKey: [DASHBOARD_ORG_KEY, org?._id ?? null],
    queryFn: () => api.get<DashboardOrgPlanSummary>("/v1/dashboard/org"),
    enabled: isAuthenticated && !!org?._id,
    // 60s staleTime — plan/trial state changes infrequently. Banner +
    // badge re-render against the cached value; the extend mutation
    // invalidates the cache to force a fresh fetch immediately after
    // the grant lands.
    staleTime: 60_000,
  });
}

/**
 * Self-serve trial extension. POST /v1/dashboard/trial/extend.
 * Invalidates the dashboard/org cache on success so the badge, banner,
 * and billing page all re-render with the new trialEndsAt +
 * selfServeExtensionUsed flag.
 */
export function useExtendTrial() {
  const queryClient = useQueryClient();
  return useMutation<TrialExtendResponse, Error>({
    mutationFn: () => api.post<TrialExtendResponse>("/v1/dashboard/trial/extend", {}),
    onSuccess: () => {
      // Drop every cached dashboard/org regardless of org-id suffix —
      // an agency operator with multiple orgs in cache shouldn't keep
      // stale state for the org they just extended. The key is shared
      // by prefix; predicate matches that.
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === DASHBOARD_ORG_KEY,
      });
    },
  });
}
