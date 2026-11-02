"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * `GET /v1/billing/summary` — the ONE-SUBSCRIPTION view of what the signed-in
 * BUSINESS owns (api#1510: its own lines, plus unstamped legacy lines, and
 * every figure computed from those).
 *
 * The billing page used to render only the legacy base plan, so an org paying for
 * three products read as "Free" with no total and no charge date. This is the
 * server's assembled answer: every granting product with the price the CHARGE
 * will use, the combined monthly total, whether they bill together, and when.
 */

export interface BillingSummaryProduct {
  productKey: string | null;
  /** The business holding the line (api#1510), or null for an unstamped
   *  legacy row, which every business of the org lists until its owner is
   *  known. */
  businessId: string | null;
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
  /** When a scheduled cancel or plan change ends the line (D21). */
  endsAt?: string | null;
  /** Null when the line could not be priced for this country (api#1510):
   *  unknown, never 0. */
  amount: number | null;
  currency: string | null;
  /** False exactly when `amount` is null: the amount is unknown, not zero. */
  amountKnown: boolean;
  /** month / quarter / year (P3.1a); what `amount` recurs on. */
  interval: string;
}

export interface BillingSummary {
  country: string;
  /** The business these figures are for (api#1553), or null for the org. */
  businessId: string | null;
  /** The base row's plan, only on the business it covers (api#1553): the
   *  Suite trial or a contract on the first business, or an org contract
   *  (Enterprise) on every business. Null on an added business. */
  basePlan: string | null;
  /** Null when no live base row covers this business (api#1510, api#1553). */
  basePlanName: string | null;
  products: BillingSummaryProduct[];
  /** Null for a business with no lines, or lines in several currencies. */
  monthlyTotal: number | null;
  /** The quarterly and yearly lines' totals (api#1495), each null when no line
   *  recurs on it. Never summed into `monthlyTotal`. */
  quarterlyTotal?: number | null;
  yearlyTotal?: number | null;
  /** False when at least one billed line's amount is unknown: every total is a
   *  floor, not the whole charge, and an unknown line counts 0 in it, so a
   *  period whose lines are all unknown totals 0 (`recurringTotalText`). */
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

/**
 * The cache key of one business's billing summary. ★BY BUSINESS, not only by
 * org (P4.3b): the lines and totals are the signed-in business's (api#1510),
 * so the key names whose answer an entry is. `switchBusiness` also clears the
 * whole cache, so this is not what isolates a switch; it keeps an entry from
 * being read as another business's on any path that does not clear.
 */
export function billingSummaryKey(orgId: string | null | undefined, businessId: string | null | undefined) {
  return [BILLING_SUMMARY_KEY, orgId ?? null, businessId ?? null] as const;
}

export function useBillingSummary() {
  const { org, business, isAuthenticated } = useAuth();
  return useQuery<BillingSummary>({
    queryKey: billingSummaryKey(org?._id, business?._id),
    queryFn: () => api.get<BillingSummary>("/v1/billing/summary"),
    // ★Only with a business: with none the api lists every purchase in the
    //  org, which is no business's answer.
    enabled: isAuthenticated && !!org?._id && !!business?._id,
    // Matches useDashboardOrg: billing state changes rarely, and every mutation
    // (checkout, trial start, cancel) invalidates this key explicitly.
    staleTime: 60_000,
  });
}

/** One order confirmation — the document a purchase produces immediately, for
 *  the window before any tax invoice can legally exist. */
export interface OrderConfirmation {
  _id: string;
  /** The business the change was for (mongodb migration 406, api#1553), or
   *  null for a confirmation stored before it, which every business of the
   *  org lists. */
  businessId: string | null;
  orderNumber: string;
  kind: "purchased" | "trial_started" | "added" | "upgraded" | "removed";
  tier: string;
  monthlyTotal: string;
  /** Present only when such a line is (mig 386). */
  quarterlyTotal?: string;
  yearlyTotal?: string;
  currency: string;
  firstChargeAt?: string | null;
  issuedAt: string;
  lines: Array<{ name: string; amount: string; interval?: string; trialEndsAt?: string | null }>;
}

export const BILLING_ORDERS_KEY = "/v1/billing/orders";

/**
 * The cache key of one business's order confirmations. ★BY BUSINESS (api#1553):
 * the list is the signed-in business's, as `billingSummaryKey`'s is.
 */
export function billingOrdersKey(orgId: string | null | undefined, businessId: string | null | undefined) {
  return [BILLING_ORDERS_KEY, orgId ?? null, businessId ?? null] as const;
}

/**
 * Order confirmations for the billing page: the signed-in business's own,
 * plus unstamped ones stored before mongodb migration 406 (api#1553).
 *
 * Separate from invoices deliberately. With a 14-day trial on every plan a tax
 * invoice cannot legally exist until the first charge, so without these the
 * customer stares at an empty Invoices table for two weeks after a purchase that
 * definitely happened — which is exactly what was reported.
 */
export function useBillingOrders() {
  const { org, business, isAuthenticated } = useAuth();
  return useQuery<OrderConfirmation[]>({
    queryKey: billingOrdersKey(org?._id, business?._id),
    queryFn: () => api.get<OrderConfirmation[]>("/v1/billing/orders"),
    // ★Only with a business: with none the api lists the whole org's.
    enabled: isAuthenticated && !!org?._id && !!business?._id,
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
