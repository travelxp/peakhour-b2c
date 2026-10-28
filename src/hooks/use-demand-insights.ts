"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { DemandInsights } from "@/lib/demand-insights";

/**
 * What shoppers asked the assistant for that the store could not supply
 * (GET /v1/demand-insights). The api scopes the read to the session's pinned org
 * AND business and that business's own Shopify store; nothing here names either.
 */
export function useDemandInsights() {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<DemandInsights>({
    queryKey: ["demand-insights", org?._id ?? null, business?._id ?? null],
    queryFn: () => api.get("/v1/demand-insights"),
    enabled: isAuthenticated && !!org?._id,
    retry: false,
  });
}
