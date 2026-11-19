"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { creativeApi, type LibraryPage, type LibraryView } from "@/lib/api/creative";
import { listProductImages, type ProductImagesPage } from "@/lib/api/media";
import { useAuth } from "@/providers/auth-provider";

export const LIBRARY_KEYS = {
  creatives: "studio-library",
  photos: "studio-product-photos",
} as const;

function useScope() {
  const { isAuthenticated, org, business } = useAuth();
  return { enabled: isAuthenticated && !!org?._id && !!business?._id, org: org?._id ?? null, business: business?._id ?? null };
}

/** The Library list: finals ("made") or saved plans. Free. The page number is part of the key so Previous/Next keep the last page on screen. */
export function useLibrary(q: { view: LibraryView; q?: string; status?: string; page: number }) {
  const s = useScope();
  return useQuery<LibraryPage>({
    queryKey: [LIBRARY_KEYS.creatives, s.org, s.business, q.view, q.q ?? "", q.status ?? "", q.page],
    queryFn: () => creativeApi.library(q),
    enabled: s.enabled,
    staleTime: 30_000,
    retry: false,
    placeholderData: (prev) => prev,
  });
}

/** Product photos, page by page by the api's `next`. */
export function useProductPhotos() {
  const s = useScope();
  return useInfiniteQuery<ProductImagesPage, Error, { pages: ProductImagesPage[] }, unknown[], string | undefined>({
    queryKey: [LIBRARY_KEYS.photos, s.org, s.business],
    queryFn: ({ pageParam }) => listProductImages({ ...(pageParam ? { after: pageParam } : {}), limit: 48 }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next,
    enabled: s.enabled,
    staleTime: 30_000,
    retry: false,
    // While an import runs the counts grow, so look again; stop when nothing is running.
    refetchInterval: (query) => (query.state.data?.pages[0]?.imports.some((i) => i.status === "running") ? 15_000 : false),
  });
}
