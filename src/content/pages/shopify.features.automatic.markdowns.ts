import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.automatic.markdowns";

export const CLAIMS: PageClaims = ["commerce.automatic_markdowns.apply_on_press"];

const markdowns = capabilityFacts("commerce.automatic_markdowns");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("Markdown suggestions", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Peakhour suggests markdowns for slow-selling products, inside the discount limit and margin floor you set. When you preview a markdown and press Apply, it changes the prices in your Shopify store, and you can undo it in one click.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  proof: {
    kind: DEMO,
    title: "Markdown to review",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's prices.",
    tiles: [
      { art: "kurta", tint: "indigo", label: "Indigo kurta" },
      { art: "mug", tint: "clay", label: "Clay mug" },
    ],
  },
  status: markdowns.status,
  limitations: markdowns.limitations,
  verifiedAt: markdowns.verifiedAt,
  sections: [
    {
      id: "one-click",
      eyebrow: "How a markdown goes",
      title: "You see the prices before anything changes.",
      paragraphs: ["Peakhour looks for products that are in stock but not selling, and suggests a lower price for each. A suggestion never goes past the discount limit you set."],
      items: [
        { title: "Suggest", body: "Peakhour proposes a markdown for a slow product, inside your discount limit and margin floor." },
        { title: "Preview", body: "You see the new prices first. Nothing changes until you confirm." },
        { title: "Apply", body: "Press Apply and Peakhour changes the prices in your Shopify store." },
        { title: "Undo", body: "One click puts the old prices back, unless you changed the price yourself afterwards." },
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Switch on price changes", body: "In Autopilot, switch on price changes, and set the discount limit and the margin floor Peakhour has to stay within." },
    { title: "Review a suggestion", body: "Open Inventory in the Peakhour app, find a slow product and choose Apply markdown to see the new prices." },
    { title: "Apply, or undo", body: "Confirm to apply it. Undo it from the same place whenever you like." },
  ],
  permissions: [
    { name: "read_products", why: "To read each product's current price and details before suggesting a markdown." },
    { name: "read_inventory", why: "To see which products are in stock but not selling." },
    { name: "read_orders", why: "To see how each product has been selling." },
    { name: "read_customers", why: "Shopify asks for it with any order read. Markdowns use order line items and dates, not shopper details." },
    { name: "write_products", why: "To change the prices when you press Apply, and to put the old prices back when you undo." },
  ],
  globalPage: { label: "Peakhour Commerce", href: "/commerce" },
  faqs: [
    {
      q: "Does Peakhour mark prices down by itself?",
      a: "No. No markdown happens without your click, and nothing runs on a schedule.",
    },
    {
      q: "Can I undo a markdown?",
      a: "Yes, with one click. The exception is a price you changed yourself afterwards, which Peakhour leaves alone.",
    },
    {
      q: "What if price changes are not switched on?",
      a: "Applying needs price changes switched on in Autopilot and the store's product-write permission. Without them nothing is changed, and Peakhour tells you so.",
    },

  ],
  related: [
    ...siblingLink(ID, "shopify.features.inventory.alerts", "Shopify stock-out alerts and purchase orders", "The other side of stock: what is about to run out."),
    ...siblingLink(ID, "shopify.features.ai.growth.campaigns", "Shopify campaign discounts", "A campaign with a discount that ends on schedule."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
