"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { CommerceStore } from "@/lib/commerce-store";

/**
 * The active business's connected stores, primary first
 * (GET /v1/commerce/stores). Feeds the commerce store picker.
 */
export function commerceStoresQuery(businessId: string | undefined, enabled = true) {
  return queryOptions({
    queryKey: ["commerce-stores", businessId ?? null],
    queryFn: async () => (await api.get<{ stores: CommerceStore[] }>("/v1/commerce/stores")).stores,
    enabled: enabled && !!businessId,
    staleTime: 60_000,
    retry: false,
  });
}

export function useCommerceStores() {
  const { isAuthenticated, business } = useAuth();
  return useQuery(commerceStoresQuery(business?._id, isAuthenticated));
}
