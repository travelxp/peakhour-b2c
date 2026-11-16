import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.seo.audit";

export const CLAIMS: PageClaims = ["content.seo_audit.catalogue_checks"];

const audit = capabilityFacts("content.seo_audit");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("Catalogue and SEO audit", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Peakhour checks every product in your Shopify store for missing or thin descriptions, images, prices, product types, vendors and meta descriptions, and checks your shipping and refund policies. It puts what to fix first at the top.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  status: audit.status,
  limitations: audit.limitations,
  verifiedAt: audit.verifiedAt,
  sections: [
    {
      id: "checks",
      eyebrow: "What it checks",
      title: "Every product, and your store policies.",
      paragraphs: ["Each product gets a list of gaps, so you can see what stops it being found or understood. The gaps are ordered so the ones that matter most come first."],
      items: [
        { title: "Descriptions", body: "Products with no description, or a very thin one." },
        { title: "Images and prices", body: "Products with a missing image or no price." },
        { title: "Product type and vendor", body: "Products with no product type or no vendor set." },
        { title: "Meta descriptions", body: "Products with no search description." },
        { title: "Shipping and refund policies", body: "Your store's own policies, checked once for the whole store, not for each product." },
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Open the audit", body: "Open Catalogue health in the Peakhour app. Peakhour checks your products and policies, and reads your pages on a daily crawl." },
    { title: "Start with what matters", body: "Sort by what matters most and open a product to see its gaps." },
    { title: "Fix them", body: "Fix a product yourself in Shopify, or draft the text with Fix with AI and approve it." },
  ],
  permissions: [
    { name: "read_products", why: "To check each product's description, images, price, product type, vendor and meta description." },
    { name: "read_legal_policies", why: "To read your published shipping and refund policies and check them." },
  ],
  globalPage: { label: "Peakhour Content", href: "/content" },
  faqs: [
    {
      q: "Does the audit change anything in my store?",
      a: "No. It reads your products and policies and shows what to fix. A change is made only when you apply a fix.",
    },
    {
      q: "Does it check page speed, backlinks or keywords?",
      a: "No. It checks the gaps in your catalogue and your policies. It does not check page speed, backlinks or keywords.",
    },
    {
      q: "How fresh are the page findings?",
      a: "Page-level findings are as of the last daily crawl.",
    },
    {
      q: "How do I fix what it finds?",
      a: "Fix a gap yourself, or use Fix with AI to draft the text. You review each draft and can undo it.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.ai.seo", "AI SEO for Shopify product pages", "Draft SEO titles, meta descriptions and alt text for what the audit finds."),
    ...siblingLink(ID, "shopify.features.ai.product.descriptions", "AI product descriptions for Shopify", "Write the descriptions the audit says are missing."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
