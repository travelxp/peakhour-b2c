/**
 * Auth-cookie name namespacing; mirrors peakhour-api `jwt.ts` cookieNs().
 *
 * dev and prod both store b2c session cookies on the shared `.peakhour.ai` parent domain, so without a
 * namespace they share one cookie slot and a browser signed in to both bounces between them.
 *
 * The rule, the same in peakhour-api, peakhour-cms and peakhour-b2c (they must agree, or one app writes a
 * cookie the others never read): every dev deployment, master and PR previews alike, runs with
 * VERCEL_ENV="preview" and gets a `dev_` prefix; production and local runs keep the bare names.
 * VERCEL_ENV is set by Vercel on every deployment, so there is no setting to forget.
 *
 * Pure (process.env + string ops), so it is safe to import into the Edge middleware; Vercel exposes
 * VERCEL_ENV there too.
 */
function cookieNs(): string {
  return process.env.VERCEL_ENV === "preview" ? "dev" : "";
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
