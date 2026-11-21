"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { creativeApi, type LibraryFilter, type LibraryPage, type LibraryView, type ProductPhotosOne, type ProductPhotosPage } from "@/lib/api/creative";
import { listProductImages, type ProductImagesPage } from "@/lib/api/media";
import { useAuth } from "@/providers/auth-provider";

export const LIBRARY_KEYS = {
  creatives: "studio-library",
  photos: "studio-product-photos",
  photosOne: "studio-product-photos-one",
  imports: "studio-product-imports",
} as const;

function useScope() {
  const { isAuthenticated, org, business } = useAuth();
  return { enabled: isAuthenticated && !!org?._id && !!business?._id, org: org?._id ?? null, business: business?._id ?? null };
}

/** The Library list: finals ("made") or saved plans. Free. No placeholder data: a failed page or filter must show its error, not the page before. */
export function useLibrary(q: { view: LibraryView; q?: string; status?: string; page: number; enabled?: boolean } & LibraryFilter) {
  const s = useScope();
  return useQuery<LibraryPage>({
    queryKey: [LIBRARY_KEYS.creatives, s.org, s.business, q.view, q.q ?? "", q.status ?? "", q.page, q.publish ?? "", q.channel ?? "", q.from ?? "", q.to ?? ""],
    queryFn: () => creativeApi.library(q),
    enabled: s.enabled && (q.enabled ?? true),
    staleTime: 30_000,
    retry: false,
  });
}

/** The catalogue's products with their photo count and main photo, page by page by the api's `next`. */
export function useProductPhotos(enabled = true) {
  const s = useScope();
  return useInfiniteQuery<ProductPhotosPage, Error, { pages: ProductPhotosPage[] }, unknown[], string | undefined>({
    queryKey: [LIBRARY_KEYS.photos, s.org, s.business],
    queryFn: ({ pageParam }) => creativeApi.productPhotos({ ...(pageParam ? { after: pageParam } : {}), limit: 24 }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next || undefined,
    enabled: s.enabled && enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** Every photo of one product, read when its sheet is open. */
export function useProductPhotosOne(productId: string | null) {
  const s = useScope();
  return useQuery<ProductPhotosOne>({
    queryKey: [LIBRARY_KEYS.photosOne, s.org, s.business, productId],
    queryFn: () => creativeApi.productPhotosOne(productId as string),
    enabled: s.enabled && !!productId,
    staleTime: 15_000,
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
