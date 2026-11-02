"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { businessHoldPath, HOLDS_PATH, placeBody, threadHoldPath, type HoldsListing } from "@/lib/legal-hold";

/** The business's legal holds (owner/admin only: the api refuses everyone else, so the query is only enabled for them). */
export function useLegalHolds(enabled: boolean) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["legal-holds", business?._id ?? "none"],
    queryFn: () => api.get<HoldsListing>(HOLDS_PATH),
    enabled: enabled && Boolean(business?._id),
    staleTime: 30_000,
  });
}

/** Re-read everything a hold changes: the holds list, the conversation list and the open thread. */
function useRefreshAfterHold() {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return (threadId?: string) => {
    qc.invalidateQueries({ queryKey: ["legal-holds", biz] });
    qc.invalidateQueries({ queryKey: ["wa-conversations", biz] });
    // A business-wide hold changes EVERY thread, so every cached thread is re-read, not just the open one.
    qc.invalidateQueries({ queryKey: threadId ? ["wa-thread", biz, threadId] : ["wa-thread", biz] });
  };
}

/** Place or lift the hold on ONE conversation. */
export function useThreadHold() {
  const refresh = useRefreshAfterHold();
  return useMutation({
    mutationFn: ({ threadId, action, reason }: { threadId: string; action: "place" | "lift"; reason?: string }) =>
      api.post(threadHoldPath(threadId, action), action === "place" ? placeBody(reason ?? "") : reason ? { reason: reason.trim() } : {}),
    // ★SETTLED, not only success: a refusal ("already lifted", "held by the business") means the screen is stale.
    onSettled: (_r, _e, { threadId }) => refresh(threadId),
  });
}

/** Place or lift the business-wide hold. */
export function useBusinessHold() {
  const refresh = useRefreshAfterHold();
  return useMutation({
    mutationFn: ({ action, reason }: { action: "place" | "lift"; reason?: string }) =>
      api.post(businessHoldPath(action), action === "place" ? placeBody(reason ?? "") : reason ? { reason: reason.trim() } : {}),
    onSettled: () => refresh(),
  });
}
