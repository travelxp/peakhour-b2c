/**
 * Display names for the provider slugs the api's OAuth callback hands
 * back via `?integration=connected&provider=<slug>`.
 *
 * Extracted from dashboard/settings/page.tsx when the callback stopped
 * always landing on Settings (`?returnTo=`): more than one surface now
 * renders "<provider> connected", and two copies of this table would
 * drift the moment a provider is added.
 *
 * Source of truth for the canonical labels is each provider's
 * `displayName` in peakhour-api/src/v1/integrations/providers/*.
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  x: "X (Twitter)",
  x_ads: "X Ads",
  linkedin_content: "LinkedIn",
  linkedin_ads: "LinkedIn Ads",
  facebook: "Meta",
  meta_ads: "Meta Ads",
  instagram: "Instagram",
  youtube: "YouTube",
  beehiiv: "Beehiiv",
  substack: "Substack",
  kit: "Kit",
  mailchimp: "Mailchimp",
  ghost: "Ghost",
  wordpress: "WordPress",
  shopify: "Shopify",
  discord: "Discord",
  slack: "Slack",
  teams: "Microsoft Teams",
  telegram: "Telegram",
  google_ads: "Google Ads",
  google_analytics: "Google Analytics",
  google_search_console: "Google Search Console",
  google_business_profile: "Google Business Profile",
};

/** Unknown slugs fall through to a title-cased fallback so a brand-new
 *  provider never renders "undefined" — it just looks a bit raw until
 *  added to the table above. */
export function formatProviderName(slug: string): string {
  if (!slug) return "Account";
  return (
    PROVIDER_DISPLAY_NAMES[slug] ??
    slug
      .split("_")
      .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ")
  );
}
