"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { creativeApi, type LibraryPage, type LibraryView } from "@/lib/api/creative";
import { listProductImages, type ProductImagesPage } from "@/lib/api/media";
import { useAuth } from "@/providers/auth-provider";

export const LIBRARY_KEYS = {
  creatives: "studio-library",
  photos: "studio-product-photos",
  imports: "studio-product-imports",
} as const;

function useScope() {
  const { isAuthenticated, org, business } = useAuth();
  return { enabled: isAuthenticated && !!org?._id && !!business?._id, org: org?._id ?? null, business: business?._id ?? null };
}

/** The Library list: finals ("made") or saved plans. Free. No placeholder data: a failed page or filter must show its error, not the page before. */
export function useLibrary(q: { view: LibraryView; q?: string; status?: string; page: number; enabled?: boolean }) {
  const s = useScope();
  return useQuery<LibraryPage>({
    queryKey: [LIBRARY_KEYS.creatives, s.org, s.business, q.view, q.q ?? "", q.status ?? "", q.page],
    queryFn: () => creativeApi.library(q),
    enabled: s.enabled && (q.enabled ?? true),
    staleTime: 30_000,
    retry: false,
  });
}

/** Product photos, page by page by the api's `next`. */
export function useProductPhotos(enabled = true) {
  const s = useScope();
  return useInfiniteQuery<ProductImagesPage, Error, { pages: ProductImagesPage[] }, unknown[], string | undefined>({
    queryKey: [LIBRARY_KEYS.photos, s.org, s.business],
    queryFn: ({ pageParam }) => listProductImages({ ...(pageParam ? { after: pageParam } : {}), limit: 48 }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next || undefined,
    enabled: s.enabled && enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Where each store's import stands, read on its own (one photo, not every page walked so far) so it can be polled. While an import runs it
 * is looked at again every 15 seconds; once nothing is running it stops.
 */
export function useImportStatus(enabled = true) {
  const s = useScope();
  return useQuery<ProductImagesPage>({
    queryKey: [LIBRARY_KEYS.imports, s.org, s.business],
    queryFn: () => listProductImages({ limit: 1 }),
    enabled: s.enabled && enabled,
    staleTime: 10_000,
    retry: false,
    refetchInterval: (query) => (query.state.data?.imports.some((i) => i.status === "running") ? 15_000 : false),
  });
}
