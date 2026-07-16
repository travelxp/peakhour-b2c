"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * Commerce "engine did this" activity — recent agent actions from the ledger
 * (GET /v1/commerce/activity, api#839). Backs the Command Center digest.
 */

export interface ActivityItem {
  id: string;
  agent: string;
  title: string;
  status: string;
  sourceType: string | null;
  prediction: {
    metric: string;
    value?: number;
    valueMinor?: number;
    currency?: string;
    confidence?: number;
  } | null;
  /** ISO timestamp of the decision/creation. */
  at: string;
}

interface ActivityResponse {
  items: ActivityItem[];
}

const ACTIVITY_KEY = "commerce-activity";

export function useCommerceActivity(limit = 8) {
  const { isAuthenticated, org } = useAuth();
  return useQuery<ActivityResponse>({
    queryKey: [ACTIVITY_KEY, org?._id ?? null, limit],
    queryFn: () => api.get<ActivityResponse>(`/v1/commerce/activity?limit=${limit}`),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 60_000,
    retry: false,
  });
}
