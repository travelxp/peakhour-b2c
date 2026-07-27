import { CHANNELS, type ChannelConfig } from "./channels.config";

/**
 * Pure decision logic for a Content-hub channel row's CTA — extracted from
 * the page so it can be unit-tested (the page component itself isn't).
 *
 * Three decisions:
 *  - `isConnected`: whether to render "Connected"/"Manage". This depends
 *    ONLY on the org's actual connection (`integration.connected`, which the
 *    API sets from `status === "active"`), NOT on the channel's catalog
 *    lifecycle. A live integration whose CMS catalog row lacks
 *    `display.dashboardPath` resolves to lifecycle "available" (see
 *    channels-from-catalog.ts `toLifecycle`); gating connected-ness on
 *    `status === "live"` therefore made a genuinely-connected channel (e.g.
 *    linkedin_content) read as "Connect". `coming_soon` is excluded — a
 *    not-yet-launched channel can't have a real connection.
 *  - `dashboardPath`: the "Manage" deep-link. Prefer the catalog path, then
 *    fall back to the static config path by providerKey so a catalog row
 *    missing the path still routes to the real in-app dashboard instead of
 *    stranding the user on the OAuth grid.
 *  - `manageViaIntegrations`: connected, but the channel has NO in-app surface
 *    of its own. That is normal, not broken, for the Meta capability rows
 *    (facebook_pages / instagram / meta_ads, expanded by
 *    flattenMetaIntegration) and for wordpress: /dashboard/integrations IS
 *    their management screen — capability toggles, resources, Disconnect. The
 *    row must still be clickable; only the LABEL changes, so landing on the
 *    integrations grid reads as intended rather than as the bounce that made
 *    linkedin_ads look broken.
 *
 * Known gap (tracked): the catalog's `toLifecycle` collapses `locked`
 * (plan/feature/country-gated) and `deprecated` into "available", so a
 * connected-but-locked channel reads as Connected/Manage here. Not reachable
 * via seed defaults (live channels seed with empty
 * requiredPlans/Features/countries) — only via post-seed CMS gating of an
 * org that ALREADY has an active connection. That's defensible (an active
 * connection's manage surface staying reachable, with the API still gating
 * privileged actions), but if it needs to reflect the lock, `toLifecycle` /
 * `ChannelLifecycle` would have to carry a distinct "locked" state.
 */

/** Fallback dashboard deep-links by providerKey, from the static config. */
export const STATIC_DASHBOARD_PATHS: ReadonlyMap<string, string> = new Map(
  CHANNELS.filter((c) => c.dashboardPath).map(
    (c) => [c.providerKey, c.dashboardPath as string] as const,
  ),
);

export interface ChannelCta {
  isConnected: boolean;
  dashboardPath: string | undefined;
  /**
   * Connected, with no in-app surface of its own → the action stays enabled
   * and goes to /dashboard/integrations, but labelled "Manage connection" so
   * the destination is honest. See the header note.
   */
  manageViaIntegrations: boolean;
  /**
   * A genuine config gap: a `live` channel with no dashboardPath in either
   * source. channels.config.ts asserts `live ⇒ dashboardPath` in dev, and
   * `toLifecycle` only reports "live" for catalog rows that HAVE a path, so
   * this should be unreachable — it exists to make the linkedin_ads failure
   * mode loud in dev instead of silent. NOT a user-facing state.
   */
  configGap: boolean;
}

export function resolveChannelCta(
  channel: Pick<ChannelConfig, "status" | "dashboardPath" | "providerKey">,
  integration: { connected?: boolean } | undefined,
  staticDashboardPaths: ReadonlyMap<string, string> = STATIC_DASHBOARD_PATHS,
): ChannelCta {
  const isConnected =
    integration?.connected === true && channel.status !== "coming_soon";
  // `||`, not `??`: an operator can blank a CMS display.dashboardPath to "",
  // which must fall through to the static path rather than count as "set"
  // (channels-from-catalog.ts makes the same truthiness choice for tagline).
  const dashboardPath =
    channel.dashboardPath || staticDashboardPaths.get(channel.providerKey);
  return {
    isConnected,
    dashboardPath,
    manageViaIntegrations: isConnected && !dashboardPath,
    configGap: channel.status === "live" && !dashboardPath,
  };
}
