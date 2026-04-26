/**
 * Channels Hub registry — single source of truth for the
 * /dashboard/content landing page.
 *
 * Each row pairs a provider with its display surface (where to deep-link
 * when connected) and lifecycle status. Adding a new channel means
 * adding one entry here and (for `live`) creating its dashboard route at
 * `dashboardPath`.
 */

export type ChannelCategory =
  | "Newsletters"
  | "Social"
  | "Web & SEO"
  | "Ads"
  | "Messaging";

export type ChannelLifecycle = "live" | "available" | "coming_soon";

export interface ChannelConfig {
  /** Stable slug — also used as URL segment when present */
  slug: string;
  /** Display name */
  name: string;
  /** One-line description rendered in the row */
  description: string;
  /** Tab grouping */
  category: ChannelCategory;
  /**
   * Provider key — matches `int_connections.provider` so the hub can look
   * up connection state. Same as the registry name in peakhour-api.
   */
  providerKey: string;
  /** Lifecycle stage */
  status: ChannelLifecycle;
  /** Path for the per-channel dashboard. Required when `status === "live"`. */
  dashboardPath?: string;
  /** Optional logo URL — falls back to a styled initial circle if absent. */
  logoUrl?: string;
  /** Apply `dark:invert` to the logo so it stays visible on dark backgrounds (e.g. X). */
  logoInvertOnDark?: boolean;
}

const SHADCN_LOGOS = "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos";

/**
 * Tab order on the hub. Matches the user's mental model: bring your own
 * audience first (newsletters), then earned/owned channels, then paid.
 */
export const CHANNEL_CATEGORIES: readonly ChannelCategory[] = [
  "Newsletters",
  "Social",
  "Web & SEO",
  "Ads",
  "Messaging",
] as const;

export const CHANNELS: readonly ChannelConfig[] = [
  // ── Newsletters ─────────────────────────────────────────────
  {
    slug: "beehiiv",
    name: "Beehiiv",
    description: "Auto-tag and analyze every Beehiiv send. Repurpose into social and ads.",
    category: "Newsletters",
    providerKey: "beehiiv",
    status: "live",
    dashboardPath: "/dashboard/content/beehiiv",
    logoUrl: `${SHADCN_LOGOS}/beehiiv-icon.svg`,
  },
  {
    slug: "substack",
    name: "Substack",
    description: "Publish, repurpose, and measure Substack newsletters.",
    category: "Newsletters",
    providerKey: "substack",
    status: "coming_soon",
  },
  {
    slug: "kit",
    name: "Kit (ConvertKit)",
    description: "Sync Kit broadcasts and turn them into multi-channel campaigns.",
    category: "Newsletters",
    providerKey: "kit",
    status: "coming_soon",
  },
  {
    slug: "mailchimp",
    name: "Mailchimp",
    description: "Pull Mailchimp campaigns and audiences for analysis.",
    category: "Newsletters",
    providerKey: "mailchimp",
    status: "coming_soon",
  },
  {
    slug: "ghost",
    name: "Ghost",
    description: "Sync Ghost newsletters and posts.",
    category: "Newsletters",
    providerKey: "ghost",
    status: "coming_soon",
  },

  // ── Social ──────────────────────────────────────────────────
  {
    slug: "linkedin",
    name: "LinkedIn",
    description: "Publish posts and articles, analyze reach.",
    category: "Social",
    providerKey: "linkedin_content",
    status: "available",
    logoUrl: `${SHADCN_LOGOS}/linkedin-icon.svg`,
  },
  {
    slug: "x",
    name: "X (Twitter)",
    description: "Schedule threads and posts; track impressions.",
    category: "Social",
    providerKey: "x",
    status: "available",
    logoUrl: `${SHADCN_LOGOS}/x-icon.svg`,
    logoInvertOnDark: true,
  },
  {
    slug: "facebook-pages",
    name: "Facebook Pages",
    description: "Post to Pages, sync insights.",
    category: "Social",
    // Virtual Meta capability — flattenMetaIntegration in lib/integrations-meta.ts
    // expands the parent `facebook` connection into per-capability rows so each
    // surface shows its own connection state.
    providerKey: "facebook_pages",
    status: "available",
    logoUrl: `${SHADCN_LOGOS}/facebook-icon.svg`,
  },
  {
    slug: "instagram",
    name: "Instagram",
    description: "Publish carousels and reels via Meta Graph API.",
    category: "Social",
    providerKey: "instagram",
    status: "available",
    logoUrl: `${SHADCN_LOGOS}/instagram-icon.svg`,
  },
  {
    slug: "youtube",
    name: "YouTube",
    description: "Pull video metadata and engagement for repurposing.",
    category: "Social",
    providerKey: "youtube",
    status: "coming_soon",
    logoUrl: `${SHADCN_LOGOS}/youtube-icon.svg`,
  },

  // ── Web & SEO ───────────────────────────────────────────────
  {
    slug: "wordpress",
    name: "WordPress",
    description: "Sync posts; auto-tag and propose topics.",
    category: "Web & SEO",
    providerKey: "wordpress",
    status: "coming_soon",
  },
  {
    slug: "shopify",
    name: "Shopify",
    description: "Pull products and blog posts for content engines.",
    category: "Web & SEO",
    providerKey: "shopify",
    status: "coming_soon",
  },
  {
    slug: "google-search-console",
    name: "Google Search Console",
    description: "Surface ranking gaps and refresh opportunities.",
    category: "Web & SEO",
    providerKey: "gsc",
    status: "coming_soon",
  },

  // ── Ads ─────────────────────────────────────────────────────
  {
    slug: "meta-ads",
    name: "Meta Ads",
    description: "Launch and optimize Facebook/Instagram campaigns.",
    category: "Ads",
    providerKey: "meta_ads",
    status: "available",
  },
  {
    slug: "google-ads",
    name: "Google Ads",
    description: "Run search and display campaigns from approved creative.",
    category: "Ads",
    providerKey: "google_ads",
    status: "coming_soon",
  },
  {
    slug: "linkedin-ads",
    name: "LinkedIn Ads",
    description: "Launch B2B campaigns from your repurposed posts.",
    category: "Ads",
    providerKey: "linkedin_ads",
    status: "coming_soon",
  },
  {
    slug: "x-ads",
    name: "X Ads",
    description: "Promote threads and posts on X.",
    category: "Ads",
    providerKey: "x_ads",
    status: "coming_soon",
  },

  // ── Messaging ───────────────────────────────────────────────
  {
    slug: "whatsapp",
    name: "WhatsApp Business",
    description: "Drive conversations from approved templates.",
    category: "Messaging",
    // Virtual Meta capability — see facebook-pages note above.
    providerKey: "whatsapp",
    status: "available",
  },
  {
    slug: "slack",
    name: "Slack",
    description: "Receive alerts and approve content from channels.",
    category: "Messaging",
    providerKey: "slack",
    status: "coming_soon",
    logoUrl: `${SHADCN_LOGOS}/slack-icon.svg`,
  },
];

// Dev-only invariant: every `live` channel must declare a `dashboardPath`.
// The hub's Manage CTA routes to that path — without it, the button no-ops.
// (Earlier code also referenced this for an auto-redirect, since removed.)
if (process.env.NODE_ENV !== "production") {
  for (const channel of CHANNELS) {
    if (channel.status === "live" && !channel.dashboardPath) {
      throw new Error(
        `[channels.config] live channel "${channel.slug}" is missing dashboardPath`,
      );
    }
  }
}
