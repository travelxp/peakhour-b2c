import type { ComponentType, CSSProperties } from "react";
import { brandTileStyle } from "@/components/brand/brand-colors";
import {
  LinkedinIcon,
  FacebookIcon,
  InstagramIcon,
  BeehiivIcon,
  TwitterIcon,
  WhatsAppIcon,
} from "@/components/brand/brand-icons";

/**
 * Degraded-mode fallback for the homepage integrations grid — rendered ONLY
 * when the catalog API is unreachable or publishes nothing, so the section
 * can't fail into a heading over an empty grid.
 *
 * These cards carry no "Coming soon" badge, and an unbadged card under
 * "Plugged into the tools you already use" reads as available TODAY — the
 * strongest claim on the page. So the list is restricted to connectors that
 * are actually `live` in the production catalog. Anything coming_soon is
 * deliberately absent: without the catalog we can't badge it honestly, and a
 * silent promise is worse than a shorter list. Re-check against
 * /v1/platform/catalog when connectors go live.
 *
 * It lives in lib/ rather than in page.tsx because the pillar chips have to
 * agree with it. When the catalog is gone, "what does this page still claim
 * is live" has exactly one answer, and both surfaces read it from here — see
 * badgedComingSoonKeys(). Two hand-maintained copies of that answer is the
 * failure this whole area is about.
 */
export interface FallbackIntegration {
  /** Catalog key, so the chips can resolve against the same list. */
  key: string;
  name: string;
  icon: ComponentType<{ className?: string }>;
  /** Inline style for the brand tile (colours live in brand-colors.ts). */
  tile: CSSProperties;
  description: string;
}

export const STATIC_FALLBACK_INTEGRATIONS: readonly FallbackIntegration[] = [
  { key: "whatsapp", name: "WhatsApp Business", icon: WhatsAppIcon, tile: brandTileStyle("whatsapp", "dark"), description: "Conversations & storefront chat" },
  { key: "instagram", name: "Instagram", icon: InstagramIcon, tile: brandTileStyle("instagram"), description: "Reels, stories & ads" },
  { key: "facebook_pages", name: "Facebook Pages", icon: FacebookIcon, tile: brandTileStyle("meta"), description: "Pages, posts & insights" },
  { key: "meta_ads", name: "Meta Ads", icon: FacebookIcon, tile: brandTileStyle("meta"), description: "Facebook & Instagram campaigns" },
  { key: "linkedin_content", name: "LinkedIn", icon: LinkedinIcon, tile: brandTileStyle("linkedin"), description: "Organic posts & Lead Gen" },
  { key: "x", name: "X (Twitter)", icon: TwitterIcon, tile: brandTileStyle("x"), description: "Posts & mentions inbox" },
  { key: "x_ads", name: "X Ads", icon: TwitterIcon, tile: brandTileStyle("x"), description: "Promoted posts & campaigns" },
  { key: "beehiiv", name: "Beehiiv", icon: BeehiivIcon, tile: brandTileStyle("beehiiv", "dark"), description: "Newsletter import" },
] as const;

/** The same list as keys — everything the page still calls live with no catalog. */
export const STATIC_FALLBACK_KEYS: ReadonlySet<string> = new Set(
  STATIC_FALLBACK_INTEGRATIONS.map((i) => i.key),
);
