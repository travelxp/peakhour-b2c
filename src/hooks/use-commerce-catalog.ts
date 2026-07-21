"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * Commerce catalog + per-listing health (GET /v1/commerce/catalog, api#837).
 * Backs the Catalog & Listings page.
 */

export interface ListingHealth {
  qualityScore: number;
  issues: string[];
}

export interface CatalogItem {
  productId: string;
  title: string;
  imageUrl: string | null;
  priceMinor: number | null;
  currency: string | null;
  status: string;
  channel: string;
  health: ListingHealth;
}

export interface CatalogPage {
  channel: string;
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const CATALOG_KEY = "commerce-catalog";

export function useCommerceCatalog(page = 1, limit = 100) {
  const { isAuthenticated, org } = useAuth();
  return useQuery<CatalogPage>({
    queryKey: [CATALOG_KEY, org?._id ?? null, page, limit],
    queryFn: () => api.get<CatalogPage>(`/v1/commerce/catalog?page=${page}&limit=${limit}`),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Human-readable label for a machine-readable listing issue. */
export const LISTING_ISSUE_LABEL: Record<string, string> = {
  short_title: "Title too short",
  missing_images: "No images",
  thin_description: "Description too thin",
  no_price: "No price set",
};
