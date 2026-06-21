"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * Commerce inventory-intelligence hooks (WS3). `useInventory` reads the free
 * stock-health summary (GET /v1/commerce/inventory); `useInventoryDiagnosis`
 * runs the paid AI diagnosis (POST /v1/commerce/inventory/diagnose, Peaks-metered).
 */

export type StockHealth = "healthy" | "watchlist" | "slow" | "at_risk";

export interface InventoryItem {
  sourceProductId: string;
  title: string;
  stock: number | null;
  unitsSold: number;
  daysOfCover: number | null;
  health: StockHealth;
}

export interface InventorySummary {
  windowDays: number;
  scanned: number;
  truncated: boolean;
  counts: Record<StockHealth, number>;
  items: InventoryItem[];
}

const INVENTORY_KEY = "commerce-inventory";

export function useInventory() {
  const { isAuthenticated, org } = useAuth();
  return useQuery<InventorySummary>({
    queryKey: [INVENTORY_KEY, org?._id ?? null],
    queryFn: () => api.get<InventorySummary>("/v1/commerce/inventory"),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 5 * 60_000,
    // A missing store / unsynced catalog returns a 4xx — don't hammer it.
    retry: false,
  });
}

export interface InventoryDiagnosis {
  summary: InventorySummary;
  diagnosis: string;
}

export function useInventoryDiagnosis() {
  return useMutation<InventoryDiagnosis, Error>({
    mutationFn: () => api.post<InventoryDiagnosis>("/v1/commerce/inventory/diagnose", {}),
  });
}
