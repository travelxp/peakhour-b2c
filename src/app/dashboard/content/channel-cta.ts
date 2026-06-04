import { CHANNELS, type ChannelConfig } from "./channels.config";

/**
 * Pure decision logic for a Content-hub channel row's CTA — extracted from
 * the page so it can be unit-tested (the page component itself isn't).
 *
 * Two decisions:
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
 *
 * Known gap (tracked): the catalog's `toLifecycle` collapses `locked`
 * (plan/feature/country-gated) and `deprecated` into "available", so a
 * connected-but-locked channel reads as Connected/Manage here. Not
 * reachable for any current live channel (all have empty
 * requiredPlans/Features/countries); revisit if a live channel gains a
 * gate — would need `toLifecycle`/`ChannelLifecycle` to carry "locked".
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
}

export function resolveChannelCta(
  channel: Pick<ChannelConfig, "status" | "dashboardPath" | "providerKey">,
  integration: { connected?: boolean } | undefined,
  staticDashboardPaths: ReadonlyMap<string, string> = STATIC_DASHBOARD_PATHS,
): ChannelCta {
  const isConnected =
    integration?.connected === true && channel.status !== "coming_soon";
  const dashboardPath =
    channel.dashboardPath ?? staticDashboardPaths.get(channel.providerKey);
  return { isConnected, dashboardPath };
}
