/**
 * Human-readable labels for universal enums and content categories.
 *
 * Sector, audience, content type, and ad angle labels are now DYNAMIC —
 * they come from the org's taxonomy via the API. The `label()` function's
 * fallback (title-case the raw value) handles any value gracefully.
 */

/** Content category labels (universal, not org-specific) */
export const CONTENT_CATEGORY_LABELS: Record<string, string> = {
  newsletter: "Newsletters",
  blog_post: "Blog Posts",
  social_post: "Social Posts",
  video: "Videos",
  podcast: "Podcasts",
  press_release: "Press Releases",
  product_page: "Product Pages",
  review: "Reviews",
  case_study: "Case Studies",
  email_campaign: "Email Campaigns",
  webpage: "Web Pages",
  whitepaper: "Whitepapers",
  webinar: "Webinars",
  infographic: "Infographics",
  other: "Other",
};

/** Sentiment config with colors (universal) */
export const SENTIMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  bullish: { label: "Bullish", color: "text-success-on-tint", bg: "bg-success/15" },
  bearish: { label: "Bearish", color: "text-destructive-on-tint", bg: "bg-destructive/15" },
  cautious: { label: "Cautious", color: "text-warning-on-tint", bg: "bg-warning/15" },
  neutral: { label: "Neutral", color: "text-foreground", bg: "bg-muted" },
  mixed: { label: "Mixed", color: "text-state-progress-on-tint", bg: "bg-state-progress/15" },
};

/** Shelf life labels (universal) */
export const SHELF_LIFE_LABELS: Record<string, string> = {
  "24h": "24 Hours",
  "1week": "1 Week",
  "1month": "1 Month",
  evergreen: "Evergreen",
};

/**
 * Get a human-readable label for any taxonomy value.
 * Works with both static maps and dynamic org taxonomy values.
 * Falls back to title-casing the raw value (e.g., "hotels_hospitality" → "Hotels Hospitality").
 */
export function label(map: Record<string, string> | undefined, key: string | undefined | null): string {
  if (!key) return "—";
  if (map && map[key]) return map[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
