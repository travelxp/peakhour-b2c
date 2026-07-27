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

/**
 * Providers whose management surface legitimately IS /dashboard/integrations —
 * they have no screen of their own, by design:
 *  - the Meta capability rows expanded by flattenMetaIntegration, whose
 *    toggles / resources / Disconnect all live on the integrations card, and
 *  - wordpress, managed from the plugin side plus that same card.
 * Anything ELSE that ends up connected without a dashboardPath is a config gap
 * (see `configGap`), not a designed state.
 */
export const INTEGRATIONS_MANAGED_PROVIDERS: ReadonlySet<string> = new Set([
  "facebook_pages",
  "instagram",
  "meta_ads",
  "wordpress",
]);

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
   * A genuine config gap: a channel the org can act on, with no dashboardPath
   * in either source, that isn't one of the INTEGRATIONS_MANAGED_PROVIDERS.
   *
   * This is deliberately NOT keyed on `status === "live"`: `toLifecycle` reports
   * "live" only for catalog rows that already HAVE a path, so a live-and-
   * pathless row cannot reach here — a guard written that way would never have
   * caught linkedin_ads, whose row surfaced as "available". Dev-only signal;
   * `manageViaIntegrations` still gives the user a working destination either
   * way, which is exactly why the gap needs its own loud channel.
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
    configGap:
      !dashboardPath &&
      channel.status !== "coming_soon" &&
      !INTEGRATIONS_MANAGED_PROVIDERS.has(channel.providerKey),
  };
}
