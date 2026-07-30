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
 * `returnTo` must be an in-app `/dashboard/...` path with no dot segments
 * and printable ASCII only; both the Integrations page and the api
 * re-validate it, and anything else silently falls back to the
 * Integrations page.
 *
 * TWO CASES WHERE THE USER STILL LANDS ON SETTINGS, both deliberate and
 * both server-side: a FAILED connect (`?integration=error` — Settings is
 * the only page rendering that copy, including the brand-mismatch "request
 * a review" affordance), and a `linkedin_content` connect by someone who
 * administers more than one Company Page (Settings owns the "which Page
 * speaks for this business?" prompt). Don't promise otherwise in CTA copy.
 */

/**
 * @param returnTo in-app path to come back to after a successful connect.
 * @param provider the provider slug this CTA is about, when it is about
 *   one. The Integrations page honours `returnTo` ONLY for that provider:
 *   without this, a user who arrives to reconnect LinkedIn Ads and then
 *   also connects Instagram gets sent to the LinkedIn Ads hub with
 *   "Instagram connected." — a surface with nothing to do with what they
 *   just did. Omit it for a generic "manage your integrations" link.
 */
export function reconnectHref(returnTo: string, provider?: string): string {
  const base = `/dashboard/integrations?returnTo=${encodeURIComponent(returnTo)}`;
  return provider ? `${base}&returnFor=${encodeURIComponent(provider)}` : base;
}

/** The LinkedIn Ads hub, channel named explicitly — the hub otherwise
 *  defaults to whichever ad channel is connected first. */
export const ADS_LINKEDIN_PATH = "/dashboard/ads?channel=linkedin";

/** Provider slugs, matching peakhour-api's `integrations/providers/*`. Only
 *  the ones these CTAs name — this is not the full catalogue. */
export const LINKEDIN_ADS_PROVIDER = "linkedin_ads";
export const LINKEDIN_CONTENT_PROVIDER = "linkedin_content";
