import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import { PEAKHOUR_W3A } from "./peakhour-w3a";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://fastbundle.co/", label: "Fast Bundle home page" },
  pricing: { href: "https://fastbundle.co/pricing", label: "Fast Bundle pricing" },
  listing: { href: "https://apps.shopify.com/fast-bundle-product-bundles", label: "Fast Bundle on the Shopify App Store" },
};

export const FAST_BUNDLE = {
  slug: "fast-bundle" as const,
  pageId: "shopify.compare.fast.bundle",
  relatedIds: ["shopify", "shopify.features.bundles", "shopify.features.frequently.bought.together", "pricing"],
  name: "Fast Bundle",
  url: "https://fastbundle.co/",
  category: "Product bundles and volume discounts app for Shopify",
  observedAt: D,
  title: "Peakhour vs Fast Bundle for Shopify bundles",
  description: "Peakhour Buy together and save and frequently bought together compared with Fast Bundle on Shopify: bundle types, discounts, setup and pricing, each sourced.",
  h1: "Peakhour vs Fast Bundle: bundles and frequently bought together on Shopify",
  directAnswer:
    "Fast Bundle is a dedicated bundling app: fixed bundles, mix and match, volume discounts, buy X get Y, add-ons and frequently bought together. Peakhour works out frequently bought together pairs from your own orders and can give 5 to 30 percent off a product's usual companions bought in the same cart, but it does not build fixed-price packs by hand. If you want many bundle types, Fast Bundle documents far more. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Many bundle types", body: "You want fixed packs, mix and match, volume tiers or buy X get Y." },
    { title: "Pairs from your own orders", body: "You want to show what customers usually buy together, without building each pair." },
    { title: "A simple discount on companions", body: "You want one percentage off when usual companions are bought together." },
    { title: "Suggestions in the cart", body: "You want add-on suggestions while shoppers review the cart." },
  ],
  claims: [
    {
      dimension: "A percentage off when companions are bought together",
      vendor: { value: "yes", note: "Frequently bought together lets you add incentives to product combinations.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_C.bundles,
    },
    {
      dimension: "Pairs worked out from your order history",
      vendor: { value: "yes", note: "Its AI frequently bought together uses previous order data for suggestions.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3A.fromOrders,
    },
    {
      dimension: "Fixed-price packs you build by hand",
      vendor: { value: "yes", note: "Fixed bundles with your own bundle pricing and discounts are listed, along with mix and match.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3A.noFixedPacks,
    },
    {
      dimension: "Volume tiers, mix and match, and buy X get Y",
      vendor: { value: "yes", note: "Volume discounts, mix and match and buy X get Y are listed bundle types.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Suggestions in the cart",
      vendor: { value: "yes", note: "Cross-sell can surface complementary products on product pages or in the cart.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_C.cartUpsells,
    },
    {
      dimension: "A/B tests of what is shown",
      vendor: { value: "not-documented", note: "The pages we read do not mention A/B testing.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_C.abTesting,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "not-documented", note: "The pages we read do not state whether setup needs code. They mention a free setup session on every plan.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Free, for development stores and eligible merchants", price: "Free, with bundle sales capped at $500 a month", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Standard, up to $1,000 of monthly bundle revenue", price: "$19 per month, or $15 per month billed annually; 7-day trial", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Standard, up to $3,000", price: "$49 per month, or $39 per month billed annually", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Standard, up to $10,000", price: "$139 per month, or $115 per month billed annually", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Enterprise, unlimited bundle revenue", price: "$299 per month, or $249 per month billed annually", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Fast Bundle", bestFor: "Stores that want a full bundling toolkit: fixed packs, mix and match, volume discounts and buy X get Y, with no charge for small bundle sales." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want bought-together pairs worked out from their own orders and one percentage off usual companions, alongside cart suggestions in the same suite, and do not need hand-built packs." },
  ],
  limitations: [
    "We read only Fast Bundle's own public pages and its Shopify App Store listing. A feature a page does not document is marked Not documented, which is not the same as No.",
    "Its pricing page shows a bare $ with no currency code or region, and prices follow monthly bundle revenue. Its listing shows INR estimates for a viewer in India, which we do not repeat as the price. Plans and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Fast Bundle alternative for Shopify?", a: "Peakhour is one option if you want bought-together pairs from your own orders and one percentage off usual companions. If you need fixed-price packs, mix and match or volume tiers, read Fast Bundle's own pages first." },
    { q: "Where does this information come from?", a: "Only from Fast Bundle's own public pages, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
