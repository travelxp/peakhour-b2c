import { CHANNELS, type ChannelConfig } from "./channels.config";
import { hasConnection } from "@/lib/integration-card-state";

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
 *    linkedin_content) read as "Connect".
 *
 *    ★`coming_soon` USED TO BE EXCLUDED TOO, on the reasoning that "a
 *    not-yet-launched channel can't have a real connection". That is false,
 *    and shopify is the counter-example: App Store installs land through
 *    `GET /v1/integrations/shopify/install`, which never consults a lifecycle,
 *    so a production merchant CAN hold one.
 *
 *    Where it bites, precisely: prod's `cfg_integrations.shopify` is
 *    `status: "live"`, `visibility: "beta_orgs_only"`, `orgAllowlist: []`
 *    (verified against the live catalog). An empty allowlist means the
 *    resolver returns null for EVERY org, so the CMS catalog carries no
 *    shopify row at all and the hub renders none — until an org is invited,
 *    at which point the row resolves `connectable` and behaves. The broken
 *    path is the STATIC fallback in channels.config.ts, which the hub uses
 *    whenever the catalog fetch fails and which carries
 *    `status: "coming_soon"`. There the connected merchant got a disabled
 *    "Coming soon" row with no Connected badge.
 *  - `showsComingSoon`: whether to PRESENT the row as not-yet-launched —
 *    disabled, badged and labelled "Coming soon". Separate from `isConnected`
 *    because the two answer different questions, and conflating them is the
 *    whole bug: `isConnected` drives the "Connected" badge and needs
 *    `connected` (status === "active"), while this needs mere EXISTENCE of a
 *    connection. A merchant in `needs_reauth` is not connected, but the row
 *    must still be reachable so they can get to the fix. Shares
 *    `hasConnection` with `lib/integration-card-state.ts` so this surface and
 *    the integrations grid cannot drift apart again.
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
 *  - shopify, whose install and reconnect both run through Shopify's own
 *    surfaces (App Store listing / admin) and whose Peakhour-side state —
 *    Reconnect, lastError, Disconnect — lives on that same card. It has no
 *    dashboardPath in either source, so without this entry a CONNECTED
 *    shopify row would be reported as a config gap the moment the row became
 *    reachable; it is a designed state, not a gap.
 * Anything ELSE that ends up connected without a dashboardPath is a config gap
 * (see `configGap`), not a designed state.
 */
export const INTEGRATIONS_MANAGED_PROVIDERS: ReadonlySet<string> = new Set([
  "facebook_pages",
  "instagram",
  "meta_ads",
  "wordpress",
  "shopify",
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
  /**
   * Present the row as not-yet-launched: disabled, badged and labelled
   * "Coming soon". True only when the lifecycle says coming_soon AND this org
   * holds no connection of any kind. See the header note on why this is a
   * different question from `isConnected`.
   */
  showsComingSoon: boolean;
}

export function resolveChannelCta(
  channel: Pick<ChannelConfig, "status" | "dashboardPath" | "providerKey">,
  integration: { connected?: boolean; status?: string } | undefined,
  staticDashboardPaths: ReadonlyMap<string, string> = STATIC_DASHBOARD_PATHS,
): ChannelCta {
  // The org's own connection, and nothing else. A channel's catalog lifecycle
  // says whether we are SELLING it, never whether this org already has it.
  const isConnected = integration?.connected === true;
  // ★EXISTENCE, not activeness — `connected` is `status === "active"`, so
  // keying the signpost off it would leave a needs_reauth / expired / error
  // merchant with a disabled "Coming soon" row: the exact bug this fixes on
  // the integrations grid, reproduced one surface over.
  const showsComingSoon =
    channel.status === "coming_soon" && !hasConnection(integration?.status);
  // `||`, not `??`: an operator can blank a CMS display.dashboardPath to "",
  // which must fall through to the static path rather than count as "set"
  // (channels-from-catalog.ts makes the same truthiness choice for tagline).
  const dashboardPath =
    channel.dashboardPath || staticDashboardPaths.get(channel.providerKey);
  return {
    isConnected,
    showsComingSoon,
    dashboardPath,
    manageViaIntegrations: isConnected && !dashboardPath,
    // `!showsComingSoon`, not `status !== "coming_soon"`: the clause exists
    // because a not-yet-launched row has nothing to route to, and that stops
    // being true the moment the row becomes actionable for a connected org —
    // which is exactly the shape configGap is for. Keying it off the presented
    // state keeps it silent for the eight genuinely-unlaunched rows (dropping
    // the clause outright would fire eight console.errors per mount in dev)
    // while still catching a connected coming-soon channel with no path.
    configGap:
      !dashboardPath &&
      !showsComingSoon &&
      !INTEGRATIONS_MANAGED_PROVIDERS.has(channel.providerKey),
  };
}
