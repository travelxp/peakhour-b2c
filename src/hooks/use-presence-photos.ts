"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { presenceChangesApi } from "@/lib/api/presence-changes";
import { presenceMediaApi, type PhotoChange } from "@/lib/api/presence-media";
import { presenceEditApi } from "@/lib/api/presence-edit";
import { presenceEditKeys, type ChangeCardData } from "@/lib/presence-edit";
import { inFlightPhotoChanges, settledSince } from "@/lib/presence-photos";

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

/** Where a photo mutation belongs. Carried IN the variables, so a response that arrives after the screen moved to another place or network is still about the one it was sent for. */
export interface PhotoTarget {
  listingId: string;
  network: string;
}

/**
 * Photo proposals, approve, decline and undo.
 *
 * `propose` refreshes NOTHING by itself and carries its place IN ITS VARIABLES (`listingId`, `network`, `value`): a batch of photos is several
 * proposals, a re-read after each would be a read of the network per photo, and a response that arrives after the screen moved to another place
 * must still be about the one it was sent for. The caller calls `refresh(target)` ONCE, after the last one (a single photo is a batch of one).
 * Approve, decline and undo take the change's id (the change card's own call) and refresh in `onSettled`, so a failed press refreshes too, scoped to
 * the photo list and the change list of the place this card is for (the card is keyed by place, so that place is fixed for its life).
 */
export function usePhotoMutations(target: PhotoTarget | null) {
  const qc = useQueryClient();
  const refresh = async (t: PhotoTarget) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: presencePhotosKey(t.listingId, t.network) }),
      qc.invalidateQueries({ queryKey: presenceEditKeys.changes(t.listingId) }),
    ]);
  };
  const settled = async () => {
    if (target) await refresh(target);
  };
  return {
    refresh,
    propose: useMutation({ mutationFn: (v: PhotoTarget & { value: PhotoChange }) => presenceMediaApi.propose(v.listingId, v.network, v.value) }),
    approve: useMutation({ mutationFn: (id: string) => presenceChangesApi.approve(id), onSettled: settled }),
    reject: useMutation({ mutationFn: (id: string) => presenceChangesApi.reject(id), onSettled: settled }),
    undo: useMutation({ mutationFn: (id: string) => presenceEditApi.undo(id), onSettled: settled }),
  };
}

/**
 * Reads the photo list again when a photo change of this network leaves the in-flight statuses (sent and then live or failed, or declined or
 * expired): the change list is polled while anything is on its way, so this follows it and the two cannot disagree for long.
 */
export function useRefreshPhotosWhenSettled(items: ChangeCardData[] | undefined, target: PhotoTarget | null) {
  const qc = useQueryClient();
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!items || !target) return;
    if (settledSince(seen.current, items, target.network)) void qc.invalidateQueries({ queryKey: presencePhotosKey(target.listingId, target.network) });
    seen.current = new Set(inFlightPhotoChanges(items, target.network).map((c) => c.id));
  }, [items, target?.listingId, target?.network, qc]); // eslint-disable-line react-hooks/exhaustive-deps
}
