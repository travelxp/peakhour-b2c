import type { PageRecord, Pillar } from "./types";

/*
 * SF-2: the remaining Shopify feature pages, so every live or beta Shopify capability has a page (the wave-1 pages are in
 * pages.ts). Kept in its own file so the comparison and feature lanes that also edit pages.ts do not collide with it.
 *
 * Each page is `published` + `indexable` only when its capability is live or beta on the Shopify surface and every claim the
 * page states is an approved claim of that capability (capabilities.ts). capabilityIds lists only the capabilities whose
 * approved claim the page states; the publish gate checks each.
 */

const REVIEWED = "2026-11-16";
const OWNER = "growth";
const CTA = { label: "Install on Shopify", href: "/shopify", kind: "install" } as const;

type Seed = {
  pageId: string;
  path: string;
  pillar: Pillar;
  capabilityIds: string[];
  cluster: string;
  title: string;
  description: string;
  h1: string;
  relatedIds: string[];
};

function rec(s: Seed): PageRecord {
  return {
    pageId: s.pageId,
    family: "shopify-feature",
    scope: "shopify",
    path: s.path,
    parentId: "shopify.features",
    primaryPillar: s.pillar,
    capabilityIds: s.capabilityIds,
    surface: "shopify",
    queryClusterId: s.cluster,
    editorialStatus: "published",
    indexable: true,
    title: s.title,
    description: s.description,
    h1: s.h1,
    primaryCta: { ...CTA },
    owner: OWNER,
    lastReviewedAt: REVIEWED,
    relatedIds: s.relatedIds,
  };
}

