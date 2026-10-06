"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/** Shape of `/v1/dashboard/org` as relevant to plan/trial surfaces.
 *  Other fields (taxonomy, integrations, business meta) are returned by
 *  the endpoint but consumers of this hook only need plan/trial state. */
export interface DashboardOrgPlanSummary {
  name?: string;
  subscription?: {
    plan?: string;
    /** Customer-facing plan name from cfg_plans. ALWAYS prefer this for display —
     *  `plan` is a machine tier key, and rendering it is what once showed
     *  customers "Commerce_assistant.Free" as their plan name. Read through
     *  `lib/plan-status`, which also reads a stored `free` / `.free` key
     *  (until P4.5) as no plan. */
    planName?: string;
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
  /** Bought lines beyond the base row — the active/trial subscriptions (Suite,
   *  Agency). Empty for a business on its Suite trial or with no plan. */
  products?: Array<{
    productKey?: string | null;
    tier: string;
    tierVersion?: number | null;
    state: string;
    name: string;
    since?: string | null;
    /** Next charge for this product. Every product on a consolidated subscription
     *  shares one date — that shared date is what lets the page say they are
     *  billed together. Null until a gateway event has established it. */
    renewsAt?: string | null;
    /** When a scheduled cancel or plan change ends the line (D21); it then
     *  renews never, and `renewsAt` is null. */
    endsAt?: string | null;
    /** Set only on a pending-attach trial (a product added to an existing
     *  subscription): the date it starts billing. A gateway-native trial carries
     *  none, so absence does NOT mean "not trialing". */
    trialEndsAt?: string | null;
  }>;
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
  // Tight error generic: api.post() throws ApiError with a `code` field
  // mirroring the server's error taxonomy
  // (EXTENSION_ALREADY_USED / NOT_TRIALING / EXTENSION_RACE / generic).
  // Consumers map by `err.code` without unsafe casts.
  return useMutation<TrialExtendResponse, ApiError>({
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
