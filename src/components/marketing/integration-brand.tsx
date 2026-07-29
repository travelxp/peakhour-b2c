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
 *
 * Sibling rows in one brand family (google_business_profile / gsc / google_ads;
 * facebook_pages / meta_ads; x / x_ads) intentionally share their brand's mark —
 * that IS the brand's mark, and every card is labelled with its own product
 * name. Only give a sibling its own entry when it has a genuinely distinct
 * official mark.
 */
/**
 * `color` carries BOTH the tile background and its foreground. The foreground
 * must live here, not on the tile element: a `text-black` in this string and a
 * `text-white` on the element are the same specificity, so the winner is
 * stylesheet order (Tailwind emits `.text-white` after `.text-black`), not
 * attribute order — which silently left the yellow Beehiiv/Mailchimp marks
 * white-on-yellow at ~1.1:1. Every entry states its own foreground.
 */
type Brand = { Icon: ComponentType<{ className?: string }>; color: string };

const BRANDS: Record<string, Brand> = {
  linkedin: { Icon: LinkedinIcon, color: "bg-[#0A66C2] text-white" },
  linkedin_content: { Icon: LinkedinIcon, color: "bg-[#0A66C2] text-white" },
  linkedin_ads: { Icon: LinkedinIcon, color: "bg-[#0A66C2] text-white" },
  facebook: { Icon: FacebookIcon, color: "bg-[#0668E1] text-white" },
  meta: { Icon: FacebookIcon, color: "bg-[#0668E1] text-white" },
  meta_ads: { Icon: FacebookIcon, color: "bg-[#0668E1] text-white" },
  instagram: { Icon: InstagramIcon, color: "bg-[#E4405F] text-white" },
  google: { Icon: GoogleIcon, color: "bg-[#4285F4] text-white" },
  google_ads: { Icon: GoogleIcon, color: "bg-[#4285F4] text-white" },
  youtube: { Icon: YoutubeIcon, color: "bg-[#FF0000] text-white" },
  beehiiv: { Icon: BeehiivIcon, color: "bg-[#FFD100] text-black" },
  substack: { Icon: SubstackIcon, color: "bg-[#FF6719] text-white" },
  mailchimp: { Icon: MailchimpIcon, color: "bg-[#FFE01B] text-black" },
  shopify: { Icon: ShopifyIcon, color: "bg-[#96BF48] text-black" },
  wordpress: { Icon: WordPressIcon, color: "bg-[#21759B] text-white" },
  // WooCommerce ships inside the `wordpress` connector (one plugin covers
  // both) and has no catalog row of its own today. Kept as forward-compat
  // spellings so a future standalone row can't fall through to a "W" initial.
  woocommerce: { Icon: WooCommerceIcon, color: "bg-[#873EFF] text-white" },
  woo: { Icon: WooCommerceIcon, color: "bg-[#873EFF] text-white" },
  whatsapp: { Icon: WhatsAppIcon, color: "bg-[#25D366] text-black" },
  whatsapp_business: { Icon: WhatsAppIcon, color: "bg-[#25D366] text-black" },
  x: { Icon: TwitterIcon, color: "bg-black text-white" },
  x_ads: { Icon: TwitterIcon, color: "bg-black text-white" },
  // Newsletter/messaging rows that carry no groupKey — without these they fall
  // through to the grey initial tile next to hand-tuned marks. Both are
  // `coming_soon` in prod, so they DO render on the public grid.
  ghost: { Icon: GhostIcon, color: "bg-[#15171A] text-white" },
  slack: { Icon: SlackIcon, color: "bg-[#4A154B] text-white" },
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

/** Tailwind background + foreground classes for the icon tile. Unmapped rows
 *  get a fixed dark neutral (~6:1 vs white in both themes) rather than a
 *  theme-relative token (`muted`/`primary`), which would invert to a light
 *  value in dark mode and fail contrast against the white glyph. */
export function integrationBrandColor(groupKey?: string, integrationKey?: string): string {
  const brand =
    (integrationKey ? BRANDS[integrationKey] : undefined) || (groupKey ? BRANDS[groupKey] : undefined);
  return brand?.color ?? "bg-zinc-700 text-white";
}
