"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { CheckoutResult } from "@/components/upgrade/payment-modal";

/**
 * Peaks packs on peakhour.ai's own hosted rail.
 *
 * The Shopify embedded app and the WordPress plugin have listed packs for a
 * long time; both linked out here to buy one, and until the hosted checkout
 * shipped this page had nothing to sell. See
 * peakhour-mongodb/docs/idea/peaks-pack-hosted-checkout-plan.md.
 */

/** Every reason the api's `blockedReason` can carry. `no_wallet` and
 *  `not_priced_here` are hosted-rail states the POST also refuses; omitting them
 *  from this union is how a blocked card ends up with no explanation. */
export type PackBlockedReason =
  | "plan_required"
  | "unlimited"
  | "no_wallet"
  | "not_priced_here";

export interface PeaksPack {
  key: string;
  name: string;
  credits: number;
  /** Decimal string, e.g. "999.00" — priced for the org's own country. */
  amount: string;
  currency: string;
  planRequired: boolean;
  purchasable: boolean;
  /** Why not, when `purchasable` is false. */
  blockedReason: PackBlockedReason | null;
}

export interface PeaksPacksResponse {
  country: string;
  currency: string;
  countryStatus: "live" | "coming_soon" | "blocked";
  /** An unlimited wallet can't use a top-up, so none is offered. */
  unlimited: boolean;
  packs: PeaksPack[];
}

const PACKS_KEY = "/v1/billing/packs";

/**
 * The packs this org can buy. EMPTY until ops makes a pack public and prices
 * it — the whole surface is dormant by default, matching every other reader of
 * `getPeaksPacks`, so an empty array is a normal state and not an error.
 */
export function usePeaksPacks() {
  const { isAuthenticated, org } = useAuth();
  return useQuery<PeaksPacksResponse>({
    queryKey: [PACKS_KEY, org?._id ?? null],
    queryFn: () => api.get<PeaksPacksResponse>(PACKS_KEY),
    enabled: isAuthenticated && !!org?._id,
    // Pack catalogue + price change only when ops edits them.
    staleTime: 5 * 60_000,
  });
}

/** Mint a gateway overlay for one pack. The response is the SAME
 *  `{ gateway, embed, summary }` envelope the plan checkout returns, so the
 *  existing PaymentModal renders it unchanged. */
export function buyPack(packKey: string): Promise<CheckoutResult> {
  return api.post<CheckoutResult>("/v1/billing/packs/checkout", { packKey });
}

/**
 * Reconcile-on-return for the Stripe overlay. Stripe sends the buyer back here
 * the instant the session completes — routinely BEFORE the webhook lands — so
 * without this call they would be looking at an unchanged balance having just
 * paid. Safe to call twice: the api keys the grant on the session id, so
 * whichever of this and the webhook arrives second no-ops.
 */
export function confirmPackPurchase(
  sessionId: string,
): Promise<{ credited: boolean; credits?: number; packKey?: string; reason?: string }> {
  return api.post("/v1/billing/packs/confirm", { sessionId });
}
