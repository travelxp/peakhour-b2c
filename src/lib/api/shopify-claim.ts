import { api } from "@/lib/api";

/**
 * Typed client for the Shopify "claim a cold-installed store" flow (peakhour-api
 * shopify-claim candidates + claim). The embedded app's "Claim this store" button
 * mints a claim URL → /claim/shopify?store=<connId>&t=<token>; this page exchanges
 * the token for the candidate accounts, then adopts the store into the chosen one
 * (attaching to an existing brand, or moving it in as a new Business).
 *
 * Both calls are cookie-authed (the merchant is signed in here) and pass the
 * token in the POST body (never the query string).
 */

export interface ClaimStore {
  shopDomain: string;
  name: string;
  contactEmail: string | null;
}

export interface ClaimBusiness {
  businessId: string;
  name: string;
}

export interface ClaimOrg {
  orgId: string;
  name: string;
  role: string;
  businesses: ClaimBusiness[];
}

export interface ShopifyClaimCandidates {
  store: ClaimStore;
  /** The signed-in Peakhour account's email (shown so the merchant knows which
   *  account they're attaching the store to). */
  signedInEmail: string | null;
  /** Orgs the signed-in user can attach the store to, each with its businesses. */
  orgs: ClaimOrg[];
}

export async function fetchShopifyClaimCandidates(
  store: string,
  token: string,
): Promise<ShopifyClaimCandidates> {
  return api.request<ShopifyClaimCandidates>("/v1/shopify/claim/candidates", {
    method: "POST",
    body: JSON.stringify({ store, token }),
  });
}

/**
 * Adopt the store. Omit `businessId` to move the store in as a NEW Business under
 * the org (plan-gated); pass an existing `businessId` to attach it to that brand.
 */
export async function claimShopifyStore(
  store: string,
  token: string,
  orgId: string,
  businessId?: string,
): Promise<{ claimed: boolean; orgId: string; businessId: string }> {
  return api.request<{ claimed: boolean; orgId: string; businessId: string }>(
    "/v1/shopify/claim",
    {
      method: "POST",
      body: JSON.stringify({ store, token, orgId, ...(businessId ? { businessId } : {}) }),
    },
  );
}
