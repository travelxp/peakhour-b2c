/**
 * Local, self-hosted brand logos for channels the CMS catalog has no
 * `display.iconUrl` for.
 *
 * The Channels hub renders `cfg_integrations.display.iconUrl` when it's set and
 * otherwise fell through to a grey square holding the channel's first letter
 * ("W" for WhatsApp, "S" for Shopify). These are the official marks, checked
 * into `public/brands/` rather than pulled from a CDN so they can't 404 or be
 * blocked. Setting `display.iconUrl` in the CMS still wins — this is only the
 * floor, so a new catalog row never regresses to an initial.
 *
 * Keyed by `int_connections.provider` / `cfg_integrations.key`.
 */
export const LOCAL_BRAND_LOGOS: Record<string, string> = {
  whatsapp: "/brands/whatsapp.svg",
  whatsapp_business: "/brands/whatsapp.svg",
  shopify: "/brands/shopify.svg",
  wordpress: "/brands/wordpress.svg",
  woocommerce: "/brands/woocommerce.svg",
  woo: "/brands/woocommerce.svg",
};

/** Resolve a channel's logo: catalog-provided URL first, local mark as floor. */
export function resolveBrandLogo(
  key: string | undefined,
  catalogIconUrl?: string,
): string | undefined {
  if (catalogIconUrl) return catalogIconUrl;
  return key ? LOCAL_BRAND_LOGOS[key] : undefined;
}
