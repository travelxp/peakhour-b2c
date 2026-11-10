import type { ComponentType, CSSProperties } from "react";
import { brandTileStyle } from "@/components/brand/brand-colors";
import {
  LinkedinIcon,
  FacebookIcon,
  InstagramIcon,
  GoogleIcon,
  YoutubeIcon,
  BeehiivIcon,
  SubstackIcon,
  MailchimpIcon,
  ShopifyIcon,
  WordPressIcon,
  WooCommerceIcon,
  WhatsAppIcon,
  TwitterIcon,
  GhostIcon,
  SlackIcon,
} from "@/components/brand/brand-icons";

/**
 * Maps a catalog integration's key/groupKey to a brand glyph + accent color.
 * The catalog carries a `display.brandColor`/`iconUrl`, but the landing uses
 * the hand-tuned brand SVGs; this is the bridge.
 *
 * The integration's own KEY wins, with `groupKey` as the fallback for keys we
 * haven't mapped (facebook_pages → "meta", gsc → "google"). Group-first was
 * wrong: groupKey is a provider grouping, so WhatsApp and Instagram — both
 * under "meta" — rendered the Facebook glyph. Anything unmapped falls back to
 * a styled initial so a brand-new catalog row still renders sensibly.
 *
 * Sibling rows in one brand family (google_business_profile / gsc / google_ads;
 * facebook_pages / meta_ads; x / x_ads) intentionally share their brand's mark —
 * that IS the brand's mark, and every card is labelled with its own product
 * name. Only give a sibling its own entry when it has a genuinely distinct
 * official mark.
 */
/**
 * `tile` carries BOTH the tile background and its foreground (inline style, so
 * no class-order race: an earlier `text-black` / `text-white` pair was resolved
 * by stylesheet order and silently left the yellow Beehiiv/Mailchimp marks
 * white-on-yellow at ~1.1:1). Every entry states its own foreground.
 */
type Brand = { Icon: ComponentType<{ className?: string }>; tile: CSSProperties };

const BRANDS: Record<string, Brand> = {
  linkedin: { Icon: LinkedinIcon, tile: brandTileStyle("linkedin") },
  linkedin_content: { Icon: LinkedinIcon, tile: brandTileStyle("linkedin") },
  linkedin_ads: { Icon: LinkedinIcon, tile: brandTileStyle("linkedin") },
  facebook: { Icon: FacebookIcon, tile: brandTileStyle("meta") },
  meta: { Icon: FacebookIcon, tile: brandTileStyle("meta") },
  meta_ads: { Icon: FacebookIcon, tile: brandTileStyle("meta") },
  instagram: { Icon: InstagramIcon, tile: brandTileStyle("instagram") },
  google: { Icon: GoogleIcon, tile: brandTileStyle("google") },
  google_ads: { Icon: GoogleIcon, tile: brandTileStyle("google") },
  youtube: { Icon: YoutubeIcon, tile: brandTileStyle("youtube") },
  beehiiv: { Icon: BeehiivIcon, tile: brandTileStyle("beehiiv", "dark") },
  substack: { Icon: SubstackIcon, tile: brandTileStyle("substack") },
  mailchimp: { Icon: MailchimpIcon, tile: brandTileStyle("mailchimp", "dark") },
  shopify: { Icon: ShopifyIcon, tile: brandTileStyle("shopify", "dark") },
  wordpress: { Icon: WordPressIcon, tile: brandTileStyle("wordpress") },
  // WooCommerce ships inside the `wordpress` connector (one plugin covers
  // both) and has no catalog row of its own today. Kept as forward-compat
  // spellings so a future standalone row can't fall through to a "W" initial.
  woocommerce: { Icon: WooCommerceIcon, tile: brandTileStyle("woocommerce") },
  woo: { Icon: WooCommerceIcon, tile: brandTileStyle("woocommerce") },
  whatsapp: { Icon: WhatsAppIcon, tile: brandTileStyle("whatsapp", "dark") },
  whatsapp_business: { Icon: WhatsAppIcon, tile: brandTileStyle("whatsapp", "dark") },
  x: { Icon: TwitterIcon, tile: brandTileStyle("x") },
  x_ads: { Icon: TwitterIcon, tile: brandTileStyle("x") },
  // Newsletter/messaging rows that carry no groupKey — without these they fall
  // through to the grey initial tile next to hand-tuned marks. Both are
  // `coming_soon` in prod, so they DO render on the public grid.
  ghost: { Icon: GhostIcon, tile: brandTileStyle("ghost") },
  slack: { Icon: SlackIcon, tile: brandTileStyle("slack") },
};

export function IntegrationBrandIcon({
  groupKey,
  integrationKey,
  name,
  className = "h-5 w-5",
}: {
  groupKey?: string;
  integrationKey: string;
  name: string;
  className?: string;
}) {
  const brand = BRANDS[integrationKey] || (groupKey ? BRANDS[groupKey] : undefined);
  if (brand) {
    const { Icon } = brand;
    return <Icon className={className} />;
  }
  // Fallback: first letter of the name (guard empty/whitespace names).
  return <span className="text-sm font-bold">{(name.trim()[0] ?? "?").toUpperCase()}</span>;
}

/** Background + foreground for the icon tile, as an inline style (the colours
 *  live in brand-colors.ts). Unmapped rows get a fixed dark neutral
 *  (`bg-ink-2 text-white`, ~6:1 in both themes) rather than a theme-relative
 *  token (`muted`/`primary`), which would invert to a light value in dark mode
 *  and fail contrast against the white glyph. */
export function integrationBrandTile(
  groupKey?: string,
  integrationKey?: string,
): { className: string; style?: CSSProperties } {
  const brand =
    (integrationKey ? BRANDS[integrationKey] : undefined) || (groupKey ? BRANDS[groupKey] : undefined);
  return brand ? { className: "", style: brand.tile } : { className: "bg-ink-2 text-white" };
}
