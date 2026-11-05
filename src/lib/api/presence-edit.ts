import { api } from "@/lib/api";
import type {
  CapabilitiesResponse,
  CategoryOption,
  ChangeCardData,
  HolidayOffersResponse,
  ProposeBody,
} from "@/lib/presence-edit";

/**
 * The Presence edit forms' calls (PE-07). Every edit is a PROPOSAL: `propose` stores one and applies nothing, and only `approve`
 * (an admin's) starts a write. Approve and decline are `presenceChangesApi` (`api/presence-changes.ts`), shared with Ask Peakhour's card. Whether a write then goes out depends on the operator's switch, which `capabilities` reports.
 */
export const presenceEditApi = {
  capabilities: () => api.get<CapabilitiesResponse>("/v1/presence/changes/capabilities"),

  changes: (listingId: string) =>
    api.get<{ items: ChangeCardData[] }>(`/v1/presence/changes?listingId=${encodeURIComponent(listingId)}&limit=30`),

  propose: (body: ProposeBody) =>
    api.post<{ items: ChangeCardData[]; notChecked: Array<{ id: string; code: string; message: string }> }>("/v1/presence/changes", body),

  undo: (id: string) => api.post<{ item: ChangeCardData }>(`/v1/presence/changes/${id}/undo`, {}),

  categories: (listingId: string, network: string, q: string) =>
    api.get<{ items: CategoryOption[]; cached: boolean }>(
      `/v1/presence/edit/categories?listingId=${encodeURIComponent(listingId)}&network=${encodeURIComponent(network)}&q=${encodeURIComponent(q)}`,
    ),

  holidayOffers: (listingId: string, network: string) =>
    api.get<HolidayOffersResponse>(`/v1/presence/edit/holiday-offers?listingId=${encodeURIComponent(listingId)}&network=${encodeURIComponent(network)}`),

  /** Accepting an offer creates a proposal. It does not change the listing. */
  proposeOffer: (body: { listingId: string; network: string; date: string; confirmRegion?: boolean }) =>
    api.post<{ items: ChangeCardData[]; notChecked: unknown[] }>("/v1/presence/edit/holiday-offers/propose", body),

  dismissOffer: (body: { listingId: string; key: string }) =>
    api.post<{ dismissed: boolean }>("/v1/presence/edit/holiday-offers/dismiss", body),
};
