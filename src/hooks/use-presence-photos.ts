"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { presenceChangesApi } from "@/lib/api/presence-changes";
import { presenceMediaApi, type PhotoChange } from "@/lib/api/presence-media";
import { presenceEditApi } from "@/lib/api/presence-edit";
import { presenceEditKeys } from "@/lib/presence-edit";

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

/** Photo proposals, approve, decline and undo. Each refreshes the photo list and the change list together. */
export function usePhotoMutations(listingId: string | undefined, network: string | undefined) {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: presenceEditKeys.changes(listingId ?? "") });
    await qc.invalidateQueries({ queryKey: ["presence", "photos"] });
    await qc.invalidateQueries({ queryKey: ["presence", "listing"] });
  };
  return {
    propose: useMutation({ mutationFn: (v: PhotoChange) => presenceMediaApi.propose(listingId as string, network as string, v), onSuccess: refresh }),
    approve: useMutation({ mutationFn: (id: string) => presenceChangesApi.approve(id), onSuccess: refresh }),
    reject: useMutation({ mutationFn: (id: string) => presenceChangesApi.reject(id), onSuccess: refresh }),
    undo: useMutation({ mutationFn: (id: string) => presenceEditApi.undo(id), onSuccess: refresh }),
  };
}
