import type { ComponentType } from "react";
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
  color: string;
  description: string;
}

export const STATIC_FALLBACK_INTEGRATIONS: readonly FallbackIntegration[] = [
  { key: "whatsapp", name: "WhatsApp Business", icon: WhatsAppIcon, color: "bg-[#25D366] text-black", description: "Conversations & storefront chat" },
  { key: "instagram", name: "Instagram", icon: InstagramIcon, color: "bg-[#E4405F] text-white", description: "Reels, stories & ads" },
  { key: "facebook_pages", name: "Facebook Pages", icon: FacebookIcon, color: "bg-[#0668E1] text-white", description: "Pages, posts & insights" },
  { key: "meta_ads", name: "Meta Ads", icon: FacebookIcon, color: "bg-[#0668E1] text-white", description: "Facebook & Instagram campaigns" },
  { key: "linkedin_content", name: "LinkedIn", icon: LinkedinIcon, color: "bg-[#0A66C2] text-white", description: "Organic posts & Lead Gen" },
  { key: "x", name: "X (Twitter)", icon: TwitterIcon, color: "bg-black text-white", description: "Posts & mentions inbox" },
  { key: "x_ads", name: "X Ads", icon: TwitterIcon, color: "bg-black text-white", description: "Promoted posts & campaigns" },
  { key: "beehiiv", name: "Beehiiv", icon: BeehiivIcon, color: "bg-[#FFD100] text-black", description: "Newsletter import" },
] as const;

/** The same list as keys — everything the page still calls live with no catalog. */
export const STATIC_FALLBACK_KEYS: ReadonlySet<string> = new Set(
  STATIC_FALLBACK_INTEGRATIONS.map((i) => i.key),
);
