import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.cart.upsells";

export const CLAIMS: PageClaims = ["commerce.cart_upsells.cart_and_thank_you"];

const cart = capabilityFacts("commerce.cart_upsells");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("Cart and thank-you upsells", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Peakhour shows Complete your cart suggestions on your Shopify cart page and You may also like links on the thank-you page, drawn from products customers bought together. Both use the bought-together lists, so they appear once Peakhour has built them.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  proof: {
    kind: DEMO,
    title: "Complete your cart",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's cart.",
    tiles: [
      { art: "scarf", tint: "rose", label: "Silk scarf" },
      { art: "bag", tint: "marigold", label: "Jute tote" },
      { art: "mug", tint: "clay", label: "Clay mug" },
    ],
  },
  status: cart.status,
  limitations: cart.limitations,
  verifiedAt: cart.verifiedAt,
  sections: [
    {
      id: "cart-page",
      eyebrow: "On the cart page",
      title: "Complete your cart.",
      paragraphs: [
        "The Smart Rail block on your cart page suggests the products customers bought together with what is already in the cart. Products already in the cart are left out.",
        "With an empty cart, or before any bought-together list exists, the block hides itself.",
      ],
    },
    {
      id: "thank-you-page",
      eyebrow: "On the thank-you page",
      title: "You may also like.",
      paragraphs: [
        "After checkout, the thank-you page shows up to four products from the bought-together lists of what was in the order. Each one links to its product page.",
        "The thank-you page cannot add anything to the order that was just placed, so these are links, not buttons that add to the cart.",
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Let the lists build", body: "Peakhour builds the bought-together lists overnight from your past orders. Both suggestions need them." },
    { title: "Add the cart block", body: "In the Shopify theme editor, add the Smart Rail block to your cart page and set Show to Complete your cart." },
    { title: "Add the thank-you block", body: "In Shopify's checkout customisation, add the Peakhour You may also like block to the thank-you page. Shopify has to approve its network access first." },
  ],
  permissions: [
    { name: "read_products", why: "To show the suggested products with your real names, prices and images, and to link each one to its product page." },
    { name: "read_orders", why: "To build the bought-together lists the suggestions come from." },
    { name: "read_customers", why: "Shopify asks for it with any order read. The suggestions use order line items and dates, not shopper details." },
  ],
  globalPage: { label: "Peakhour Commerce", href: "/commerce" },
  faqs: [
    {
      q: "Can the thank-you page add a product to the order?",
      a: "No. It shows up to four links to product pages. It cannot add items to an order that has already been placed.",
    },
    {
      q: "What if my store has few orders?",
      a: "Both suggestions need bought-together lists, and a store with too few past orders gets none yet. The cart block hides itself until there are lists to draw from.",
    },
    {
      q: "What does the thank-you block send to Peakhour?",
      a: "Product ids only. It sends the ids of the products in the order and gets back links to product pages.",
    },
    {
      q: "Is this the same as frequently bought together?",
      a: "It uses the same lists. Frequently bought together shows them as a shelf on the product page, and this page covers the cart and the thank-you page.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.frequently.bought.together", "Frequently bought together for Shopify", "The same lists, as a shelf on the product page."),
    ...siblingLink(ID, "shopify.features.bundles", "Buy together and save for Shopify", "An optional saving on the companions when they are bought in one cart."),
    ...siblingLink(ID, "shopify.features.product.recommendations", "Smart Rails product recommendations", "The other kinds of shelf you can place."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
