"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useActiveStore } from "@/providers/active-store-provider";
import { ACTIVITY_KEY } from "@/hooks/use-commerce-activity";
import { AUTONOMY_KEY } from "@/hooks/use-commerce-autonomy";
import {
  ACTIONABLE_STATUSES,
  executeErrorToast,
  executeToast,
  REVERT_SUCCESS_TOAST,
  revertErrorToast,
  type ActionFailure,
} from "@/lib/commerce-action-status";
import type { ActivityItem } from "@/hooks/use-commerce-activity";
import { showToast } from "@/lib/show-toast";

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

/** One pending-execution row: the activity item's fields (`failure` included,
 *  declared once there) plus its channel and resolved capability — the api's
 *  own shape, `ActionableItem extends ActivityItem` (review round 3). */
export interface ActionableItem extends ActivityItem {
  channel: string | null;
  /** The resolved capability (execute vs stage + honest reason), or null for an
   *  agent that performs no store write. */
  capability: { mode: CapabilityMode; reason: string } | null;
}

export const ACTIONS_KEY = "commerce-actions";

/** The actions a merchant can act on — proposals to approve, approved to ship,
 *  shipped (or unconfirmed) to revert. Newest first. */
export function useCommerceActions(statuses: readonly string[] = ACTIONABLE_STATUSES) {
  const store = useActiveStore();
  const { isAuthenticated, org } = useAuth();
  const status = statuses.join(",");
  return useQuery<{ items: ActionableItem[] }>({
    queryKey: [ACTIONS_KEY, org?._id ?? null, status, store.merchantId ?? null],
    queryFn: () => api.get<{ items: ActionableItem[] }>(
      store.path(`/v1/commerce/actions?status=${encodeURIComponent(status)}`),
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
  const store = useActiveStore();
  const invalidate = useInvalidateActions();
  return useMutation<{ status: string }, ApiError, string>({
    mutationFn: (id) => api.post<{ status: string }>(store.path(`/v1/commerce/actions/${id}/approve`), {}),
    onSuccess: () => toast.success("Approved — ready to ship"),
    onError: (e) => toast.error(e.message || "Couldn't approve this action"),
    onSettled: () => invalidate(),
  });
}

/** Ship an approved action — executes for real or stages advisory (per the
 *  capability matrix); the server returns the resulting ledger status. */
export function useExecuteAction() {
  const store = useActiveStore();
  const invalidate = useInvalidateActions();
  return useMutation<{ status: string; failure?: ActionFailure }, ApiError, string>({
    mutationFn: (id) =>
      api.post<{ status: string; failure?: ActionFailure }>(store.path(`/v1/commerce/actions/${id}/execute`), {}),
    onSuccess: (res) => {
      // ★One decision, in `executeToast`: an unknown outcome is a warning
      //  that names the undo, never a green "Done" (mongodb mig 366).
      showToast(executeToast(res));
    },
    onError: (e) => showToast(executeErrorToast(e)),
    onSettled: () => invalidate(),
  });
}

/** Undo an executed, unconfirmed or staged action (puts the store back first).
 *  An unconfirmed one answers UNDO_SETTLING for a few minutes; its message says
 *  when to try again, and is shown as it comes. */
export function useRevertAction() {
  const store = useActiveStore();
  const invalidate = useInvalidateActions();
  return useMutation<{ status: string }, ApiError, string>({
    mutationFn: (id) => api.post<{ status: string }>(store.path(`/v1/commerce/actions/${id}/revert`), {}),
    onSuccess: () => showToast(REVERT_SUCCESS_TOAST),
    // ★UNDO_SETTLING is a wait, shown as one (review round 1).
    onError: (e) => showToast(revertErrorToast(e)),
    onSettled: () => invalidate(),
  });
}
