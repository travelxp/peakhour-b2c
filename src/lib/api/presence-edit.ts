import { api } from "@/lib/api";
import type {
  CapabilitiesResponse,
  CategoryOption,
  ChangeCardData,
  ChangeOutcomesResponse,
  HolidayOffersResponse,
  ProposeBody,
} from "@/lib/presence-edit";
import { mergeChanges } from "@/lib/presence-edit";

/**
 * The Presence edit forms' calls (PE-07). Every edit is a PROPOSAL: `propose` stores one and applies nothing, and only `approve`
 * (an admin's) starts a write. Approve and decline are `presenceChangesApi` (`api/presence-changes.ts`), shared with Ask Peakhour's card. Whether a write then goes out depends on the operator's switch, which `capabilities` reports.
 */
export const presenceEditApi = {
  capabilities: () => api.get<CapabilitiesResponse>("/v1/presence/changes/capabilities"),

  /**
   * The listing's changes: EVERY open one (read on its own: a newer page of settled history must never push an open change out of the list) and the
   * latest 30 of the rest. Merged and de-duplicated.
   */
  changes: async (listingId: string) => {
    const q = encodeURIComponent(listingId);
    const [history, open] = await Promise.all([
      api.get<{ items: ChangeCardData[] }>(`/v1/presence/changes?listingId=${q}&limit=30`),
      api.get<{ items: ChangeCardData[] }>(`/v1/presence/changes?listingId=${q}&status=open&limit=200`),
    ]);
    return { items: mergeChanges(open.items, history.items) };
  },

  propose: (body: ProposeBody) =>
    api.post<{ items: ChangeCardData[]; notChecked: Array<{ id: string; code: string; message: string }> }>("/v1/presence/changes", body),

  /** What followed the listing's newest live changes: one request for the whole list, never one per card. */
  outcomes: (listingId: string) => api.get<ChangeOutcomesResponse>(`/v1/presence/changes/outcomes?listingId=${encodeURIComponent(listingId)}`),

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

  /** The merchant confirms, or changes, the zone this place keeps its calendar in. Our copy only; nothing is sent to a network. */
  setTimeZone: (body: { listingId: string; timeZone: string }) => api.post<{ timeZone: string }>("/v1/presence/edit/time-zone", body),

  dismissOffer: (body: { listingId: string; key: string }) =>
    api.post<{ dismissed: boolean }>("/v1/presence/edit/holiday-offers/dismiss", body),
};
