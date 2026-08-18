/**
 * How an integration card presents itself, derived from the one connection
 * row `GET /v1/integrations` resolves for that provider.
 *
 * This lives outside the card because the two facts it combines come from
 * different places and had drifted apart: `availability` is a CATALOG fact
 * about the provider (the same value for every org), while `status` is a
 * CONNECTION fact about this business. Reading the catalog fact alone is what
 * let real connections render as a coming-soon signpost — see
 * `showsComingSoon` below.
 */

/**
 * Connection states that still hold a token, but a token the provider will no
 * longer accept. These are recoverable: a fresh authorization replaces it.
 */
export const RECOVERABLE_STATUSES: readonly string[] = [
  "needs_reauth",
  "expired",
  "error",
];

/**
 * True when a connection EXISTS for this provider but is not usable — the
 * card owes the merchant a Reconnect button and the `lastError` behind it.
 */
export function isRecoverableStatus(status: string | undefined): boolean {
  return RECOVERABLE_STATUSES.includes(status ?? "");
}

/**
 * True when this business has a connection row worth showing — of ANY
 * activeness. `disconnected` is deliberately excluded: its credentials are
 * wiped, so reconnecting it is a fresh CONNECT, and a gate on new connections
 * applies to it exactly as it does to a provider never connected at all.
 */
export function hasConnection(status: string | undefined): boolean {
  return Boolean(status) && status !== "disconnected";
}

/**
 * True when the card should present itself as a coming-soon signpost — dimmed
 * to 50%, badged "Soon", and showing static copy in place of its connect
 * controls.
 *
 * ★A `coming_soon` provider can still hold a real connection. Shopify installs
 * arrive through the App Store path (`GET /v1/integrations/shopify/install` →
 * callback), which never consults `availability`, while the dashboard card
 * reads `availability` verbatim and so reports "coming soon" to every prod
 * org, invited ones included. Keyed on availability ALONE this broke both
 * connection states a prod merchant can be in:
 *
 *   • needs_reauth / expired / error → collapsed to bare "Coming soon",
 *     losing the Reconnect button and the `lastError` that explained why.
 *   • active → still dimmed to 50% and badged "Soon", contradicting the
 *     green "Live" badge and success ring rendering beside it.
 *
 * So the signpost tests whether a connection EXISTS, not whether it is active.
 */
export function showsComingSoon(
  availability: string | undefined,
  status: string | undefined,
): boolean {
  return availability === "coming_soon" && !hasConnection(status);
}
