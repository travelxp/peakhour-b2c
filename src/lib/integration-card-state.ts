/**
 * How an integration card presents itself, derived from the connection row
 * `GET /v1/integrations` resolves for that provider.
 *
 * This lives outside the card because the two facts it combines come from
 * different places and had drifted apart: `availability` is a CATALOG fact
 * about the provider (the same value for every org), while `status` is a
 * CONNECTION fact about this business. Reading the catalog fact alone is what
 * let real connections render as a coming-soon signpost — see
 * `showsComingSoon` below.
 *
 * ★ON THE META VIRTUAL CARDS, `status` IS NOT THIS CARD'S OWN. The four
 * capability rows (facebook_pages, instagram, meta_ads, whatsapp) are expanded
 * from ONE `facebook` connection by `integrations-meta.ts`, which spreads the
 * parent row and recomputes `connected` per capability but leaves `status`
 * as the parent's. So a capability with no resources can read
 * `status: "active"`, `connected: false`. Nothing here is wrong today, because
 * `facebook.provider.ts` is `availability: "available"` and the coming-soon
 * branch is never taken for those cards. It would stop being true the day the
 * Meta providers get the same env gate the commerce ones carry — at which
 * point these helpers need `connected` as well, not just `status`.
 */

/**
 * Connection states that still hold a token, but a token the provider will no
 * longer accept. These are recoverable: a fresh authorization replaces it.
 */
export const RECOVERABLE_STATUSES = ["needs_reauth", "expired", "error"] as const;

/**
 * Every state in which a connection row HOLDS credentials. `disconnected` is
 * deliberately absent — `DELETE /v1/integrations/:provider` wipes the
 * credentials (`$unset: { credentials: "" }`), so reconnecting it is a fresh
 * CONNECT, and a gate on new connections applies to it exactly as it does to a
 * provider that was never connected at all.
 *
 * ★A CLOSED SET, ON PURPOSE. The obvious alternative — "anything that isn't
 * `disconnected` or absent" — is an open deny-list, and it fails in the wrong
 * direction: a status this file has never heard of would count as a live
 * connection, suppress the coming-soon signpost, and (not being recoverable
 * either) render an enabled Connect button that 400s `COMING_SOON` against a
 * gated provider. Listing the states positively means an unrecognized one
 * falls back to the signpost, which is inert. The union is closed at five
 * values in `schemas/zod/db/_common.zod.ts` (`zConnectionStatus`); if the API
 * adds a sixth, it belongs in one of these two lists by hand.
 */
export const CONNECTED_STATUSES = ["active", ...RECOVERABLE_STATUSES] as const;

/**
 * True when a connection EXISTS for this provider but is not usable — the
 * card owes the merchant a Reconnect button and the `lastError` behind it.
 */
export function isRecoverableStatus(status: string | undefined): boolean {
  return (RECOVERABLE_STATUSES as readonly string[]).includes(status ?? "");
}

/**
 * True when this business holds a connection for the provider, of ANY
 * activeness — healthy or broken.
 */
export function hasConnection(status: string | undefined): boolean {
  return (CONNECTED_STATUSES as readonly string[]).includes(status ?? "");
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