export const SF2_PAGES: readonly PageRecord[] = [
  rec({
    pageId: "shopify.features.cart.upsells",
    path: "/shopify/features/cart-upsells",
    pillar: "commerce",
    capabilityIds: ["commerce.cart_upsells"],
    cluster: "shopify-cart-upsells",
    title: "Cart and thank-you page upsells for Shopify",
    description:
      "Peakhour shows Complete your cart suggestions on your Shopify cart page and You may also like links on the thank-you page, from what customers buy together.",
    h1: "Suggest more products in the cart and after checkout on Shopify",
    relatedIds: ["shopify.features.frequently.bought.together", "shopify.features.bundles", "shopify.features.product.recommendations", "shopify"],
  }),
  rec({
    pageId: "shopify.features.merchandising.ab.testing",
    path: "/shopify/features/merchandising-ab-testing",
    pillar: "commerce",
    capabilityIds: ["commerce.rail_ab_testing"],
    cluster: "shopify-merchandising-ab-testing",
    title: "A/B testing for Shopify product shelves",
    description:
      "Test two shelf strategies in the same spot on your Shopify store. Peakhour says which is ahead and proposes the winner for your approval.",
    h1: "A/B test your Shopify product shelves and keep the winner",
    relatedIds: ["shopify.features.product.recommendations", "shopify.features.frequently.bought.together", "shopify"],
  }),
  rec({
    pageId: "shopify.features.inventory.alerts",
    path: "/shopify/features/inventory-alerts",
    pillar: "commerce",
    capabilityIds: ["commerce.inventory_alerts"],
    cluster: "shopify-inventory-alerts",
    title: "Shopify stock-out alerts and purchase orders",
    description:
      "Peakhour WhatsApps you when a selling product is forecast to run out before a reorder could arrive, and builds a per-vendor purchase-order sheet to print.",
    h1: "Know which Shopify products will run out, before they do",
    relatedIds: ["shopify.features.automatic.markdowns", "shopify.features.whatsapp.cod.confirmation", "shopify"],
  }),
  rec({
    pageId: "shopify.features.automatic.markdowns",
    path: "/shopify/features/markdown-suggestions",
    pillar: "commerce",
    capabilityIds: ["commerce.automatic_markdowns"],
    cluster: "shopify-markdown-suggestions",
    title: "Markdown suggestions for slow Shopify stock",
    description:
      "Peakhour suggests markdowns inside the discount limit and margin floor you set. You preview and press Apply, and each change has a one-click undo.",
    h1: "Markdown suggestions for slow-selling Shopify products, applied on your click",
    relatedIds: ["shopify.features.inventory.alerts", "shopify.features.ai.growth.campaigns", "shopify"],
  }),
  rec({
    pageId: "shopify.features.ai.blog.generator",
    path: "/shopify/features/ai-blog-generator",
    pillar: "content",
    capabilityIds: ["content.ai_blog_writer", "content.brand_voice"],
    cluster: "shopify-ai-blog-generator",
    title: "AI blog writer for your Shopify blog",
    description:
      "Peakhour drafts blog articles for you to approve, then publishes them to your Shopify blog as a hidden draft unless you choose to publish.",
    h1: "Write your Shopify blog with AI, and approve each article",
    relatedIds: ["shopify.features.ai.seo", "shopify.features.seo.audit", "features.brand.voice", "shopify"],
  }),
  rec({
    pageId: "shopify.features.seo.audit",
    path: "/shopify/features/seo-audit",
    pillar: "content",
    capabilityIds: ["content.seo_audit"],
    cluster: "shopify-seo-audit",
    title: "Shopify catalogue and SEO audit",
    description:
      "Peakhour checks every Shopify product for missing or thin descriptions, images, prices, product types, vendors and meta descriptions, and your store policies.",
    h1: "Audit your Shopify catalogue and see what to fix first",
    relatedIds: ["shopify.features.ai.seo", "shopify.features.ai.product.descriptions", "shopify"],
  }),
  rec({
    pageId: "shopify.features.customer.conversation.insights",
    path: "/shopify/features/customer-conversation-insights",
    pillar: "support",
    capabilityIds: ["support.conversation_insights"],
    cluster: "shopify-conversation-insights",
    title: "What shoppers ask your Shopify store's AI assistant",
    description:
      "Peakhour shows what several shoppers asked your assistant that it could not answer, including products you do not sell, with how often and what to do next.",
    h1: "See what your Shopify shoppers asked that went unanswered",
    relatedIds: ["shopify.features.ai.shopping.assistant", "shopify.features.product.finder", "shopify"],
  }),
  rec({
    pageId: "shopify.features.ai.growth.campaigns",
    path: "/shopify/features/ai-growth-campaigns",
    pillar: "growth",
    capabilityIds: ["growth.ai_growth_campaigns"],
    cluster: "shopify-growth-campaigns",
    title: "Shopify campaign discounts that end on schedule",
    description:
      "Approve a Peakhour campaign and it puts products on a storefront shelf and, if you switched discounts on, creates a Shopify discount that ends on schedule.",
    h1: "Run Shopify campaigns with discounts that end on schedule",
    relatedIds: ["shopify.features.automatic.markdowns", "shopify.features.product.recommendations", "shopify.features.bundles", "shopify"],
  }),
  rec({
    pageId: "shopify.features.product.finder",
    path: "/shopify/features/product-finder",
    pillar: "commerce",
    capabilityIds: ["commerce.find_my_match"],
    cluster: "shopify-product-finder",
    title: "Find my match: a product finder for Shopify",
    description:
      "Shoppers tap Find my match and answer a few quick questions, made from your own product attributes and price range, to get a shortlist from your store.",
    h1: "A product finder quiz for your Shopify store",
    relatedIds: ["shopify.features.ai.shopping.assistant", "shopify.features.customer.conversation.insights", "shopify"],
  }),
  rec({
    pageId: "shopify.features.bundles",
    path: "/shopify/features/bundles",
    pillar: "commerce",
    capabilityIds: ["commerce.buy_together_bundles"],
    cluster: "shopify-bundles",
    title: "Buy together and save for Shopify",
    description:
      "Switch on Buy together and save to give 5 to 30 percent off a product's usual companions when they are bought in the same cart on your Shopify store.",
    h1: "Offer a saving when customers buy products together on Shopify",
    relatedIds: ["shopify.features.frequently.bought.together", "shopify.features.cart.upsells", "shopify"],
  }),
];
