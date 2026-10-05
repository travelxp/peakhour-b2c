import { api } from "@/lib/api";

/**
 * Typed client for the Shopify "claim a cold-installed store" flow (peakhour-api
 * shopify-claim candidates + claim). The embedded app's "Claim this store" button
 * mints a claim URL → /claim/shopify?store=<connId>&t=<token>; this page exchanges
 * the token for the candidate accounts, then adopts the store into the chosen one
 * (keeping it as its own account, attaching it to the same business, or moving
 * it in as a new Business).
 *
 * The guardrail (billing plan D6 revised, D13, D14; api#1482): a store of a
 * different business is never linked into an existing one. Each business says
 * whether the store may join (`attach`), and `mode: "separate"` keeps the store
 * as its own account.
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
  /** May the store join this business? `block`: a different business (no
   *  override); `confirm`: we could not be sure; `allow`. Absent from an api
   *  that predates the context check. */
  attach?: "allow" | "confirm" | "block";
  /** Why, in a shop owner's words ("This store sells furniture; that business
   *  sells clothing."). Null when allowed. */
  attachReason?: string | null;
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
  /** Whether "keep this store as its own account" is on offer (the store is
   *  still in its own shell account). Absent from an older api. */
  canKeepSeparate?: boolean;
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
  /** True when the store was kept as its own account (`mode: "separate"`). */
  separate?: boolean;
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
 * - Nothing chosen (one-click path): the server picks automatically — a
 *   signed-in operator with no account has the store's shell org handed to
 *   them as their first workspace (`adopted: true`), no onboarding needed.
 * - `mode: "separate"` → keep the store as its own account, beside the
 *   operator's other accounts (`separate: true`). Takes no `orgId`.
 * - `orgId` with no `businessId` → move the store in as a NEW Business (402
 *   until the account can pay for another workspace).
 * - `orgId` + `businessId` → attach it to that existing business. A different
 *   business is 409 CLAIM_DIFFERENT_BUSINESS and cannot be confirmed away; an
 *   uncertain one is 409 CLAIM_BRAND_CONFIRM, resent with `confirmed: true`
 *   once the merchant says it is the same business.
 */
export async function claimShopifyStore(
  store: string,
  token: string,
  choice: { orgId?: string; businessId?: string; confirmed?: boolean; mode?: "separate" } = {},
): Promise<ClaimResult> {
  return api.request<ClaimResult>("/v1/shopify/claim", {
    method: "POST",
    body: JSON.stringify({
      store,
      token,
      ...(choice.mode ? { mode: choice.mode } : {}),
      ...(choice.orgId ? { orgId: choice.orgId } : {}),
      ...(choice.businessId ? { businessId: choice.businessId } : {}),
      ...(choice.confirmed ? { confirmed: true } : {}),
    }),
  });
}
