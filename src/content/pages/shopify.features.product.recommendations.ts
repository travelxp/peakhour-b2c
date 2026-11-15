import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.product.recommendations";

export const CLAIMS: PageClaims = ["commerce.product_recommendations.shelves", "commerce.product_recommendations.eleven_shelf_kinds"];

const recs = capabilityFacts("commerce.product_recommendations");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("Product recommendations", ID),
  eyebrow: "Smart Rails",
  directAnswer:
    "Smart Rails is Peakhour's product recommendations for Shopify. It builds product shelves that sell, inside your own theme, and you choose from 11 kinds of shelf, such as bestsellers, trending, new arrivals, price drops, back in stock, low stock and recently viewed.",
  secondaryCta: { label: "See the shelf kinds", href: "#kinds" },
  proof: {
    kind: DEMO,
    title: "Shelf: you may also like",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's shelf.",
    tiles: [
      { art: "kurta", tint: "indigo", label: "Indigo kurta" },
      { art: "scarf", tint: "rose", label: "Silk scarf" },
      { art: "bag", tint: "marigold", label: "Jute tote" },
    ],
  },
  status: recs.status,
  limitations: recs.limitations,
  verifiedAt: recs.verifiedAt,
  sections: [
    {
      id: "kinds",
      eyebrow: "The shelf kinds",
      title: "Pick a kind, and know why each product is on it.",
      paragraphs: [
        "Each kind of shelf follows one plain rule, so you can say why a product was picked. These are the kinds you can start from. There are 11 in all, and a twelfth choice, auto, picks one for you.",
      ],
      items: [
        { title: "Bestsellers", body: "Picked because it is one of your top sellers." },
        { title: "Trending", body: "Picked because it is selling faster than it was before." },
        { title: "New arrivals", body: "Picked because it is one of your newest products." },
        { title: "Price drops", body: "Picked because its price has come down." },
        { title: "Back in stock", body: "Picked because it has just come back in stock." },
        { title: "Low stock", body: "Picked because only a few are left." },
        { title: "Recently viewed", body: "Picked because the shopper looked at it earlier on your store." },
        {
          title: "Frequently bought together",
          body: "Picked because customers buy it with the product on the page.",
          href: "/shopify/features/frequently-bought-together",
          linkLabel: "Frequently bought together for Shopify",
        },
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Choose a shelf", body: "Open Rails in the Peakhour app. Take a suggested shelf, or create one and choose its kind." },
    { title: "Place the block", body: "In the Shopify theme editor, add the Smart Rail block where the shelf should appear. A shelf with nothing to show hides itself." },
    { title: "Review the suggestions", body: "Changes the engine suggests wait for your approval, so nothing on your storefront changes without you." },
  ],
  permissions: [
    { name: "read_products", why: "To fill a shelf with your real products, prices and images." },
    { name: "read_inventory", why: "For the stock-based kinds, such as back in stock and low stock." },
    { name: "read_orders", why: "To see what sells, for kinds such as bestsellers and trending." },
    { name: "read_customers", why: "Shopify asks for it with any order read. Smart Rails uses order line items and dates, not shopper details." },
    { name: "read_themes", why: "To check that the Smart Rail block is in your theme, and tell you when a shelf is not placed. Peakhour never edits your theme files." },
  ],
  globalPage: { label: "Peakhour Commerce", href: "/commerce" },
  faqs: [
    {
      q: "Is Smart Rails the same as product recommendations?",
      a: "Yes. Smart Rails is the name Peakhour gives to product recommendations on Shopify: shelves of products that sell, placed in your theme.",
    },
    {
      q: "How many kinds of shelf are there?",
      a: "There are 11 kinds of shelf. The list also has a twelfth choice, auto, which picks a kind for you.",
    },
    {
      q: "Do I have to edit my theme code?",
      a: "No code. You place the Smart Rail block in the Shopify theme editor. A shelf with nothing to show hides itself.",
    },
    {
      q: "Does it change my store without asking?",
      a: "No. Changes the engine suggests wait for your approval.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.frequently.bought.together", "Frequently bought together for Shopify", "The co-purchase shelf, and Buy together and save."),
    ...siblingLink(ID, "shopify.features.ai.shopping.assistant", "AI shopping assistant for Shopify", "The chat that sits beside your shelves."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
