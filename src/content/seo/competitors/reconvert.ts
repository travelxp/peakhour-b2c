import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import { PEAKHOUR_W3A } from "./peakhour-w3a";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://upsell.com/", label: "Upsell.com (ReConvert) home page" },
  pricing: { href: "https://upsell.com/pricing", label: "Upsell.com (ReConvert) pricing" },
  listing: { href: "https://apps.shopify.com/reconvert-upsell-cross-sell", label: "ReConvert on the Shopify App Store" },
};

export const RECONVERT = {
  slug: "reconvert" as const,
  pageId: "shopify.compare.reconvert",
  relatedIds: ["shopify", "shopify.features.cart.upsells", "shopify.features.bundles", "pricing"],
  name: "ReConvert",
  url: "https://upsell.com/",
  category: "Post-purchase and thank-you page upsell app for Shopify",
  observedAt: D,
  title: "Peakhour vs ReConvert for Shopify upsells",
  description: "Peakhour cart and thank-you suggestions compared with ReConvert upsell funnels on Shopify: offers, tests, setup and pricing, each sourced and dated.",
  h1: "Peakhour vs ReConvert: cart and thank-you upsells on Shopify",
  directAnswer:
    "ReConvert, which now trades as Upsell.com, is a dedicated upsell app with one-click post-purchase funnels, thank-you page offers, cart offers and built-in A/B testing. Peakhour shows cart suggestions and thank-you page links drawn from what customers bought together, and cannot add an item to the order from the thank-you page. If one-click post-purchase offers are the job, ReConvert documents far more. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "One-click offers after checkout", body: "You want a shopper to accept an extra item without entering payment details again." },
    { title: "Cart page suggestions", body: "You want suggestions while a shopper reviews the cart." },
    { title: "Thank-you page offers", body: "You want something useful on the page shoppers see after ordering." },
    { title: "Proving an offer works", body: "You want to compare two offers and keep the one that sells." },
  ],
  claims: [
    {
      dimension: "One-click post-purchase offers that add to the order",
      vendor: { value: "yes", note: "Listed as a placement, Post-purchase (one-click). Its Shopify listing describes funnels shoppers accept without entering payment details again.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_W3A.noOneClickAdd,
    },
    {
      dimension: "Thank-you page offers",
      vendor: { value: "yes", note: "Thank-you page is listed as a placement.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_W3A.thankYouLinks,
    },
    {
      dimension: "Cart page suggestions",
      vendor: { value: "yes", note: "Cart page and cart drawer are listed as placements.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_C.cartUpsells,
    },
    {
      dimension: "How suggestions are picked",
      vendor: { value: "yes", note: "Its Shopify listing mentions AI recommendations alongside bundles and quantity breaks.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3A.picks,
    },
    {
      dimension: "A/B tests of offers",
      vendor: { value: "yes", note: "Built-in A/B testing is listed on its pricing page and Shopify listing.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_C.abTesting,
    },
    {
      dimension: "Checkout upsells",
      vendor: { value: "partial", note: "Documented, and its listing says checkout upsells require Shopify Plus.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "partial", note: "Its home page says to set it up in minutes. We did not find a statement about needing no developer.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Growth, up to 2,000 monthly orders or upsell revenue", price: "Free to start (\"Starts free\"); tiers from 50 up to 2,000 orders. Monthly or annual billing", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Scale, up to 10,000 orders", price: "From $299 per month", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Elite, up to 20,000 orders", price: "From $899 per month", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Enterprise, above 20,000 orders", price: "Not published (custom)", currency: "Not stated", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "ReConvert", bestFor: "Stores whose main job is post-purchase: one-click offers after checkout, thank-you page funnels, checkout upsells on Shopify Plus and built-in A/B testing, with every feature on every plan." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want cart suggestions and thank-you page links drawn from what their own customers bought together, as part of one suite, and do not need to add an item to the order after checkout." },
  ],
  limitations: [
    "We read only ReConvert's own public pages: its site, which now sits at Upsell.com, and its Shopify App Store listing. A feature a page does not document is marked Not documented, which is not the same as No.",
    "Its pricing page shows a bare $ with no currency code or region, and its plan cards and comparison table disagree on whether Scale and Elite bill monthly or annually. Plans and offers change.",
    "Its listing shows a no-charge entry level and paid levels by order count, with a 14-day trial; the listing amounts we saw were estimates in INR for a viewer in India, so we do not repeat them as the price.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a ReConvert alternative for Shopify?", a: "Peakhour is one option if you want cart suggestions and thank-you page links from what customers bought together, within a wider suite. If one-click post-purchase offers are your main need, read ReConvert's own pages first." },
    { q: "Where does this information come from?", a: "Only from ReConvert's own public pages, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
