import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.merchandising.ab.testing";

export const CLAIMS: PageClaims = ["commerce.rail_ab_testing.compare_two_strategies"];

const ab = capabilityFacts("commerce.rail_ab_testing");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("Shelf A/B testing", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Peakhour lets you test two shelf strategies in the same spot on your Shopify store, and tells you which is ahead. It proposes the winner for your approval, and nothing switches until you say so.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  proof: {
    kind: DEMO,
    title: "Two shelves, one spot",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's results.",
    tiles: [
      { art: "kurta", tint: "indigo", label: "Version A" },
      { art: "bottle", tint: "leaf", label: "Version B" },
    ],
  },
  status: ab.status,
  limitations: ab.limitations,
  verifiedAt: ab.verifiedAt,
  sections: [
    {
      id: "how-a-test-works",
      eyebrow: "How a test works",
      title: "Two versions, one winner you approve.",
      paragraphs: ["A test compares two Smart Rails shelves that sit in the same place on your store, so the only difference is how each one picks its products."],
      items: [
        { title: "Two strategies", body: "The shelf you already have is version A. You choose a second strategy for version B, and each shopper's visit sees one of the two." },
        { title: "A proposed winner", body: "Peakhour compares how the two shelves perform and proposes the one that is ahead." },
        { title: "Your approval", body: "Approving makes the winner the shelf's strategy and ends the test. Until you approve, nothing changes." },
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Place a shelf", body: "Create a Smart Rails shelf in the Peakhour app and add the Smart Rail block to your theme from the theme editor." },
    { title: "Start a test", body: "Open the shelf's results in the Peakhour app, start an A/B test and choose the second strategy." },
    { title: "Keep the winner", body: "When Peakhour proposes a winner, read the result and approve it, or leave the test running." },
  ],
  permissions: [
    { name: "read_products", why: "To fill both shelves with your real products, prices and images." },
    { name: "read_inventory", why: "For the stock-based kinds, such as back in stock and low stock." },
    { name: "read_orders", why: "To see what sells, for kinds such as bestsellers and trending." },
    { name: "read_customers", why: "Shopify asks for it with any order read. Shelves use order line items and dates, not shopper details." },
    { name: "read_themes", why: "To check that the Smart Rail block is in your theme. Peakhour never edits your theme files." },
  ],
  globalPage: { label: "Peakhour Commerce", href: "/commerce" },
  faqs: [
    {
      q: "Does Peakhour switch to the winner by itself?",
      a: "No. It proposes the winner and waits for your approval before it changes the shelf.",
    },
    {
      q: "Can I test any two shelves?",
      a: "Only shelf kinds that do not depend on the page product can be compared. Both versions must work in the same spot.",
    },
    {
      q: "What if there is not enough data?",
      a: "Peakhour can say there is not enough data yet, and leaves the test running instead of naming a winner.",
    },
    {
      q: "Is this the same as testing against showing nothing?",
      a: "No. A test shows two shelves against each other, in the same spot. This page covers that comparison.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.product.recommendations", "Smart Rails product recommendations", "The shelves you can test, and the 11 kinds."),
    ...siblingLink(ID, "shopify.features.frequently.bought.together", "Frequently bought together for Shopify", "The shelf built from your own orders."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
