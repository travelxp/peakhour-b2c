import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.customer.conversation.insights";

export const CLAIMS: PageClaims = ["support.conversation_insights.unmet_asks"];

const insights = capabilityFacts("support.conversation_insights");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("Shopper questions", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Peakhour shows what several shoppers asked your assistant that it could not answer, including products they wanted that you do not sell. Each item says how often it came up, whether it is rising, and what to do next.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  status: insights.status,
  limitations: insights.limitations,
  verifiedAt: insights.verifiedAt,
  sections: [
    {
      id: "what-you-see",
      eyebrow: "What you see",
      title: "What shoppers wanted and could not find.",
      paragraphs: ["Shoppers ask your assistant for things your store cannot answer today. Peakhour gathers those asks, so you can act on real questions."],
      items: [
        { title: "Questions it could not answer", body: "What several shoppers asked that the assistant had no answer for." },
        { title: "Products you do not sell", body: "Products shoppers wanted that are not in your store." },
        { title: "How often, and which way", body: "How often it came up, and whether it is rising." },
        { title: "What to do next", body: "A next step for each one: restock, add a size, or fix a product description." },
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store." },
    { title: "Switch the assistant on", body: "In the Shopify theme editor, turn on the Peakhour chat. This page has nothing to show while the assistant is off." },
    { title: "Let shoppers ask", body: "Insights appear once several shoppers have raised the same thing." },
    { title: "Open the list", body: "Open What shoppers ask for in the Peakhour app and act on an item, or dismiss it." },
  ],
  permissions: [],
  permissionsNote:
    "This feature asks Shopify for no permission of its own. It reads the chats your shopping assistant has already had, so it uses the access the assistant uses.",
  globalPage: { label: "Peakhour Support", href: "/support" },
  faqs: [
    {
      q: "Is this a support inbox?",
      a: "No. It analyses the assistant's conversations. It is not a live inbox, and your own test chats are excluded. A shared inbox is coming soon.",
    },
    {
      q: "Why is my list empty?",
      a: "An item appears only once several customers raise the same thing, and nothing shows while the assistant is switched off.",
    },
    {
      q: "Can I dismiss an item?",
      a: "Yes. A dismissed item comes back only if it is asked at least twice as often.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.ai.shopping.assistant", "AI shopping assistant for Shopify", "The chat whose conversations these insights come from."),
    ...siblingLink(ID, "shopify.features.product.finder", "Find my match for Shopify", "A few questions that lead a shopper to a shortlist."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
