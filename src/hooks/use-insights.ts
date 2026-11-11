"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { INSIGHTS_KEY, insightsQuery } from "@/lib/nav-queries";
export { INSIGHTS_KEY };
import { useAuth } from "@/providers/auth-provider";

/**
 * What customers are telling the assistant (GET /v1/insights). The api scopes the read to the session's pinned org AND business; nothing
 * here names either. The whole window is read once and the chips filter it, so each chip's count is known without a request per chip.
 */
export function useInsights(days = 30) {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery({
    ...insightsQuery(org?._id ?? null, business?._id ?? null, days),
    // the api scope is org AND business: until both are pinned a read could only answer for nothing
    enabled: isAuthenticated && !!org?._id && !!business?._id,
  });
}

/** Dismiss an item (it returns only when its count at least doubles) or bring a dismissed one back. */
export function useInsightDismissal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, restore }: { key: string; restore?: boolean }) => api.post(`/v1/insights/${encodeURIComponent(key)}/${restore ? "restore" : "dismiss"}`),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [INSIGHTS_KEY] });
    },
  });
}
