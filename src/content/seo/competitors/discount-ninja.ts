import { PEAKHOUR_W3C as P } from "./peakhour-cmp-w3c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://discountninja.io/", label: "Discount Ninja home page" },
  pricing: { href: "https://discountninja.io/pricing", label: "Discount Ninja pricing" },
  listing: { href: "https://apps.shopify.com/discount-url", label: "Discount Ninja Promo Engine on the Shopify App Store" },
};

export const DISCOUNT_NINJA = {
  slug: "discount-ninja" as const,
  pageId: "shopify.compare.discount.ninja",
  pillar: "growth",
  relatedIds: ["shopify", "shopify.features.ai.growth.campaigns", "shopify.features.automatic.markdowns", "pricing"],
  name: "Discount Ninja",
  url: "https://discountninja.io/",
  category: "Promotion and discount engine for Shopify",
  observedAt: D,
  title: "Peakhour vs Discount Ninja for Shopify",
  description: "Peakhour and Discount Ninja compared for Shopify discounts: offer types, stacking, schedules, segments and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Discount Ninja for Shopify",
  directAnswer:
    "Discount Ninja is a promotion engine: BOGO, free gift, tiered and volume offers, stacking rules, schedules and audience-only offers, built on Shopify Functions. Peakhour creates a Shopify discount when you approve a campaign, ends it on its deadline, suggests markdowns within your margin floor, and offers bundle discounts. Discount Ninja documents far more offer types and rules than Peakhour claims. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Complex offers", body: "You want BOGO, free gift, tiered or volume offers with rules for how they combine." },
    { title: "Scheduled promotions", body: "You want a sale that starts and stops on its own." },
    { title: "Offers for chosen shoppers", body: "You want a discount only for a segment, such as VIP customers." },
    { title: "Safe sale prices", body: "You want markdowns that stay inside a margin you set." },
  ],
  claims: [
    {
      dimension: "Discounts created in Shopify",
      vendor: { value: "yes", note: "It uses Shopify Functions for a native checkout experience.", source: S.pricing, observedAt: D },
      peakhour: P.campaignDiscount,
    },
    {
      dimension: "Scheduled start and stop",
      vendor: { value: "yes", note: "Promotions start and stop automatically on the dates you set, with recurring weekday schedules.", source: S.pricing, observedAt: D },
      peakhour: P.campaignDeadline,
    },
    {
      dimension: "Bundle and buy-more offers",
      vendor: { value: "yes", note: "BOGO, free gift, tiered, volume and quantity-break offers are listed.", source: S.listing, observedAt: D },
      peakhour: P.bundles,
    },
    {
      dimension: "Stacking offers",
      vendor: { value: "yes", note: "You manage whether offers combine or stack.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Offers for chosen audiences",
      vendor: { value: "yes", note: "Discounted pricing for selected audiences, and private offers for VIP customers through a link.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Promoted products on the storefront",
      vendor: { value: "not-documented", note: "A storefront shelf of promoted products is not described in the listing.", source: S.listing, observedAt: D },
      peakhour: P.campaignShelf,
    },
    {
      dimension: "Markdowns within a margin floor",
      vendor: { value: "not-documented", note: "A margin floor for discounts is not described in the listing or pricing page.", source: S.pricing, observedAt: D },
      peakhour: P.markdowns,
    },
    {
      dimension: "A/B testing of offers",
      vendor: { value: "not-documented", note: "A/B testing is not mentioned on its listing or pricing page.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Starter, 500 influenced orders", price: "$49 per month or $539 per year, 14-day trial, $0.20 per extra order up to $50", currency: "USD (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Pro, 1,000 influenced orders", price: "$99 per month or $1,089 per year, 14-day trial, $0.175 per extra order up to $100", currency: "USD (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Grow, 2,500 influenced orders", price: "$199 per month or $2,189 per year, 14-day trial, $0.125 per extra order up to $200", currency: "USD (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Plus, 10,000 influenced orders", price: "$399 per month or $4,389 per year, 14-day trial, $0.10 per extra order up to $250", currency: "USD (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Starter on its Shopify listing", price: "₹4,618.72 per month, 14-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Pro on its Shopify listing", price: "₹9,331.70 per month, 14-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "Discount Ninja", bestFor: "Stores that run many kinds of promotion: BOGO, free gifts, tiered and volume offers, stacking rules and audience-only offers, with a native checkout." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want a campaign's discount created when they approve it and ended on its deadline, markdowns that stay inside a margin floor, and bundle offers, without building rules." },
  ],
  limitations: [
    "We read Discount Ninja's pricing page and its Shopify listing. Its help pages were not read.",
    "It counts only orders its offers influenced; its listing shows INR as an estimate for the visitor's location. Plans and overage terms change.",
    "Peakhour does not claim BOGO, tiered or volume offers, stacking, audience offers or offer A/B tests; those cells say Unknown.",
  ],
  faqs: [
    { q: "Is there a Discount Ninja alternative for Shopify?", a: "Peakhour is one option if you want a campaign discount created on approval and ended on schedule, and markdowns within a margin floor. If you need many offer types, stacking or audience-only offers, read Discount Ninja's own pages first." },
    { q: "Where does this information come from?", a: "Only from Discount Ninja's own public pages and its Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
