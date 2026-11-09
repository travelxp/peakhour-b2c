import { api } from "@/lib/api";
import type { AttributesResponse, LinksResponse, PostsResponse, ServicesResponse } from "@/lib/presence-extras";
import type { ChangeCardData } from "@/lib/presence-edit";

/**
 * The posts, services, details and links panels' calls (PE-12). Reading shows what the network holds now. Every change is a PROPOSAL on the field
 * `posts`, `services`, `attributes` or `links` through the same change route as every other edit; only `approve` (`presenceChangesApi`, an
 * admin's) starts a write.
 */
export type ExtraProposal = { field: "posts" | "services" | "attributes" | "links"; value: unknown; base?: string };

const q = (listingId: string, network: string) => `listingId=${encodeURIComponent(listingId)}&network=${encodeURIComponent(network)}`;

export const presenceExtrasApi = {
  posts: (listingId: string, network: string) => api.get<PostsResponse>(`/v1/presence/extras/posts?${q(listingId, network)}`),
  services: (listingId: string, network: string) => api.get<ServicesResponse>(`/v1/presence/extras/services?${q(listingId, network)}`),
  attributes: (listingId: string, network: string) => api.get<AttributesResponse>(`/v1/presence/extras/attributes?${q(listingId, network)}`),
  links: (listingId: string, network: string) => api.get<LinksResponse>(`/v1/presence/extras/links?${q(listingId, network)}`),

  propose: (listingId: string, network: string, p: ExtraProposal) =>
    api.post<{ items: ChangeCardData[]; notChecked: Array<{ id: string; code: string; message: string }> }>("/v1/presence/changes", {
      listingId,
      network,
      // `base` is the list as the page drew it (services, details, links): the api refuses a change built on a list that has since changed.
      changes: [{ field: p.field, value: p.value, ...(p.base ? { base: p.base } : {}) }],
    }),
};
