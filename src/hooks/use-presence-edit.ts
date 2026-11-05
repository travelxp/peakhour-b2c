"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { presenceChangesApi } from "@/lib/api/presence-changes";
import { presenceEditApi } from "@/lib/api/presence-edit";
import { categoryQueryReady, presenceEditKeys, type ProposeBody } from "@/lib/presence-edit";

/** What each network can write, whether writes are switched on, and what this person's role can do. */
export function useEditCapabilities() {
  return useQuery({
    queryKey: presenceEditKeys.capabilities,
    queryFn: () => presenceEditApi.capabilities(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/** The proposals and history for one listing. Refreshes while something is on its way, so a state does not go stale on screen. */
export function useListingChanges(listingId: string | undefined) {
  return useQuery({
    queryKey: presenceEditKeys.changes(listingId ?? ""),
    queryFn: () => presenceEditApi.changes(listingId as string),
    enabled: !!listingId,
    staleTime: 15_000,
    refetchInterval: (q) => {
      const live = q.state.data?.items.some((c) => c.status === "approved" || c.status === "applying" || c.status === "submitted");
      return live ? 20_000 : false;
    },
  });
}

export function useHolidayOffers(listingId: string | undefined, network: string | undefined) {
  return useQuery({
    queryKey: presenceEditKeys.offers(listingId ?? ""),
    queryFn: () => presenceEditApi.holidayOffers(listingId as string, network as string),
    enabled: !!listingId && !!network,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** A value that follows `value` after `ms` of quiet, so typing does not ask the network on every key. */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * The network's category list for what has been typed. Held for a day on this side too (the api caches as well), and only asked once
 * enough has been typed.
 */
export function useCategorySearch(listingId: string | undefined, network: string | undefined, typed: string) {
  const q = useDebounced(typed.trim());
  return useQuery({
    queryKey: presenceEditKeys.categories(listingId ?? "", q),
    queryFn: () => presenceEditApi.categories(listingId as string, network as string, q),
    enabled: !!listingId && !!network && categoryQueryReady(q),
    staleTime: 24 * 3_600_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function usePresenceEditMutations(listingId: string | undefined) {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: presenceEditKeys.changes(listingId ?? "") });
    await qc.invalidateQueries({ queryKey: presenceEditKeys.offers(listingId ?? "") });
    // The "Your listing" panel above reads the same listing a live change rewrites.
    await qc.invalidateQueries({ queryKey: ["presence", "listing"] });
  };
  return {
    propose: useMutation({ mutationFn: (b: ProposeBody) => presenceEditApi.propose(b), onSuccess: refresh }),
    approve: useMutation({ mutationFn: (id: string) => presenceChangesApi.approve(id), onSuccess: refresh }),
    reject: useMutation({ mutationFn: (id: string) => presenceChangesApi.reject(id), onSuccess: refresh }),
    undo: useMutation({ mutationFn: (id: string) => presenceEditApi.undo(id), onSuccess: refresh }),
    acceptOffer: useMutation({ mutationFn: (b: Parameters<typeof presenceEditApi.proposeOffer>[0]) => presenceEditApi.proposeOffer(b), onSuccess: refresh }),
    dismissOffer: useMutation({ mutationFn: (b: Parameters<typeof presenceEditApi.dismissOffer>[0]) => presenceEditApi.dismissOffer(b), onSuccess: refresh }),
  };
}
