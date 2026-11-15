import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.ai.product.descriptions";

export const CLAIMS: PageClaims = ["content.ai_product_descriptions.write_missing"];

const desc = capabilityFacts("content.ai_product_descriptions");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("AI product descriptions", ID),
  eyebrow: "Product descriptions",
  directAnswer:
    "Peakhour writes product descriptions for the Shopify products that have none, or only a very thin one. You review and edit each draft, apply it, and can undo it afterwards. Products whose description is already good are skipped.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  proof: {
    kind: DEMO,
    title: "A description to review",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's drafts.",
    tiles: [
      { art: "mug", tint: "clay", label: "Clay mug" },
      { art: "bottle", tint: "leaf", label: "Steel bottle" },
      { art: "bag", tint: "marigold", label: "Jute tote" },
    ],
  },
  status: desc.status,
  limitations: desc.limitations,
  verifiedAt: desc.verifiedAt,
  sections: [
    {
      id: "which-products",
      eyebrow: "Which products",
      title: "It writes where a description is missing.",
      paragraphs: [
        "A catalogue grows faster than anyone can describe it. Peakhour finds the products that need words and drafts them, so you start from a draft and not a blank box.",
      ],
      items: [
        { title: "No description", body: "A product with nothing written gets a full draft." },
        { title: "A very thin description", body: "A product with a line or two gets a fuller draft to review." },
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Find the gaps", body: "Open Catalog in the Peakhour app to see which products have no description or a thin one." },
    { title: "Draft the descriptions", body: "Choose Fix with AI on the products you want, and Peakhour writes a draft for each." },
    { title: "Review, edit and apply", body: "Edit each draft, apply the ones you like, and undo any you change your mind about. Nothing is written until you approve." },
  ],
  permissions: [
    { name: "read_products", why: "To read each product's current description, title and details before drafting." },
    { name: "write_products", why: "To write the description you approved to the product, and to put the old one back when you undo." },
  ],
  globalPage: { label: "Peakhour Content", href: "/content" },
  faqs: [
    {
      q: "Will it replace descriptions I wrote myself?",
      a: "It writes for products with no description or a thin one, and skips good existing ones. Nothing is written to your store until you approve a draft.",
    },
    {
      q: "Can I edit a draft before it goes live?",
      a: "Yes. You review and edit each draft, then apply it. You can also undo it after.",
    },
    {
      q: "Is this the same as the AI SEO feature?",
      a: "They use the same review-and-undo flow, but answer different jobs. This page is about the description shoppers read. AI SEO is about the title, meta description and image alt text that search engines read.",
    },
    {
      q: "Does it work for WooCommerce?",
      a: "Not yet. This page is about Shopify. The WooCommerce version is built but switched off for production merchants.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.ai.seo", "AI SEO for Shopify product pages", "Titles, meta descriptions and image alt text."),
    ...siblingLink(ID, "shopify.features.ai.shopping.assistant", "AI shopping assistant for Shopify", "Answers shoppers from the descriptions you approve."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
