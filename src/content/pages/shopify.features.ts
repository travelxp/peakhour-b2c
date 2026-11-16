import type { DirectoryContent, DirectoryItem } from "@/components/marketing/seo/content-types";
import { getPage } from "@/lib/seo/pages";
import { isPublishable } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import type { Surface } from "@/lib/seo/types";
import { capabilityFacts, PRICING_LINK, SHOPIFY_HOME_LINK } from "./shopify-feature-kit";

/** The feature pages this directory lists, in the order a merchant meets them: shoppers, shelves, store, search. */
const FEATURES: { pageId: string; capabilityId: string; surface?: Surface; title: string; body: string; pillar: string }[] = [
  {
    pageId: "shopify.features.ai.shopping.assistant",
    capabilityId: "commerce.ai_shopping_assistant",
    title: "AI shopping assistant",
    body: "A chat on your storefront that answers shoppers from your real catalogue, with a Find my match quiz.",
    pillar: "Commerce",
  },
  {
    pageId: "shopify.features.whatsapp.ai.shopping",
    capabilityId: "commerce.whatsapp_shopping",
    surface: "whatsapp",
    title: "WhatsApp AI shopping",
    body: "Shoppers chat on your WhatsApp Business number and get a link into your Shopify checkout.",
    pillar: "Commerce",
  },
  {
    pageId: "shopify.features.product.recommendations",
    capabilityId: "commerce.product_recommendations",
    title: "Smart Rails product recommendations",
    body: "Product shelves that sell inside your theme, with 11 kinds to choose from.",
    pillar: "Commerce",
  },
  {
    pageId: "shopify.features.frequently.bought.together",
    capabilityId: "commerce.frequently_bought_together",
    title: "Frequently bought together",
    body: "Pairs worked out from your own orders every night, and an optional Buy together and save discount.",
    pillar: "Commerce",
  },
  {
    pageId: "shopify.features.whatsapp.cod.confirmation",
    capabilityId: "commerce.cod_confirmation",
    title: "WhatsApp COD confirmation",
    body: "Asks the shopper on WhatsApp to confirm or cancel each cash-on-delivery order.",
    pillar: "Commerce",
  },
  {
    pageId: "shopify.features.ai.seo",
    capabilityId: "content.ai_seo_fixes",
    title: "AI SEO for product pages",
    body: "Drafts SEO titles, meta descriptions and image alt text. You tick what to apply, and can undo it.",
    pillar: "Content",
  },
  {
    pageId: "shopify.features.ai.product.descriptions",
    capabilityId: "content.ai_product_descriptions",
    title: "AI product descriptions",
    body: "Writes descriptions for products that have none or very thin ones. You review each draft.",
    pillar: "Content",
  },
];

/** Only published feature pages are listed (a review page 404s on production, so a card for it would be a dead link). */
const items: DirectoryItem[] = FEATURES.filter((f) => isPublishable(getPage(f.pageId))).map((f) => ({
  title: f.title,
  body: f.body,
  href: pathFor(f.pageId),
  status: capabilityFacts(f.capabilityId, f.surface ?? "shopify").status,
  pillar: f.pillar,
}));

export const CONTENT: DirectoryContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Shopify", href: pathFor("shopify") },
    { label: "Features", href: pathFor("shopify.features") },
  ],
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Peakhour for Shopify is an app that answers your shoppers, builds product shelves, confirms cash-on-delivery orders on WhatsApp, and fixes your product pages for search. Seven features, each with its status.",
  items,
  faqs: [
    {
      q: "Where does each feature run?",
      a: "Inside your Shopify store. Some features sit in your theme, such as the chat and the product shelves, and some work from the Peakhour app in your Shopify admin, such as SEO fixes.",
    },
    {
      q: "Does every feature need WhatsApp?",
      a: "No. The shopping assistant, Smart Rails, frequently bought together, AI SEO and product descriptions do not. COD confirmation does, and needs your own WhatsApp Business number.",
    },
    {
      q: "Do I approve what Peakhour changes?",
      a: "Yes. Each page says what Peakhour asks for and what you approve. Changes the engine suggests wait for your approval, and the SEO and description fixes can be undone.",
    },
  ],
  related: [SHOPIFY_HOME_LINK, PRICING_LINK, { label: "How Peakhour works", href: "/how-it-works", note: "Ask, approve, undo." }],
  closing: {
    headline: "See it on your own store.",
    body: "Install Peakhour from the Shopify App Store, or open the Shopify page to see where it stands today.",
  },
};
