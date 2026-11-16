import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.bundles";

export const CLAIMS: PageClaims = ["commerce.buy_together_bundles.percent_off"];

const bundle = capabilityFacts("commerce.buy_together_bundles");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("Buy together and save", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Switch on Buy together and save to give 5 to 30 percent off a product's usual companions when they are bought in the same cart on your Shopify store. It is off until you switch it on.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  proof: {
    kind: DEMO,
    title: "Bought together",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's cart.",
    tiles: [
      { art: "bottle", tint: "leaf", label: "Steel bottle" },
      { art: "mug", tint: "clay", label: "Clay mug" },
      { art: "bag", tint: "indigo", label: "Canvas bag" },
    ],
  },
  status: bundle.status,
  limitations: bundle.limitations,
  verifiedAt: bundle.verifiedAt,
  sections: [
    {
      id: "how-the-saving-works",
      eyebrow: "How the saving works",
      title: "One percentage, for the whole store.",
      paragraphs: [
        "Peakhour creates one automatic discount for your store, and only when you switch Buy together and save on. When a product and its usual companions are in the same cart, the percentage you chose comes off the companions.",
        "You set the most you will give, between 5 and 30 percent. The companions come from the bought-together lists Peakhour builds from your own orders.",
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Let the lists build", body: "Peakhour builds the bought-together lists overnight from your past orders, and the saving applies to the companions on them." },
    { title: "Place the shelf", body: "In the Shopify theme editor, add the Smart Rail block to your product page and choose the frequently bought together kind." },
    { title: "Switch on the saving", body: "Switch on Buy together and save for the shelf, and set the percentage between 5 and 30. Approve the discount permission if Shopify asks." },
  ],
  permissions: [
    { name: "write_discounts", why: "To create and switch on the store's one automatic discount. Without it, the discount cannot be switched on." },
    { name: "read_orders", why: "To see which products were bought together." },
    { name: "read_all_orders", why: "To look back past Shopify's default 60 days of orders, so the lists rest on more of your history." },
    { name: "read_customers", why: "Shopify asks for it with any order read. This feature does not use shopper details." },
    { name: "read_products", why: "To show the companions with your real product names, prices and images." },
  ],
  globalPage: { label: "Peakhour Commerce", href: "/commerce" },
  faqs: [
    {
      q: "Is the discount on by default?",
      a: "No. Buy together and save is off until you switch it on for a bought-together shelf. It is one percentage per store, between 5 and 30 percent.",
    },
    {
      q: "Can I build fixed-price bundles?",
      a: "No. Buy together and save takes a percentage off the companions in the cart. It does not build fixed-price packs by hand.",
    },
    {
      q: "What does it need from my store?",
      a: "The store's discount permission, and bought-together lists. Without the permission, the discount cannot be switched on.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.frequently.bought.together", "Frequently bought together for Shopify", "The shelf that shows the pairs, built from your own orders."),
    ...siblingLink(ID, "shopify.features.cart.upsells", "Cart and thank-you upsells for Shopify", "Suggestions in the cart and after checkout."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
