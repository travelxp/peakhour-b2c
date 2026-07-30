/**
 * Link builder for the "go reconnect this integration" CTAs.
 *
 * Every one of them used to be a bare `/dashboard/integrations`, and the
 * api's OAuth callback then sent the user to /dashboard/settings — so a
 * reconnect prompted by a failed boost ended two navigations away from the
 * post being boosted, with a green banner on a page nobody asked for.
 *
 * The Integrations page forwards this `returnTo` into
 * `/v1/integrations/:provider/authorize?returnTo=`, the callback carries it
 * in the SIGNED state, and the surface named here gets the user back plus a
 * "<provider> connected" toast (mount `<OAuthConnectResult />` there).
 *
 * `returnTo` must be an in-app `/dashboard/...` path; both the Integrations
 * page and the api re-validate it, and anything else silently falls back to
 * the Integrations page.
 */
export function reconnectHref(returnTo: string): string {
  return `/dashboard/integrations?returnTo=${encodeURIComponent(returnTo)}`;
}

/** The LinkedIn Ads hub, channel named explicitly — the hub otherwise
 *  defaults to whichever ad channel is connected first. */
export const ADS_LINKEDIN_PATH = "/dashboard/ads?channel=linkedin";
