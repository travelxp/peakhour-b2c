"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * Commerce Command Center summary (GET /v1/commerce/summary). Honest outcomes
 * grounded in the connected store's catalog + inventory + our own assisted-order
 * and storefront data — no order scope required. Order-derived outcomes are
 * flagged `orderDerived.switchingOn` until order access lands (WooCommerce has it
 * today; Shopify only after the post-certification read_orders escalation).
 */

export interface CommerceSummary {
  store: { platform: string | null; currency: string | null };
  ordersConnected: boolean;
  inventory: {
    scanned: number;
    healthy: number;
    watchlist: number;
    slow: number;
    atRisk: number;
    /** Retail value of on-hand stock in the store's minor units (not cost basis). */
    stockValueRetailMinor: number;
  };
  assistedOrders: { revenueMinor: number; count: number };
  storefront: { impressions: number; clicks: number; addToCart: number };
  pendingApprovals: number;
  orderDerived: { switchingOn: boolean };
  entitlements: { commerceAssistant: boolean };
}

const SUMMARY_KEY = "commerce-summary";

export function useCommerceSummary() {
  const { isAuthenticated, org } = useAuth();
  return useQuery<CommerceSummary>({
    queryKey: [SUMMARY_KEY, org?._id ?? null],
    queryFn: () => api.get<CommerceSummary>("/v1/commerce/summary"),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 5 * 60_000,
    // A missing store returns 4xx (NO_STORE_CONNECTED) — don't hammer it.
    retry: false,
  });
}
