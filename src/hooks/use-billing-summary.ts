"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * `GET /v1/billing/summary` — the ONE-SUBSCRIPTION view of what the org owns.
 *
 * The billing page used to render only the legacy base plan, so an org paying for
 * three products read as "Free" with no total and no charge date. This is the
 * server's assembled answer: every granting product with the price the CHARGE
 * will use, the combined monthly total, whether they bill together, and when.
 */

export interface BillingSummaryProduct {
  productKey: string | null;
  tier: string | null;
  /** Customer-facing plan name — never the machine tier key. */
  name: string | null;
  state: string | null;
  /** Set only on a pending-attach trial: the date this product starts billing.
   *  A gateway-native trial has none — the gateway owns that clock — so absence
   *  does NOT mean "not trialing". */
  trialEndsAt: string | null;
  since: string | null;
  renewsAt: string | null;
  amount: number | null;
  currency: string | null;
  /** False when a PAID tier couldn't be priced for this country: the amount is
   *  unknown, not zero. */
  amountKnown: boolean;
  interval: string;
}

export interface BillingSummary {
  country: string;
  basePlan: string | null;
  basePlanName: string | null;
  products: BillingSummaryProduct[];
  monthlyTotal: number | null;
  /** False when at least one product's amount is unknown — the total is a floor,
   *  not the whole charge, and the UI must say so rather than present it as final. */
  monthlyTotalComplete: boolean;
  currency: string | null;
  /** Every product rides one gateway subscription → ONE combined charge. */
  billedTogether: boolean;
  nextChargeAt: string | null;
  /** India (RBI), for the COMBINED debit: "silent" auto-debit, "afa" (the buyer
   *  authenticates every cycle), or "invoice". Null outside India. */
  collectionTier: "silent" | "afa" | "invoice" | null;
  paymentMethod: { gateway: string | null; status: string | null } | null;
}

export const BILLING_SUMMARY_KEY = "/v1/billing/summary";

export function useBillingSummary() {
  const { org, isAuthenticated } = useAuth();
  return useQuery<BillingSummary>({
    queryKey: [BILLING_SUMMARY_KEY, org?._id ?? null],
    queryFn: () => api.get<BillingSummary>("/v1/billing/summary"),
    enabled: isAuthenticated && !!org?._id,
    // Matches useDashboardOrg: billing state changes rarely, and every mutation
    // (checkout, trial start, cancel) invalidates this key explicitly.
    staleTime: 60_000,
  });
}

/** One order confirmation — the document a purchase produces immediately, for
 *  the window before any tax invoice can legally exist. */
export interface OrderConfirmation {
  _id: string;
  orderNumber: string;
  kind: "purchased" | "trial_started" | "added" | "upgraded" | "removed";
  tier: string;
  monthlyTotal: string;
  currency: string;
  firstChargeAt?: string | null;
  issuedAt: string;
  lines: Array<{ name: string; amount: string; trialEndsAt?: string | null }>;
}

export const BILLING_ORDERS_KEY = "/v1/billing/orders";

/**
 * Order confirmations for the billing page.
 *
 * Separate from invoices deliberately. With a 14-day trial on every plan a tax
 * invoice cannot legally exist until the first charge, so without these the
 * customer stares at an empty Invoices table for two weeks after a purchase that
 * definitely happened — which is exactly what was reported.
 */
export function useBillingOrders() {
  const { org, isAuthenticated } = useAuth();
  return useQuery<OrderConfirmation[]>({
    queryKey: [BILLING_ORDERS_KEY, org?._id ?? null],
    queryFn: () => api.get<OrderConfirmation[]>("/v1/billing/orders"),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 60_000,
  });
}

/**
 * Cancel ONE product, leaving the rest of the subscription billing.
 *
 * The server REFUSES a Shopify-billed product — Shopify owns that billing
 * relationship — and returns a message saying where to cancel instead. Surface
 * that message rather than flattening it into a generic failure.
 */
export function useCancelProduct() {
  return useMutation({
    mutationFn: (productKey: string) =>
      api.post<{ cancelled: boolean; productKey: string }>(
        `/v1/billing/products/${encodeURIComponent(productKey)}/cancel`,
        {},
      ),
  });
}
