/**
 * Auth-cookie name namespacing — mirrors peakhour-api's `jwt.ts` cookieNs().
 *
 * dev and prod both store the b2c session cookies on the shared
 * `.peakhour.ai` parent domain, so without a namespace they share one
 * cookie slot and collide in a browser that has visited both. The API
 * stamps an optional `AUTH_COOKIE_NS` prefix onto the names; the
 * coming-soon middleware's soft-session check must derive the SAME name.
 * The value MUST match peakhour-api (and peakhour-cms) for the
 * environment — unset/empty everywhere → bare names (production).
 *
 * Pure (process.env + string ops), so it is safe to import into the Edge
 * middleware, which already reads other process.env values at runtime.
 */
function cookieNs(): string {
  return (process.env.AUTH_COOKIE_NS || "").trim();
}

function nsCookie(base: string): string {
  const ns = cookieNs();
  return ns ? `${ns}_${base}` : base;
}

/** Resolved b2c access-token cookie name (ns-aware). */
export function b2cAccessCookieName(): string {
  return nsCookie("access_token");
}

/** Resolved b2c refresh-token cookie name (ns-aware). */
export function b2cRefreshCookieName(): string {
  return nsCookie("refresh_token");
}
