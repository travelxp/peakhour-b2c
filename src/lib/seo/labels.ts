import type { PageRecord } from "./types";

/*
 * The short name a page goes by when it is a card or a link inside another page. The SEO title is written for a
 * search result ("Meta Ads integration: list and pause campaigns | Peakhour"), so it must never be printed on a card:
 * the pipe and the site suffix leak. A card says "Meta Ads".
 */
const SHORT: Record<string, string> = {
  home: "Home",
  "integrations.whatsapp": "WhatsApp Business",
  "integrations.linkedin": "LinkedIn",
  "integrations.x": "X",
  "integrations.beehiiv": "Beehiiv",
  "integrations.meta.ads": "Meta Ads",
  "integrations.instagram": "Instagram",
  "integrations.facebook": "Facebook Pages",
  "integrations.google.business.profile": "Google Business Profile",
  "integrations.x.ads": "X Ads",
  "integrations.google.ads": "Google Ads",
  "integrations.google.search.console": "Google Search Console",
  "integrations.linkedin.ads": "LinkedIn Ads",
  "shopify.features.ai.shopping.assistant": "AI shopping assistant",
  "shopify.features.whatsapp.ai.shopping": "WhatsApp AI shopping",
  "shopify.features.product.recommendations": "Product recommendations",
  "shopify.features.frequently.bought.together": "Frequently bought together",
  "shopify.features.whatsapp.cod.confirmation": "WhatsApp COD confirmation",
  "shopify.features.ai.seo": "AI SEO",
  "shopify.features.ai.product.descriptions": "AI product descriptions",
  // SF-2: the remaining Shopify feature pages.
  "shopify.features.cart.upsells": "Cart and thank-you upsells",
  "shopify.features.merchandising.ab.testing": "Shelf A/B testing",
  "shopify.features.inventory.alerts": "Stock-out alerts",
  "shopify.features.automatic.markdowns": "Markdown suggestions",
  "shopify.features.ai.blog.generator": "AI blog writer",
  "shopify.features.seo.audit": "Catalogue and SEO audit",
  "shopify.features.customer.conversation.insights": "Shopper questions",
  "shopify.features.ai.growth.campaigns": "Campaign discounts",
  "shopify.features.product.finder": "Find my match",
  "shopify.features.bundles": "Buy together and save",
  "features.google.business.profile.management": "Google Business Profile management",
  "features.review.management": "Review replies",
  "features.local.listing.health": "Listing health",
  "features.brand.voice": "Brand voice",
  "features.social.media.content": "Social media publishing",
  "features.newsletter.writer": "Beehiiv newsletters",
  "features.ai.blog.writer": "AI blog writer",
};

/** The site suffix an SEO title carries: " | Peakhour", " | Peakhour.ai", " - Peakhour", " — Peakhour.ai". */
const SITE_SUFFIX = /(\s*\|\s*|\s+[—–-]\s+)Peakhour(\.ai)?\s*$/i;

/** A card label for a page: the registry's short name when it has one, else the title with the suffix and the strapline cut. */
export function cardLabel(page: Pick<PageRecord, "pageId" | "title">): string {
  const short = SHORT[page.pageId];
  if (short) return short;
  const bare = page.title.replace(SITE_SUFFIX, "");
  const head = bare.split(":")[0]?.trim();
  return head || bare;
}
