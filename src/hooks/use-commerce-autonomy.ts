"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * Commerce consent dial (GET/PUT /v1/commerce/autonomy, api#834). The board is
 * the full agent roster for the connected store's channel; setting a level is
 * optimistic (the dial moves immediately, rolls back on error).
 */

export type AutonomyLevel = "observe" | "recommend" | "approve" | "autonomous";

export interface AutonomyGuardrails {
  maxDiscountPct?: number;
  maxSpendMinor?: number;
  maxActionsPerDay?: number;
  reversibilityWindowHours?: number;
  businessHoursOnly?: boolean;
}

export interface AutonomyConfidence {
  score: number;
  sampleSize: number;
  updatedAt: string;
}

export interface AutonomyEntry {
  agent: string;
  channel: string;
  level: AutonomyLevel;
  guardrails: AutonomyGuardrails | null;
  confidence: AutonomyConfidence | null;
}

export interface AutonomyBoard {
  channel: string;
  agents: AutonomyEntry[];
}

const AUTONOMY_KEY = "commerce-autonomy";

export function useCommerceAutonomy() {
  const { isAuthenticated, org } = useAuth();
  return useQuery<AutonomyBoard>({
    queryKey: [AUTONOMY_KEY, org?._id ?? null],
    queryFn: () => api.get<AutonomyBoard>("/v1/commerce/autonomy"),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 60_000,
    retry: false,
  });
}

export function useSetAutonomy() {
  const qc = useQueryClient();
  const { org } = useAuth();
  const key = [AUTONOMY_KEY, org?._id ?? null];

  return useMutation({
    mutationFn: ({
      agent,
      channel,
      level,
    }: {
      agent: string;
      channel: string;
      level: AutonomyLevel;
    }) => api.put<AutonomyEntry>("/v1/commerce/autonomy", { agent, channel, level }),
    // Optimistically move the dial for this agent.
    onMutate: async ({ agent, level }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AutonomyBoard>(key);
      if (prev) {
        qc.setQueryData<AutonomyBoard>(key, {
          ...prev,
          agents: prev.agents.map((a) => (a.agent === agent ? { ...a, level } : a)),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}
