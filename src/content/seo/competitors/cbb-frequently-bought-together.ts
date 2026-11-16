import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import { PEAKHOUR_W3A } from "./peakhour-w3a";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  listing: { href: "https://apps.shopify.com/frequently-bought-together", label: "Frequently Bought Together on the Shopify App Store" },
};

export const CBB_FREQUENTLY_BOUGHT_TOGETHER = {
  slug: "cbb-frequently-bought-together" as const,
  pageId: "shopify.compare.cbb.frequently.bought.together",
  relatedIds: ["shopify", "shopify.features.bundles", "shopify.features.frequently.bought.together", "pricing"],
  name: "Frequently Bought Together (Code Black Belt)",
  url: "https://apps.shopify.com/frequently-bought-together",
  category: "Frequently bought together and bundles app for Shopify",
  observedAt: D,
  title: "Peakhour vs Frequently Bought Together (CBB)",
  description: "Peakhour Buy together and save compared with Code Black Belt's Frequently Bought Together on Shopify: bundle types, discounts, setup and pricing, each sourced.",
  h1: "Peakhour vs Frequently Bought Together by Code Black Belt",
  directAnswer:
    "Frequently Bought Together by Code Black Belt shows AI or manual product recommendations and bundles with four discount types, on product and cart pages. Peakhour works out bought-together pairs from your own orders and can give 5 to 30 percent off a product's usual companions, but only one percentage per store and no hand-built fixed-price packs. If discount choice and manual bundles matter, the Code Black Belt app documents more. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Bundles with several discount types", body: "You want a percentage, fixed amount, free item or free shipping on a bundle." },
    { title: "Pairs from your own orders", body: "You want what customers usually buy together shown automatically." },
    { title: "Suggestions in the cart", body: "You want add-ons offered while shoppers review the cart." },
    { title: "A no-code install", body: "You want a widget that works with your theme without developer help." },
  ],
  claims: [
    {
      dimension: "A discount when companions are bought together",
      vendor: { value: "yes", note: "Four bundle discount types: percentage, fixed, free item or free shipping.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.bundles,
    },
    {
      dimension: "Discount amount you can set",
      vendor: { value: "yes", note: "Percentage, fixed amount, free item or free shipping, as its listing states.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3A.onePercent,
    },
    {
      dimension: "Pairs worked out from your order history",
      vendor: { value: "partial", note: "Its listing describes AI and manual recommendations with one-click add to cart. It does not say the pairs come from your past orders.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3A.fromOrders,
    },
    {
      dimension: "Fixed-price and custom bundles you build by hand",
      vendor: { value: "yes", note: "Fixed, custom, upsell and cross-sell bundles are listed; the entry level allows up to 3 manual bundles, at no charge.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3A.noFixedPacks,
    },
    {
      dimension: "Suggestions in the cart",
      vendor: { value: "yes", note: "Paid plans list the widget displayed in product and cart pages.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.cartUpsells,
    },
    {
      dimension: "A/B tests of what is shown",
      vendor: { value: "not-documented", note: "Its listing does not mention A/B testing.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.abTesting,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "yes", note: "Its listing describes a no code install with a customisable widget for any Shopify theme.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Starter, up to 3 manual bundles", price: "Free", currency: "INR", region: "Listing viewed from India; INR amounts are estimates and billing is in the store's currency", observedAt: D, source: S.listing },
      { plan: "Professional I, up to 50 orders a month", price: "₹941.65 per month (an estimate shown to a viewer in India); 14-day trial", currency: "INR", region: "Listing viewed from India; INR amounts are estimates and billing is in the store's currency", observedAt: D, source: S.listing },
      { plan: "Professional II, up to 500 orders a month", price: "₹2,355.55 per month", currency: "INR", region: "Listing viewed from India; INR amounts are estimates and billing is in the store's currency", observedAt: D, source: S.listing },
      { plan: "Professional III, above 500 orders a month", price: "₹3,769.44 per month", currency: "INR", region: "Listing viewed from India; INR amounts are estimates and billing is in the store's currency", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "Frequently Bought Together (Code Black Belt)", bestFor: "Stores that want bundles with a choice of discount types, manual and custom bundles, and a no-code widget on product and cart pages." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want bought-together pairs worked out from their own orders and one percentage off usual companions, alongside cart suggestions in the same suite." },
  ],
  limitations: [
    "We read only the app's own Shopify App Store listing; we did not find a separate Code Black Belt page for it, so every vendor cell cites the listing. A feature the listing does not document is marked Not documented, which is not the same as No.",
    "The listing showed INR amounts, which it says are estimates for a viewer in India, billed in the store's currency. Paid plans scale with monthly orders, and plans and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Frequently Bought Together alternative for Shopify?", a: "Peakhour is one option if you want bought-together pairs from your own orders and one percentage off usual companions. If you need several discount types or hand-built bundles, read the app's own listing first." },
    { q: "Where does this information come from?", a: "Only from the app's own Shopify App Store listing, linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
