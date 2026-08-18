import { api } from "@/lib/api";

/**
 * Typed client for the WordPress "claim a silently-connected site" flow
 * (peakhour-api wp-bridge claim/candidates + claim). The plugin's silent-connect
 * hands the WP admin a claim URL → /claim/wordpress?site=<id>&t=<token>; this
 * page exchanges the token for the candidate accounts, then attaches the site to
 * the chosen one. Both calls are cookie-authed (the user is signed in here) and
 * pass the token in the POST body (never the query string).
 */

export interface ClaimSite {
  host: string;
  siteUrl: string;
  adminEmail: string | null;
}

export interface ClaimOrg {
  orgId: string;
  name: string;
  role: string;
}

export interface ClaimCandidates {
  site: ClaimSite;
  /** The signed-in Peakhour account's email (shown alongside the WP admin email
   *  so the user knows which account they're attaching to). */
  signedInEmail: string | null;
  /** Orgs the signed-in user can attach the site to. UI auto-selects when 1. */
  orgs: ClaimOrg[];
}

export async function fetchClaimCandidates(
  site: string,
  token: string,
): Promise<ClaimCandidates> {
  return api.request<ClaimCandidates>("/v1/integrations/wordpress/claim/candidates", {
    method: "POST",
    body: JSON.stringify({ site, token }),
  });
}

export async function claimWordpressSite(
  site: string,
  token: string,
  orgId: string,
): Promise<{ claimed: boolean; orgId: string }> {
  return api.request<{ claimed: boolean; orgId: string }>(
    "/v1/integrations/wordpress/claim",
    { method: "POST", body: JSON.stringify({ site, token, orgId }) },
  );
}
