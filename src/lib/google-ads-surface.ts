/**
 * ★★G-15 — WHICH GOOGLE ADS ROUTES A b2c SURFACE MAY CALL.
 *
 * The api's Google router (peakhour-api `src/v1/routes/google-ads/`, G-09) is
 * MANAGED: a campaign is an `ad_campaigns` row first, created PAUSED through
 * the claimed create, so `ad-campaign-monitor`, the spend caps and the kill
 * switch see it from the start. This file is the list b2c may call, as
 * `meta-ads-surface.ts` is Meta's (M-13): the client builds every URL through
 * `googleAdsUrl`, the panel names no path, and `google-ads-surface.test.ts`
 * checks both, and that each route here is one the api serves.
 *
 * ⚠️THE PREFIX IS THE MOUNT, `/v1/google/ads` — the router is mounted
 * `v1.route("/google/ads", …)` on a `/v1` base path. The SOURCE directory is
 * `google-ads`; nothing is served there (M-13's round-1 lesson).
 *
 * ★SEARCH, PERFORMANCE MAX AND YOUTUBE VIDEO (DEMAND GEN) ONLY (G-04, G19,
 * G20): no route here creates or lists any other campaign type.
 */

/** The router's mount, `basePath` included. Pinned against the api in the test. */
export const GOOGLE_ADS_PREFIX = "/v1/google/ads";

/** Every Google ads route b2c may call — each reads, or records what it did in `ad_campaigns`. */
export const GOOGLE_ADS_MANAGED_ROUTES = [
  `${GOOGLE_ADS_PREFIX}/ad-accounts`,
  `${GOOGLE_ADS_PREFIX}/campaigns`,
  `${GOOGLE_ADS_PREFIX}/campaigns/:id/status`,
  // G-17b: which conversion action offline sales are reported to. GET reads; PUT chooses or creates.
  `${GOOGLE_ADS_PREFIX}/conversion-action`,
  // G-14f: the website conversion action and its tag (RMF C.65). GET reads; PUT finds or creates it.
  `${GOOGLE_ADS_PREFIX}/website-conversion`,
  // G-14a: the targeting step. GET reads live from Google; PUT replaces the campaign's places, keywords and negatives.
  `${GOOGLE_ADS_PREFIX}/campaigns/:id/targeting`,
  // G-14a: pause, enable or remove one keyword (RMF M.140).
  `${GOOGLE_ADS_PREFIX}/campaigns/:id/keywords/:criterionId/status`,
  // G-14a: Google's places for a name, and the account's languages. Both read.
  `${GOOGLE_ADS_PREFIX}/locations`,
  `${GOOGLE_ADS_PREFIX}/languages`,
  // G-14d: Google's own reports (RMF R.10–R.130), read live. GET only.
  `${GOOGLE_ADS_PREFIX}/reports/:report`,
  // G-14g: Google's Keyword Ideas for a Search campaign (RMF's look-alike rule). POST, and it reads only.
  `${GOOGLE_ADS_PREFIX}/campaigns/:id/keyword-ideas`,
] as const;

export type GoogleAdsManagedRoute = (typeof GOOGLE_ADS_MANAGED_ROUTES)[number];

/**
 * Matches any Google-ads path spelled out in a source file — a literal, a
 * template with an interpolated id. A path in a COMMENT counts too (the safe
 * direction); the two files allowed to name one are excluded by path. Not
 * `/v1/google/business-profile` or any other sibling mount (the boundary), and
 * `.` is not a path character (a sentence-final period is punctuation).
 */
const GOOGLE_ADS_PATH = /\/v1\/google\/ads(?![A-Za-z0-9_-])(?:\/[A-Za-z0-9_\-:${}]+)*/g;

/** Every Google-ads path named in `text`, de-duplicated and in source order. */
export function findGoogleAdsPaths(text: string): string[] {
  return [...new Set(text.match(GOOGLE_ADS_PATH) ?? [])];
}

/** The bare mount, named in prose — not a call. */
export function isBareGoogleAdsMount(path: string): boolean {
  return path === GOOGLE_ADS_PREFIX;
}

/**
 * Whether `path` is a managed route — a `:param` or `${…}` segment matching
 * the template's `:param`, every other segment equal.
 */
export function isManagedGoogleAdsPath(path: string): boolean {
  const segs = path.split("/");
  return GOOGLE_ADS_MANAGED_ROUTES.some((route) => {
    const want = route.split("/");
    if (want.length !== segs.length) return false;
    return want.every((w, i) => (w.startsWith(":") ? /^(?::[A-Za-z]+|\$\{[^}]+\})$/.test(segs[i]!) || /^[A-Za-z0-9_-]+$/.test(segs[i]!) : w === segs[i]));
  });
}

/**
 * Build a managed route's URL. The parameter is the managed-route union, so a
 * route off the list does not type-check; it throws at runtime for one
 * smuggled past the type, and for a missing param rather than emitting a path
 * with a hole in it.
 */
export function googleAdsUrl(route: GoogleAdsManagedRoute, params: Record<string, string> = {}): string {
  if (!(GOOGLE_ADS_MANAGED_ROUTES as readonly string[]).includes(route)) {
    throw new Error(`${route} is not a managed Google Ads route`);
  }
  return route.replace(/:([A-Za-z]+)/g, (_m, name: string) => {
    const v = params[name];
    if (v === undefined || v === "") throw new Error(`${route} needs :${name}`);
    return encodeURIComponent(v);
  });
}
