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

export interface GraduationInvite {
  nextLevel: AutonomyLevel;
}

export interface AutonomyEntry {
  agent: string;
  channel: string;
  level: AutonomyLevel;
  guardrails: AutonomyGuardrails | null;
  confidence: AutonomyConfidence | null;
  /** Set when the agent has EARNED a graduation to a higher level. */
  graduation: GraduationInvite | null;
}

export interface AutonomyBoard {
  channel: string;
  agents: AutonomyEntry[];
  /** Global execution halt — when true no agent can ship (proposals still work). */
  killSwitch: boolean;
}

export const AUTONOMY_KEY = "commerce-autonomy";

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

/** Toggle the global execution kill switch (PUT /v1/commerce/settings). */
export function useSetKillSwitch() {
  const qc = useQueryClient();
  const { org } = useAuth();
  const key = [AUTONOMY_KEY, org?._id ?? null];
  return useMutation<{ killSwitch: boolean }, Error, boolean>({
    mutationFn: (killSwitch: boolean) =>
      api.put<{ killSwitch: boolean }>("/v1/commerce/settings", { killSwitch }),
    onMutate: async (killSwitch) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AutonomyBoard>(key);
      if (prev) qc.setQueryData<AutonomyBoard>(key, { ...prev, killSwitch });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if ((ctx as { prev?: AutonomyBoard })?.prev) qc.setQueryData(key, (ctx as { prev: AutonomyBoard }).prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** Dismiss an agent's graduation invite (POST /v1/commerce/graduation/dismiss). */
export function useDismissGraduation() {
  const qc = useQueryClient();
  const { org } = useAuth();
  const key = [AUTONOMY_KEY, org?._id ?? null];
  return useMutation<unknown, Error, { agent: string; channel: string }>({
    mutationFn: ({ agent, channel }) =>
      api.post("/v1/commerce/graduation/dismiss", { agent, channel }),
    // Optimistically clear the invite so it disappears immediately.
    onMutate: async ({ agent }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AutonomyBoard>(key);
      if (prev) {
        qc.setQueryData<AutonomyBoard>(key, {
          ...prev,
          agents: prev.agents.map((a) => (a.agent === agent ? { ...a, graduation: null } : a)),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if ((ctx as { prev?: AutonomyBoard })?.prev) qc.setQueryData(key, (ctx as { prev: AutonomyBoard }).prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
