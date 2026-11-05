"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { presenceChangesApi } from "@/lib/api/presence-changes";
import { presenceMediaApi, type PhotoChange } from "@/lib/api/presence-media";
import { presenceEditApi } from "@/lib/api/presence-edit";
import { presenceEditKeys, type ChangeCardData } from "@/lib/presence-edit";
import { openPhotoChanges, settledSince } from "@/lib/presence-photos";

export const presencePhotosKey = (listingId: string, network: string) => ["presence", "photos", listingId, network] as const;

/** What the network holds for the place. Not refetched on focus: it is a call to the network, and a change refreshes it when one settles. */
export function usePhotos(listingId: string | undefined, network: string | undefined) {
  return useQuery({
    queryKey: presencePhotosKey(listingId ?? "", network ?? ""),
    queryFn: () => presenceMediaApi.get(listingId as string, network as string),
    enabled: !!listingId && !!network,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Photo proposals, approve, decline and undo. Each refreshes the photo list and the change list together, and `onSettled` so a FAILED proposal
 * refreshes them too (a refused photo may have changed what the network holds, and the error should not leave a stale list behind).
 */
export function usePhotoMutations(listingId: string | undefined, network: string | undefined) {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: presenceEditKeys.changes(listingId ?? "") });
    await qc.invalidateQueries({ queryKey: ["presence", "photos"] });
    await qc.invalidateQueries({ queryKey: ["presence", "listing"] });
  };
  return {
    propose: useMutation({ mutationFn: (v: PhotoChange) => presenceMediaApi.propose(listingId as string, network as string, v), onSettled: refresh }),
    approve: useMutation({ mutationFn: (id: string) => presenceChangesApi.approve(id), onSettled: refresh }),
    reject: useMutation({ mutationFn: (id: string) => presenceChangesApi.reject(id), onSettled: refresh }),
    undo: useMutation({ mutationFn: (id: string) => presenceEditApi.undo(id), onSettled: refresh }),
  };
}

/**
 * Reads the photo list again when a photo change leaves the open statuses (sent, failed, declined, expired): the change list is polled while
 * anything is on its way, so this follows it and the two cannot disagree for long.
 */
export function useRefreshPhotosWhenSettled(items: ChangeCardData[] | undefined) {
  const qc = useQueryClient();
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!items) return;
    if (settledSince(seen.current, items)) void qc.invalidateQueries({ queryKey: ["presence", "photos"] });
    seen.current = new Set(openPhotoChanges(items).map((c) => c.id));
  }, [items, qc]);
}
