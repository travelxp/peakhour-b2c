"use client";

import { useQuery } from "@tanstack/react-query";
import { creativeApi, type MemoryRead } from "@/lib/api/creative";
import { useAuth } from "@/providers/auth-provider";

export const MEMORY_KEY = "studio-memory";

/** What Studio has learned about this business: free, read-only here. Mutations name {@link MEMORY_KEY} to refresh it. */
export function useMemory() {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<MemoryRead>({
    queryKey: [MEMORY_KEY, org?._id ?? null, business?._id ?? null],
    queryFn: () => creativeApi.memory(),
    enabled: isAuthenticated && !!org?._id && !!business?._id,
    staleTime: 30_000,
    retry: false,
  });
}
