"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getBusinesses } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";
import {
  arrivalCopy,
  awaitAddedBusiness,
  clearPendingAdd,
  readPendingAdd,
  safeNext,
  sessionStore,
} from "@/lib/add-business";

/**
 * Wait for a purchased business to exist, then switch into it (billing plan
 * P3.2, on P3.1b). The payment creates the business (D12): Stripe's `/confirm`
 * on the return, or the webhook. `arrive` resolves once the wait ends; the
 * caller's component stays mounted meanwhile (a switch keeps the layout).
 *
 * Where to go after the switch is the pending purchase's `next` (the claim to
 * finish, the channel to reconnect), kept for the tab across Stripe's return,
 * or the caller's own.
 */
export function useAddedBusinessArrival() {
  const { switchBusiness } = useAuth();
  const router = useRouter();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  return useCallback(
    async (a: { businessId: string; name?: string | null; sessionId?: string | null; next?: string | null }) => {
      const pending = readPendingAdd(sessionStore(), a.businessId, Date.now());
      const name = a.name || pending?.name || "";
      const outcome = await awaitAddedBusiness({
        businessId: a.businessId,
        sessionId: a.sessionId,
        confirm: (sessionId) => api.post<{ activated?: boolean }>("/v1/billing/confirm", { sessionId }),
        listBusinessIds: async () => (await getBusinesses()).map((b) => b._id),
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        now: () => Date.now(),
        cancelled: () => !alive.current,
      });
      if (outcome === "cancelled") return outcome;
      const copy = arrivalCopy(outcome, name);
      if (outcome === "timeout") {
        toast.success(copy.title, { description: copy.description });
        return outcome;
      }
      clearPendingAdd(sessionStore());
      try {
        await switchBusiness(a.businessId);
      } catch {
        // It exists; the workspace menu lists it. Say so rather than fail.
        toast.success(arrivalCopy("timeout", name).title, {
          description: `${name || "Your new business"} is in the workspace menu.`,
        });
        return outcome;
      }
      toast.success(copy.title, { description: copy.description });
      const next = safeNext(a.next ?? pending?.next);
      if (next) router.push(next);
      return outcome;
    },
    [switchBusiness, router],
  );
}
