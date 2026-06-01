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
  TwitterIcon,
} from "@/components/ui/brand-icons";

/**
 * Maps a catalog integration's groupKey/key to a brand glyph + accent color.
 * The catalog carries a `display.brandColor`/`iconUrl`, but the landing uses
 * the hand-tuned brand SVGs; this is the bridge. Keyed by `groupKey` first
 * (linkedin_content + linkedin_ads → "linkedin"), then the raw key. Anything
 * unmapped falls back to a styled initial circle so a brand-new catalog row
 * still renders sensibly.
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
  x: { Icon: TwitterIcon, color: "bg-black" },
  x_ads: { Icon: TwitterIcon, color: "bg-black" },
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
  const brand = (groupKey && BRANDS[groupKey]) || BRANDS[integrationKey];
  if (brand) {
    const { Icon } = brand;
    return <Icon className={className} />;
  }
  // Fallback: first letter of the name (guard empty/whitespace names).
  return <span className="text-sm font-bold">{(name.trim()[0] ?? "?").toUpperCase()}</span>;
}

/** Tailwind bg class for the icon tile — the brand color, or a neutral that
 *  still contrasts with the tile's white foreground (the tile sets text-white,
 *  so the fallback must be dark enough; a `text-foreground` fallback rendered
 *  the initial white-on-light = invisible). */
export function integrationBrandColor(groupKey?: string, integrationKey?: string): string {
  const brand = (groupKey && BRANDS[groupKey]) || (integrationKey ? BRANDS[integrationKey] : undefined);
  return brand?.color ?? "bg-muted-foreground";
}
