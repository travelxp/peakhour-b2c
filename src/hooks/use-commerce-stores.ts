"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { CommerceStore } from "@/lib/commerce-store";

/**
 * The active business's connected stores, primary first
 * (GET /v1/commerce/stores). Feeds the commerce store picker.
 */
export function useCommerceStores() {
  const { isAuthenticated, business } = useAuth();
  return useQuery<CommerceStore[]>({
    queryKey: ["commerce-stores", business?._id ?? null],
    queryFn: async () => (await api.get<{ stores: CommerceStore[] }>("/v1/commerce/stores")).stores,
    enabled: isAuthenticated && !!business?._id,
    staleTime: 60_000,
    retry: false,
  });
}
