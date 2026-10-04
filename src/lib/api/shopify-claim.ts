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

/** Is this store the same brand as a business? (api: integration-fit guard.)
 *  `unknown` when the check could not run; it never blocks a claim. */
export interface ClaimFit {
  verdict: "anchor" | "match" | "mismatch" | "ambiguous" | "unknown";
  reason?: string;
  /** The business's brand the store was compared with, e.g. "silkstore.in". */
  anchor?: string;
}

export interface ClaimBusiness {
  businessId: string;
  name: string;
  /** Absent from an api that predates the brand-fit check. */
  fit?: ClaimFit;
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

export interface ClaimResult {
  claimed: boolean;
  adopted?: boolean;
  orgId: string;
  businessId: string | null;
  /** The workspace the store joined or became. */
  businessName?: string | null;
  /** True when the store became its own workspace. */
  newBusiness?: boolean;
  store?: { name: string | null; shopDomain: string | null };
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
 * Adopt the store into an account.
 *
 * - Omit `orgId` entirely (one-click path): the server picks automatically —
 *   a signed-in operator with no account has the store's shell org handed to
 *   them as their first workspace (`adopted: true`), no onboarding needed.
 * - Pass `orgId` with no `businessId` → move the store in as a NEW Business.
 * - Pass `orgId` + `businessId` → attach it to that existing brand. If the
 *   store may be a different brand, the server answers 409
 *   CLAIM_BRAND_CONFIRM; resend with `confirmed: true` once the merchant says
 *   it is the same brand.
 */
export async function claimShopifyStore(
  store: string,
  token: string,
  orgId?: string,
  businessId?: string,
  confirmed?: boolean,
): Promise<ClaimResult> {
  return api.request<ClaimResult>("/v1/shopify/claim", {
    method: "POST",
    body: JSON.stringify({
      store,
      token,
      ...(orgId ? { orgId } : {}),
      ...(businessId ? { businessId } : {}),
      ...(confirmed ? { confirmed: true } : {}),
    }),
  });
}
