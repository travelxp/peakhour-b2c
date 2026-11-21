"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { creativeApi, type MemoryPage } from "@/lib/api/creative";
import { useAuth } from "@/providers/auth-provider";

export const MEMORY_KEY = "studio-memory";

/**
 * What Studio has learned about this business: free, read-only here. The lines come a page at a time by the api's cursor (`next`), so nothing is
 * cut off at a fixed number; everything else on the page is the first page's. Mutations name {@link MEMORY_KEY} to refresh it.
 */
export function useMemory() {
  const { isAuthenticated, org, business } = useAuth();
  return useInfiniteQuery<MemoryPage, Error, { pages: MemoryPage[] }, unknown[], string | undefined>({
    queryKey: [MEMORY_KEY, org?._id ?? null, business?._id ?? null],
    queryFn: ({ pageParam }) => (pageParam ? creativeApi.memoryLines(pageParam) : creativeApi.memory()),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next || undefined,
    enabled: isAuthenticated && !!org?._id && !!business?._id,
    staleTime: 30_000,
    retry: false,
  });
}
