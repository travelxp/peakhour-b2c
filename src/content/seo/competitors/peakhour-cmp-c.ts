import type { PeakhourClaim } from "./types";

const OBSERVED = "2026-11-16";
const src = (href: string, label: string) => ({ source: { href, label }, observedAt: OBSERVED });

/**
 * CMP-C: more Peakhour claims, each resting on a capability whose approved claim in src/lib/seo/capabilities.ts
 * covers it. The note never goes beyond the approved text. A cell with no capability is `pending()` (Unknown).
 */
export const PEAKHOUR_C = {
  frequentlyBought: {
    value: "yes",
    capabilityId: "commerce.frequently_bought_together",
    note: "Works out which products are bought together from your own Shopify orders every night, and can show them as a shelf on the product page.",
    ...src("/shopify/features/frequently-bought-together", "Peakhour frequently bought together"),
  },
  cartUpsells: {
    value: "yes",
    capabilityId: "commerce.cart_upsells",
    note: "Complete your cart suggestions on the cart page and You may also like links on the thank-you page. Not inside the checkout itself.",
    ...src("/shopify", "Peakhour for Shopify"),
  },
  bundles: {
    value: "yes",
    capabilityId: "commerce.buy_together_bundles",
    note: "Buy together and save gives 5 to 30 percent off a product's usual companions when they are bought in the same cart.",
    ...src("/shopify", "Peakhour for Shopify"),
  },
  abTesting: {
    value: "yes",
    capabilityId: "commerce.rail_ab_testing",
    note: "Tests two shelf strategies in the same spot, says which is ahead, and proposes the winner for your approval.",
    ...src("/shopify", "Peakhour for Shopify"),
  },
  findMyMatch: {
    value: "yes",
    capabilityId: "commerce.find_my_match",
    note: "Find my match asks a few quick questions, made from your store's own product attributes and price range, and returns a shortlist.",
    ...src("/shopify", "Peakhour for Shopify"),
  },
  seoFixes: {
    value: "yes",
    capabilityId: "content.ai_seo_fixes",
    note: "Drafts SEO titles, meta descriptions, descriptions and image alt text. You edit and tick the ones you want, and each change or a whole batch can be undone.",
    ...src("/shopify/features/ai-seo", "Peakhour AI SEO"),
  },
  seoAudit: {
    value: "yes",
    capabilityId: "content.seo_audit",
    note: "Checks every product for missing or thin descriptions, images, prices, product types, vendors and meta descriptions, and your shipping and refund policies.",
    ...src("/shopify/features/ai-seo", "Peakhour AI SEO"),
  },
  productDescriptions: {
    value: "yes",
    capabilityId: "content.ai_product_descriptions",
    note: "Writes descriptions for products that have none or very thin ones. You review and edit each draft, apply it, and can undo it.",
    ...src("/shopify/features/ai-product-descriptions", "Peakhour AI product descriptions"),
  },
  blogWriter: {
    value: "partial",
    capabilityId: "content.ai_blog_writer",
    note: "Drafts blog articles and, after you approve them, publishes them to your Shopify blog as a hidden draft unless you choose to publish. Shopify blogs only.",
    ...src("/content", "Peakhour for content"),
  },
  brandVoice: {
    value: "yes",
    capabilityId: "content.brand_voice",
    note: "Learns how your brand writes from your existing posts, per channel, uses that voice when drafting, and keeps adjusting from what you approve or reject.",
    ...src("/content", "Peakhour for content"),
  },
  socialPublishing: {
    value: "partial",
    capabilityId: "content.social_publishing",
    note: "Posts approved content to LinkedIn (personal and company pages), X including threads, Facebook Pages and Instagram images and carousels, at the time you scheduled it. Only those four networks.",
    ...src("/content", "Peakhour for content"),
  },
  linkedinGrowth: {
    value: "yes",
    capabilityId: "growth.linkedin_growth",
    note: "Publish and manage LinkedIn posts, get AI reply and hook suggestions, track engagement, and boost a post into an ad campaign.",
    ...src("/growth", "Peakhour for growth"),
  },
  reviews: {
    value: "partial",
    capabilityId: "presence.review_management",
    note: "Google reviews appear in your Inbox, and AI drafts a reply that a person on your team edits and sends to Google. Google reviews only.",
    ...src("/presence", "Peakhour for presence"),
  },
  listingHealth: {
    value: "partial",
    capabilityId: "presence.listing_health",
    note: "Scores how complete your Google listing is, lists the next fixes in order, and emails you when you lose control of the listing. Your Google listing only, not other directories.",
    ...src("/presence", "Peakhour for presence"),
  },
  gbpManagement: {
    value: "partial",
    capabilityId: "presence.gbp_management",
    note: "In beta: prepare changes to your Google Business Profile hours, details, photos and posts. Nothing is sent to Google until an admin on your team approves it.",
    ...src("/presence", "Peakhour for presence"),
  },
  beehiiv: {
    value: "yes",
    capabilityId: "content.beehiiv_newsletter",
    note: "Connects to Beehiiv, imports your past posts hourly, and sends approved newsletters to Beehiiv as drafts for you to send.",
    ...src("/content", "Peakhour for content"),
  },
  askPeakhour: {
    value: "yes",
    capabilityId: "platform.ask_peakhour",
    note: "Answers questions from your own data and can only prepare a change as a card for you to approve.",
    ...src("/how-it-works", "How Peakhour works"),
  },
} satisfies Record<string, PeakhourClaim>;
