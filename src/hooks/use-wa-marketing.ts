"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useActiveStore } from "@/providers/active-store-provider";
import type { Audience, Broadcast, Preview, WaOverview, WaSettings, WaTemplate } from "@/lib/wa-marketing";

/**
 * WhatsApp cart recovery and broadcasts (`/v1/commerce/wa-marketing/*`, lane I3d). Every figure comes from the api; the same
 * endpoints back the Shopify admin app. Reads are keyed by the active store, so a two-store business never shows one store's
 * numbers under the other's name.
 */

const BASE = "/v1/commerce/wa-marketing";
export const WA_KEY = "wa-marketing";

function useScope() {
  const store = useActiveStore();
  const { isAuthenticated, org, business } = useAuth();
  return { store, enabled: isAuthenticated && !!org?._id && !!business?._id, key: [org?._id ?? null, business?._id ?? null, store.merchantId ?? null] as const };
}

export function useWaOverview() {
  const { store, enabled, key } = useScope();
  return useQuery<WaOverview>({ queryKey: [WA_KEY, "overview", ...key], queryFn: () => api.get<WaOverview>(store.path(`${BASE}/overview`)), enabled, retry: false });
}

export function useBroadcasts() {
  const { store, enabled, key } = useScope();
  return useQuery<Broadcast[]>({
    queryKey: [WA_KEY, "broadcasts", ...key],
    queryFn: async () => (await api.get<{ broadcasts: Broadcast[] }>(store.path(`${BASE}/broadcasts`))).broadcasts,
    enabled,
    retry: false,
    // a broadcast in progress moves on its own: refresh while one is
    refetchInterval: (q) => ((q.state.data ?? []).some((b) => b.status === "scheduled" || b.status === "sending") ? 15_000 : false),
  });
}

export function useWaTemplates(enabled2: boolean) {
  const { store, enabled, key } = useScope();
  return useQuery<{ templates: WaTemplate[]; error?: string }>({
    queryKey: [WA_KEY, "templates", ...key],
    queryFn: () => api.get(store.path(`${BASE}/broadcasts/templates`)),
    enabled: enabled && enabled2,
    retry: false,
  });
}

export function useWaProducts(q: string, enabled2: boolean) {
  const { store, enabled, key } = useScope();
  return useQuery<Array<{ sourceProductId: string; title: string }>>({
    queryKey: [WA_KEY, "products", q, ...key],
    queryFn: async () => (await api.get<{ products: Array<{ sourceProductId: string; title: string }> }>(store.path(`${BASE}/products?q=${encodeURIComponent(q)}`))).products,
    enabled: enabled && enabled2,
    retry: false,
  });
}

export interface BroadcastDraft {
  name: string;
  templateName: string;
  language: string;
  bodyParams: string[];
  audience: Audience;
  scheduledFor: string | null;
}

export function useSaveWaSettings() {
  const qc = useQueryClient();
  const { store } = useScope();
  return useMutation({
    mutationFn: (patch: Partial<WaSettings>) => api.patch<{ settings: WaSettings }>(store.path(`${BASE}/settings`), patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [WA_KEY] }),
  });
}

export function usePreviewBroadcast() {
  const { store } = useScope();
  return useMutation({ mutationFn: async (draft: BroadcastDraft) => (await api.post<{ preview: Preview }>(store.path(`${BASE}/broadcasts/preview`), draft)).preview });
}

export function useCreateBroadcast() {
  const qc = useQueryClient();
  const { store } = useScope();
  return useMutation({
    mutationFn: (args: { draft: BroadcastDraft; expectedAudienceSize: number }) =>
      api.post<{ id: string; audienceSize: number; duplicate: boolean }>(store.path(`${BASE}/broadcasts`), { ...args.draft, confirm: true, expectedAudienceSize: args.expectedAudienceSize }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [WA_KEY] }),
  });
}

export function useCancelBroadcast() {
  const qc = useQueryClient();
  const { store } = useScope();
  return useMutation({
    mutationFn: (id: string) => api.post<{ cancelled: boolean }>(store.path(`${BASE}/broadcasts/${id}/cancel`)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [WA_KEY] }),
  });
}
