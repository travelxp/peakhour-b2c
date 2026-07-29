import type { ComponentType } from "react";
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
} from "@/components/ui/brand-icons";

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
 */
type Brand = { Icon: ComponentType<{ className?: string }>; color: string };

const BRANDS: Record<string, Brand> = {
  linkedin: { Icon: LinkedinIcon, color: "bg-[#0A66C2]" },
  linkedin_content: { Icon: LinkedinIcon, color: "bg-[#0A66C2]" },
  linkedin_ads: { Icon: LinkedinIcon, color: "bg-[#0A66C2]" },
  facebook: { Icon: FacebookIcon, color: "bg-[#0668E1]" },
  meta: { Icon: FacebookIcon, color: "bg-[#0668E1]" },
  meta_ads: { Icon: FacebookIcon, color: "bg-[#0668E1]" },
  instagram: { Icon: InstagramIcon, color: "bg-[#E4405F]" },
  google: { Icon: GoogleIcon, color: "bg-[#4285F4]" },
  google_ads: { Icon: GoogleIcon, color: "bg-[#4285F4]" },
  youtube: { Icon: YoutubeIcon, color: "bg-[#FF0000]" },
  beehiiv: { Icon: BeehiivIcon, color: "bg-[#FFD100] text-black" },
  substack: { Icon: SubstackIcon, color: "bg-[#FF6719]" },
  mailchimp: { Icon: MailchimpIcon, color: "bg-[#FFE01B] text-black" },
  shopify: { Icon: ShopifyIcon, color: "bg-[#96BF48]" },
  wordpress: { Icon: WordPressIcon, color: "bg-[#21759B]" },
  // The catalog ships WooCommerce under the `wordpress` connector (one plugin
  // covers both), but a standalone row/groupKey also exists — map every spelling
  // so neither ever falls through to the "W" initial.
  woocommerce: { Icon: WooCommerceIcon, color: "bg-[#873EFF]" },
  woo: { Icon: WooCommerceIcon, color: "bg-[#873EFF]" },
  whatsapp: { Icon: WhatsAppIcon, color: "bg-[#25D366]" },
  whatsapp_business: { Icon: WhatsAppIcon, color: "bg-[#25D366]" },
  x: { Icon: TwitterIcon, color: "bg-black" },
  x_ads: { Icon: TwitterIcon, color: "bg-black" },
  // Newsletter/messaging rows that carry no groupKey — without these they fall
  // through to the grey initial tile next to hand-tuned marks. Both are
  // `coming_soon` in prod, so they DO render on the public grid.
  ghost: { Icon: GhostIcon, color: "bg-[#15171A]" },
  slack: { Icon: SlackIcon, color: "bg-[#4A154B]" },
};

/**
 * Sibling rows in the same brand family (google_business_profile / gsc /
 * google_ads; facebook_pages / meta_ads; x / x_ads) intentionally share their
 * brand's mark — that IS the brand's mark, and each card is labelled with its
 * own product name. Only give a sibling its own entry when the product has a
 * genuinely distinct official mark.
 */

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

/** Tailwind bg class for the icon tile — the brand color, or a neutral that
 *  contrasts with the tile's white foreground in BOTH themes. A theme-relative
 *  token (`muted`/`primary`) inverts to a light value in dark mode and fails
 *  contrast against the tile's hardcoded `text-white`, so use a fixed dark
 *  neutral (~6:1 vs white in both themes). */
export function integrationBrandColor(groupKey?: string, integrationKey?: string): string {
  const brand =
    (integrationKey ? BRANDS[integrationKey] : undefined) || (groupKey ? BRANDS[groupKey] : undefined);
  return brand?.color ?? "bg-zinc-700";
}
