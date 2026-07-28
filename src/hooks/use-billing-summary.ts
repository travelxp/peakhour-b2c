"use client";

import { useQuery } from "@tanstack/react-query";
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
