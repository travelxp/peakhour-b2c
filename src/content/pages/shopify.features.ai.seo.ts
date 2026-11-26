import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.ai.seo";

export const CLAIMS: PageClaims = ["content.ai_seo_fixes.product_pages", "content.ai_seo_fixes.tick_and_undo"];

const seo = capabilityFacts("content.ai_seo_fixes");
const descriptionsLink = siblingLink(ID, "shopify.features.ai.product.descriptions", "AI product descriptions for Shopify", "Writing the description itself, with the same review and undo.");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("AI SEO", ID),
  eyebrow: "Fix with AI",
  directAnswer:
    "Fix with AI drafts SEO titles, meta descriptions and image alt text for your Shopify product pages, so Google reads them better. You edit each draft and tick the ones you want, and each change, or a whole batch, can be undone.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  proof: {
    kind: DEMO,
    title: "Drafts to review",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's drafts.",
    tiles: [
      { art: "scarf", tint: "rose", label: "Silk scarf" },
      { art: "kurta", tint: "indigo", label: "Indigo kurta" },
      { art: "mug", tint: "clay", label: "Clay mug" },
    ],
  },
  status: seo.status,
  limitations: seo.limitations,
  verifiedAt: seo.verifiedAt,
  sections: [
    {
      id: "drafts",
      eyebrow: "What it drafts",
      title: "The search text on a product page.",
      paragraphs: [
        "Fix with AI looks at a product and drafts the text that search engines read. You decide what goes to your store.",
      ],
      items: [
        { title: "SEO title", body: "The title search engines show for the page." },
        { title: "Meta description", body: "The short summary under the title in search results." },
        { title: "Image alt text", body: "The text that describes a product photo to search engines and to shoppers who cannot see it." },
        {
          title: "Product description",
          body: "The description shoppers read on the page.",
          ...(descriptionsLink[0] ? { href: descriptionsLink[0].href, linkLabel: descriptionsLink[0].label } : {}),
        },
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Choose products", body: "Open Catalog in the Peakhour app and pick the products to fix, or take the top 10 Peakhour has already chosen." },
    { title: "Draft with AI", body: "Choose Fix with AI. Peakhour drafts the SEO text, and leaves alone titles and descriptions that are already good." },
    { title: "Edit, tick and apply", body: "Edit any draft, tick the ones you want and apply them. Undo a single change or a whole batch whenever you like." },
  ],
  permissions: [
    { name: "read_products", why: "To read each product's current title, description, images and search text before drafting." },
    { name: "write_products", why: "To write the ticked SEO title, meta description and image alt text back to the product, and to put the old text back when you undo." },
  ],
  globalPage: { label: "Peakhour Content", href: "/content" },
  faqs: [
    {
      q: "Will it overwrite titles and descriptions that are already good?",
      a: "No. It leaves alone titles and descriptions that are already good.",
    },
    {
      q: "Can I undo a change?",
      a: "Yes. You can undo a single change, or a whole batch you applied together.",
    },
    {
      q: "Does it add structured data or redirects?",
      a: "No. On Shopify it does not write structured data (schema) or redirects.",
    },
    {
      q: "What does it need?",
      a: "Peaks and the Suite plan. The pricing page shows what the plan includes.",
    },
  ],
  related: [
    ...descriptionsLink,
    ...siblingLink(ID, "shopify.features.ai.shopping.assistant", "AI shopping assistant for Shopify", "Answers shoppers on the pages you have just improved."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
