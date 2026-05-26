"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AttentionAlert {
  id: string;
  kind: "webhook_health" | "scheduled_items_blocked";
  severity: "red" | "yellow";
  title: string;
  description: string;
  actionUrl: string;
  actionLabel: string;
  noticedAt?: string;
  count?: number;
}

export interface AttentionResponse {
  alerts: AttentionAlert[];
  totalCount: number;
}

export const attentionKeys = {
  all: ["attention"] as const,
};

/**
 * Polls the per-business attention list. 60s cadence — the underlying
 * sources update on cron cadence (hourly webhookHealth, per-publish-tick
 * scheduled items), so faster polling wastes API budget for no signal.
 *
 * Distinct from useJobs() — that hook tracks SYSTEM work in progress;
 * this one tracks USER actions that resolve when the underlying state
 * recovers (no manual dismiss).
 */
export function useAttention() {
  return useQuery<AttentionResponse>({
    queryKey: attentionKeys.all,
    queryFn: async () => {
      return api.get<AttentionResponse>("/v1/attention");
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/**
 * Convenience selector for the bell badge — distinct hook so the
 * badge doesn't re-render the full alert list on every poll.
 */
export function useAttentionCount(): number {
  const { data } = useAttention();
  return data?.totalCount ?? 0;
}
