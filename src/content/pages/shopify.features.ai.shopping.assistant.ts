import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingItem, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.ai.shopping.assistant";

/** The approved claims this page leans on (capabilities.ts). */
export const CLAIMS: PageClaims = ["commerce.ai_shopping_assistant.answers_from_catalogue", "commerce.find_my_match.quick_questions"];

const assistant = capabilityFacts("commerce.ai_shopping_assistant");
const finder = capabilityFacts("commerce.find_my_match");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("AI shopping assistant", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Peakhour's AI shopping assistant is a chat on your Shopify storefront that answers shoppers from your real catalogue. If you are looking for an AI chatbot for Shopify, this is the one Peakhour offers. You switch it on in the theme editor, you can pause it whenever you like, and you can take over any chat yourself.",
  secondaryCta: { label: "See how to set it up", href: "#setup" },
  proof: {
    kind: DEMO,
    title: "Shopper chat",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's chat.",
    tiles: [
      { art: "kurta", tint: "indigo", label: "Indigo kurta" },
      { art: "scarf", tint: "rose", label: "Silk scarf" },
      { art: "bag", tint: "marigold", label: "Jute tote" },
    ],
  },
  status: assistant.status,
  limitations: assistant.limitations,
  verifiedAt: assistant.verifiedAt,
  sections: [
    {
      id: "answers",
      eyebrow: "What it does",
      title: "It answers from your own store.",
      paragraphs: [
        "The assistant reads your catalogue and your store policies, and answers the shopper's question in the chat on your storefront.",
        "You stay in charge of it. You can limit the chat to signed-in shoppers, pause it, and take over any chat from your Peakhour conversations.",
      ],
    },
    {
      id: "find-my-match",
      eyebrow: "Find my match",
      title: "A shortlist from a few quick questions.",
      paragraphs: [
        "Find my match is part of the assistant, not a separate quiz tool. A shopper taps Find my match and answers a few quick questions, made from your store's own product attributes and price range, to get a shortlist.",
      ],
      ...siblingItem(ID, "shopify.features.product.finder", "Find my match, in full", "Find my match for Shopify", "How it asks, what it needs and what it does not do."),
      limitations: finder.limitations,
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Preview the assistant", body: "Open Peakhour in your Shopify admin and try the assistant before it reaches shoppers." },
    { title: "Switch the chat on", body: "In the Shopify theme editor, turn on the Peakhour chat, and set its greeting, colour and position if you like." },
    { title: "Watch the first chats", body: "Read what shoppers ask in Conversations, take over a chat, or pause the assistant." },
  ],
  permissions: [
    { name: "read_products", why: "To answer from your catalogue: product names, descriptions, prices and options." },
    { name: "read_inventory", why: "To say whether a product is in stock, and how few are left." },
    { name: "read_legal_policies", why: "To answer from your own published refund, shipping, terms and privacy policies, and link to them." },
    { name: "read_orders", why: "So a signed-in shopper can ask where their own recent order is. An anonymous visitor gets a link to your account page instead." },
  ],
  globalPage: { label: "Peakhour Commerce", href: "/commerce" },
  faqs: [
    {
      q: "Does the assistant place orders for shoppers?",
      a: "No. It does not place orders itself on the storefront. It answers questions from your catalogue and policies, and shoppers check out in your store the usual way.",
    },
    {
      q: "Can I pause it or take over a chat?",
      a: "Yes. You can limit the chat to signed-in shoppers, pause it, and take over any chat yourself.",
    },
    {
      q: "Does the chat use Peaks?",
      a: "Yes. Each AI answer uses Peaks, and stores that have not paid get a smaller daily allowance. The pricing page shows what the plan includes.",
    },
    {
      q: "What is Find my match?",
      a: "It is the assistant's quiz. A shopper taps Find my match and answers 3 to 4 quick questions made from your own product attributes and price range, and can skip any of them. It needs at least two values for an attribute before it asks about it.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.whatsapp.ai.shopping", "WhatsApp AI shopping for Shopify", "The same assistant on your WhatsApp Business number."),
    ...siblingLink(ID, "shopify.features.product.recommendations", "Smart Rails product recommendations", "Product shelves that sit beside the chat."),
    ...siblingLink(ID, "shopify.features.ai.seo", "AI SEO for Shopify product pages", "Better titles and alt text on the pages shoppers land on."),
    ...siblingLink(ID, "shopify.features.customer.conversation.insights", "What shoppers ask your Shopify assistant", "What it could not answer, and what to do next."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
