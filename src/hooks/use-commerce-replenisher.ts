"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * Commerce Replenisher hooks (P2.2/P2.3). `useReplenisher` reads the free
 * per-location restock plan (GET /v1/commerce/replenisher); `useReplenisherBrief`
 * runs the paid AI restock brief (POST /v1/commerce/replenisher/brief,
 * Peaks-metered); `useProposeRestock` records a restock intent as a proposed
 * cmrc_actions row (POST /v1/commerce/replenisher/propose).
 */

export interface RestockCandidate {
  productId: string | null;
  sourceProductId: string;
  title: string;
  locationId: string | null;
  locationName: string | null;
  currentStock: number;
  locationStock: number | null;
  unitsSold: number;
  dailyVelocity: number;
  daysOfCover: number | null;
  recommendedRestockQty: number;
  lostSalesAvoidedMinor: number | null;
  currency: string | null;
  reason: string;
}

export interface RestockLocation {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
}

export interface RestockPlan {
  windowDays: number;
  targetCoverDays: number;
  leadTimeDays: number;
  scanned: boolean;
  truncated: boolean;
  locations: RestockLocation[];
  candidates: RestockCandidate[];
  totalLostSalesAvoidedMinor: number;
  currency: string | null;
}

const REPLENISHER_KEY = "commerce-replenisher";
const ACTIVITY_KEY = "commerce-activity";

export function useReplenisher() {
  const { isAuthenticated, org } = useAuth();
  return useQuery<RestockPlan>({
    queryKey: [REPLENISHER_KEY, org?._id ?? null],
    queryFn: () => api.get<RestockPlan>("/v1/commerce/replenisher"),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 5 * 60_000,
    // A missing store / unsynced catalog returns 4xx — don't hammer it.
    retry: false,
  });
}

export interface ReplenisherBrief {
  plan: RestockPlan;
  brief: string;
}

export function useReplenisherBrief() {
  return useMutation<ReplenisherBrief, Error>({
    mutationFn: () => api.post<ReplenisherBrief>("/v1/commerce/replenisher/brief", {}),
  });
}

export interface ProposeRestockResult {
  actionId: string | null;
  candidate: RestockCandidate;
}

export function useProposeRestock() {
  const qc = useQueryClient();
  const { org } = useAuth();
  return useMutation<ProposeRestockResult, Error, string>({
    mutationFn: (sourceProductId: string) =>
      api.post<ProposeRestockResult>("/v1/commerce/replenisher/propose", { sourceProductId }),
    onSettled: () => {
      // The proposal shows up in the "engine did this" digest.
      qc.invalidateQueries({ queryKey: [ACTIVITY_KEY, org?._id ?? null] });
    },
  });
}
