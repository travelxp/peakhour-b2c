import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.product.finder";

export const CLAIMS: PageClaims = ["commerce.find_my_match.quick_questions"];

const finder = capabilityFacts("commerce.find_my_match");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("Find my match", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Shoppers tap Find my match on your Shopify store and answer a few quick questions, made from your store's own product attributes and price range, to get a shortlist. It is part of the shopping assistant, not a separate quiz tool.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  proof: {
    kind: DEMO,
    title: "A shortlist",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's quiz.",
    tiles: [
      { art: "kurta", tint: "indigo", label: "Indigo kurta" },
      { art: "scarf", tint: "rose", label: "Silk scarf" },
      { art: "bag", tint: "marigold", label: "Jute tote" },
    ],
  },
  status: finder.status,
  limitations: finder.limitations,
  verifiedAt: finder.verifiedAt,
  sections: [
    {
      id: "how-it-asks",
      eyebrow: "How it asks",
      title: "Questions made from your own catalogue.",
      paragraphs: [
        "You do not write the quiz. Peakhour makes 3 to 4 questions from your products' own attributes and your price range, so every answer leads to products you actually sell.",
        "Shoppers can skip any question. Peakhour asks about an attribute only when your products have at least two different values for it.",
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Switch the chat on", body: "In the Shopify theme editor, turn on the Peakhour chat. Find my match is a button inside it." },
    { title: "Fill in your products", body: "Keep product attributes and prices filled in. The questions are made from them." },
    { title: "Watch what shoppers pick", body: "Read the chats in Conversations to see what shoppers asked for and what they chose." },
  ],
  permissions: [
    { name: "read_products", why: "To make the questions from your product attributes and price range, and to build the shortlist from your real products." },
  ],
  globalPage: { label: "Peakhour Commerce", href: "/commerce" },
  faqs: [
    {
      q: "Can I build my own quiz?",
      a: "No. Find my match is part of the shopping assistant, not a separate quiz builder. Its questions come from your own product attributes and price range.",
    },
    {
      q: "Can shoppers skip a question?",
      a: "Yes. They can skip any of the questions.",
    },
    {
      q: "Why does it not ask about an attribute I have?",
      a: "It needs at least two values for an attribute before it asks about it. If every product has the same value, there is nothing to choose between.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.ai.shopping.assistant", "AI shopping assistant for Shopify", "The chat Find my match lives in."),
    ...siblingLink(ID, "shopify.features.customer.conversation.insights", "What shoppers ask your Shopify assistant", "See what shoppers wanted and could not find."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
