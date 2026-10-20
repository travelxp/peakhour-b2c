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
    /** The org's base row's tier key, or null when there is no live base row
     *  (none, or a Suite trial that has ended; api#1510). */
    plan?: string | null;
    /** Customer-facing plan name from cfg_plans. ALWAYS prefer this for display —
     *  `plan` is a machine tier key, and rendering it is what once showed
     *  customers "Commerce_assistant.Free" as their plan name. Read through
     *  `lib/plan-status`, which also reads a stored `free` / `.free` key
     *  (until P4.5) as no plan. Null exactly when `plan` is. */
    planName?: string | null;
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
   *  Agency) of the SIGNED-IN BUSINESS (api#1510): its own rows, plus unstamped
   *  legacy rows. Empty for a business on its Suite trial or with no plan. */
  products?: Array<{
    productKey?: string | null;
    /** The business holding the line, or null for an unstamped legacy row,
     *  which every business of the org lists until its owner is known. */
    businessId: string | null;
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
export const DASHBOARD_ORG_KEY = "/v1/dashboard/org";

/**
 * The cache key of one business's `/v1/dashboard/org`. ★BY BUSINESS, not only
 * by org (P4.3b): the response's lines are the signed-in business's
 * (api#1510), so keyed by org alone, a switch to a sibling business in the
 * same org served the previous business's lines from cache.
 */
export function dashboardOrgKey(orgId: string | null | undefined, businessId: string | null | undefined) {
  return [DASHBOARD_ORG_KEY, orgId ?? null, businessId ?? null] as const;
}

/**
 * Read `/v1/dashboard/org` via react-query so the PlanBadge, the
 * trial-expiry banner, and the billing page share one network round-trip
 * + one cache entry per business (`dashboardOrgKey`).
 *
 * `enabled` guards prevent the fetch from firing before /me resolves
 * — the auth context's business is the gate for "we know which business
 * to fetch for" (the endpoint answers for the signed-in business).
 */
export function useDashboardOrg() {
  const { org, business, isAuthenticated } = useAuth();
  return useQuery<DashboardOrgPlanSummary>({
    queryKey: dashboardOrgKey(org?._id, business?._id),
    queryFn: () => api.get<DashboardOrgPlanSummary>("/v1/dashboard/org"),
    enabled: isAuthenticated && !!org?._id && !!business?._id,
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
