import { api } from "@/lib/api";
import type { PhotosResponse } from "@/lib/presence-photos";
import type { ChangeCardData } from "@/lib/presence-edit";

/**
 * The listing photos panel's calls (PE-11). Reading lists what the network holds. Adding or removing a photo is a PROPOSAL on the field
 * `media` through the same change route as every other edit; only `approve` (`presenceChangesApi`, an admin's) starts a write.
 */
export type PhotoChange = { op: "add"; mediaId: string; category: string } | { op: "remove"; ref: string };

export const presenceMediaApi = {
  get: (listingId: string, network: string) =>
    api.get<PhotosResponse>(`/v1/presence/media?listingId=${encodeURIComponent(listingId)}&network=${encodeURIComponent(network)}`),

  propose: (listingId: string, network: string, value: PhotoChange) =>
    api.post<{ items: ChangeCardData[]; notChecked: Array<{ id: string; code: string; message: string }> }>("/v1/presence/changes", {
      listingId,
      network,
      changes: [{ field: "media", value }],
    }),
};
