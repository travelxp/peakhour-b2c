"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { ACTIVITY_KEY } from "@/hooks/use-commerce-activity";
import { AUTONOMY_KEY } from "@/hooks/use-commerce-autonomy";

/**
 * Commerce pending-execution surface (GET /v1/commerce/actions + approve /
 * execute / revert, api A1.1). The b2c parity with the WordPress plugin's
 * Autopilot ship loop: proposals → approve → ship (execute for real or stage
 * advisory, per the capability matrix) → revert. Each row carries its RESOLVED
 * capability so the UI knows whether "Ship it" applies live or stages before the
 * click. Mutations invalidate the actions list, the activity digest, and the
 * autonomy board (confidence can move on execution).
 */

export type CapabilityMode = "execute" | "stage" | "advisory" | "unavailable";

export interface ActionablePrediction {
  metric: string;
  value?: number;
  valueMinor?: number;
  currency?: string;
  confidence?: number;
}

export interface ActionableItem {
  id: string;
  agent: string;
  title: string;
  status: string;
  sourceType: string | null;
  prediction: ActionablePrediction | null;
  at: string;
  channel: string | null;
  /** The resolved capability (execute vs stage + honest reason), or null for an
   *  agent that performs no store write. */
  capability: { mode: CapabilityMode; reason: string } | null;
}

export const ACTIONS_KEY = "commerce-actions";

/** The actions a merchant can act on — proposals to approve, approved to ship,
 *  shipped to revert. Newest first. */
export function useCommerceActions(
  statuses: string[] = ["proposed", "approved", "executed", "staged"],
) {
  const { isAuthenticated, org } = useAuth();
  const status = statuses.join(",");
  return useQuery<{ items: ActionableItem[] }>({
    queryKey: [ACTIONS_KEY, org?._id ?? null, status],
    queryFn: () => api.get<{ items: ActionableItem[] }>(
      `/v1/commerce/actions?status=${encodeURIComponent(status)}`,
    ),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 30_000,
    retry: false,
  });
}

function useInvalidateActions() {
  const qc = useQueryClient();
  const { org } = useAuth();
  return () => {
    const id = org?._id ?? null;
    qc.invalidateQueries({ queryKey: [ACTIONS_KEY, id] });
    qc.invalidateQueries({ queryKey: [ACTIVITY_KEY, id] });
    qc.invalidateQueries({ queryKey: [AUTONOMY_KEY, id] });
  };
}

/** Approve a proposed intent → approved (shippable). */
export function useApproveAction() {
  const invalidate = useInvalidateActions();
  return useMutation<{ status: string }, ApiError, string>({
    mutationFn: (id) => api.post<{ status: string }>(`/v1/commerce/actions/${id}/approve`, {}),
    onSuccess: () => toast.success("Approved — ready to ship"),
    onError: (e) => toast.error(e.message || "Couldn't approve this action"),
    onSettled: () => invalidate(),
  });
}

/** Ship an approved action — executes for real or stages advisory (per the
 *  capability matrix); the server returns the resulting ledger status. */
export function useExecuteAction() {
  const invalidate = useInvalidateActions();
  return useMutation<{ status: string }, ApiError, string>({
    mutationFn: (id) => api.post<{ status: string }>(`/v1/commerce/actions/${id}/execute`, {}),
    onSuccess: (res) => {
      if (res.status === "executed") toast.success("Shipped — applied to your store");
      else if (res.status === "staged")
        toast.success("Staged", {
          description: "Prepared as advisory — live apply isn't available on this channel yet.",
        });
      else if (res.status === "failed")
        toast.error("Couldn't apply on the store", {
          description: "Nothing was changed. Please try again shortly.",
        });
      else toast.success("Done");
    },
    onError: (e) => {
      if (e.code === "AUTONOMY_DISABLED")
        toast.error("Raise this agent to Approve (L2) before it can ship");
      else if (e.code === "KILL_SWITCH")
        toast.error("The kill switch is on — turn it off to ship actions");
      else if (e.code === "GUARDRAIL") toast.error("A guardrail blocked this action");
      else toast.error(e.message || "Couldn't ship this action");
    },
    onSettled: () => invalidate(),
  });
}

/** Undo an executed or staged action (clears the real store change first). */
export function useRevertAction() {
  const invalidate = useInvalidateActions();
  return useMutation<{ status: string }, ApiError, string>({
    mutationFn: (id) => api.post<{ status: string }>(`/v1/commerce/actions/${id}/revert`, {}),
    onSuccess: () => toast.success("Reverted"),
    onError: (e) => toast.error(e.message || "Couldn't revert this action"),
    onSettled: () => invalidate(),
  });
}
