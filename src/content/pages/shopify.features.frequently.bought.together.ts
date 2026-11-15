import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.frequently.bought.together";

export const CLAIMS: PageClaims = ["commerce.frequently_bought_together.from_orders", "commerce.buy_together_bundles.percent_off"];

const fbt = capabilityFacts("commerce.frequently_bought_together");
const bundle = capabilityFacts("commerce.buy_together_bundles");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("Frequently bought together", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Peakhour works out which products your customers buy together from your own Shopify orders every night, and can show them as a shelf on the product page. You can also switch on Buy together and save, which gives 5 to 30 percent off a product's usual companions when they are bought in the same cart.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  proof: {
    kind: DEMO,
    title: "Shelf: bought together",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's product page.",
    tiles: [
      { art: "bottle", tint: "leaf", label: "Steel bottle" },
      { art: "mug", tint: "clay", label: "Clay mug" },
      { art: "bag", tint: "indigo", label: "Canvas bag" },
    ],
  },
  status: fbt.status,
  limitations: fbt.limitations,
  verifiedAt: fbt.verifiedAt,
  sections: [
    {
      id: "pairs",
      eyebrow: "The shelf",
      title: "Pairs come from your own orders.",
      paragraphs: [
        "Every night Peakhour looks at what your customers actually bought together and builds the list for each product. The lists are worked out from your orders, not by AI.",
        "A store with too few past orders gets no list yet. The shelf appears once there is enough to go on.",
      ],
    },
    {
      id: "buy-together-and-save",
      eyebrow: "Buy together and save",
      title: "An optional saving on the companions.",
      paragraphs: [
        "Buy together and save gives 5 to 30 percent off a product's usual companions when they are bought in the same cart. It is one discount percentage for the whole store.",
        "It is off until you switch it on for a bought-together shelf.",
      ],
      limitations: bundle.limitations.filter((l) => !l.startsWith("Off until")),
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Let the lists build", body: "Peakhour reads your past orders and builds the bought-together lists overnight." },
    { title: "Place the shelf", body: "In the Shopify theme editor, add the Smart Rail block to your product page and choose the frequently bought together kind." },
    { title: "Decide on the saving", body: "Switch on Buy together and save for the shelf if you want it, and set the percentage between 5 and 30." },
  ],
  permissions: [
    { name: "read_orders", why: "To see which products were bought together. Peakhour uses order line items and dates for this." },
    { name: "read_all_orders", why: "To look back past Shopify's default 60 days of orders, so the pairs rest on more of your history." },
    { name: "read_customers", why: "Shopify asks for it with any order read. This feature does not use shopper details." },
    { name: "read_products", why: "To show the companions with your real product names, prices and images." },
    { name: "write_discounts", why: "Only for Buy together and save: to create and switch on the store's one automatic discount. Without it, the discount cannot be switched on." },
  ],
  globalPage: { label: "Peakhour Commerce", href: "/commerce" },
  faqs: [
    {
      q: "How does Peakhour decide what is bought together?",
      a: "From your own past Shopify orders, worked out every night. It is not guessed by AI.",
    },
    {
      q: "What if my store has few orders?",
      a: "A store with too few past orders gets no list. The shelf appears once there are enough orders to go on.",
    },
    {
      q: "Is the discount on by default?",
      a: "No. Buy together and save is off until you switch it on for a bought-together shelf. It is one percentage per store, between 5 and 30 percent.",
    },
    {
      q: "Can I build fixed-price bundles?",
      a: "No. Buy together and save takes a percentage off the companions in the cart. It does not build fixed-price packs by hand.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.product.recommendations", "Smart Rails product recommendations", "The other kinds of shelf you can place."),
    ...siblingLink(ID, "shopify.features.ai.shopping.assistant", "AI shopping assistant for Shopify", "The chat that answers from the same catalogue."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
