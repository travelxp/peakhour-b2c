import { PEAKHOUR_W3C as P } from "./peakhour-cmp-w3c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  support: { href: "https://support.boldcommerce.com/bolddiscounts", label: "Bold Discounts help centre" },
  listing: { href: "https://apps.shopify.com/product-discount", label: "Bold Discounts on the Shopify App Store" },
};

export const BOLD_DISCOUNTS = {
  slug: "bold-discounts" as const,
  pageId: "shopify.compare.bold.discounts",
  pillar: "growth",
  relatedIds: ["shopify", "shopify.features.ai.growth.campaigns", "shopify.features.automatic.markdowns", "pricing"],
  name: "Bold Discounts",
  url: "https://support.boldcommerce.com/bolddiscounts",
  category: "Flash sale and automatic discount app for Shopify, by Bold",
  observedAt: D,
  title: "Peakhour vs Bold Discounts for Shopify",
  description: "Peakhour and Bold Discounts compared for Shopify sales: scheduled sales, automatic discounts, tiers, wholesale and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Bold Discounts for Shopify",
  directAnswer:
    "Bold Discounts runs flash sales and scheduled sales, applies automatic discounts without codes, and supports tiered quantity breaks and wholesale pricing. Peakhour creates a Shopify discount when you approve a campaign, ends it on its deadline, and suggests markdowns within your margin floor. Bold documents tiers and wholesale pricing that Peakhour does not claim. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Flash and holiday sales", body: "You want a sale that runs on a schedule across many products." },
    { title: "Automatic discounts", body: "You want prices reduced at checkout without a code." },
    { title: "Quantity breaks and wholesale", body: "You want tiered prices for bigger orders or trade buyers." },
    { title: "Safe sale prices", body: "You want markdowns that stay inside a margin you set." },
  ],
  claims: [
    {
      dimension: "Sales that end on schedule",
      vendor: { value: "yes", note: "Flash sales, and advanced scheduling for offers, campaigns, events and holiday promotions.", source: S.listing, observedAt: D },
      peakhour: P.campaignDeadline,
    },
    {
      dimension: "Discounts created in your Shopify store",
      vendor: { value: "yes", note: "Automatic Scheduled Sales are listed on both of its plans.", source: S.listing, observedAt: D },
      peakhour: P.campaignDiscount,
    },
    {
      dimension: "Tiered quantity breaks",
      vendor: { value: "yes", note: "Tiered quantity break discounts and time-based discounts.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Wholesale pricing",
      vendor: { value: "yes", note: "It manages discounting and wholesale pricing.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Discounts for specific customers",
      vendor: { value: "partial", note: "Help-centre article titles cover specific customers and new customers' first orders. We read the titles, not the articles.", source: S.support, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Promoted products on the storefront",
      vendor: { value: "not-documented", note: "A storefront shelf of promoted products is not described in the listing.", source: S.listing, observedAt: D },
      peakhour: P.campaignShelf,
    },
    {
      dimension: "Markdowns within a margin floor",
      vendor: { value: "not-documented", note: "A margin floor for discounts is not described in the listing.", source: S.listing, observedAt: D },
      peakhour: P.markdowns,
    },
  ],
  pricing: {
    rows: [
      { plan: "Free, development shops only", price: "₹0, for development shops only", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Essentials", price: "₹1,884.25 per month, 14-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "Bold Discounts", bestFor: "Stores that run frequent flash or scheduled sales across many products, and need quantity breaks or wholesale pricing." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want a campaign's discount created when they approve it and ended on its deadline, and markdowns that stay inside a margin floor." },
  ],
  limitations: [
    "We read Bold Discounts' Shopify listing and the titles on its help centre. Its pricing article and its other help articles were not read.",
    "Its listing shows INR as an estimate for the visitor's location; billing is in your store's currency. Plans and offers change.",
    "Peakhour does not claim tiered quantity breaks, wholesale pricing or customer-specific discounts; those cells say Unknown.",
  ],
  faqs: [
    { q: "Is there a Bold Discounts alternative for Shopify?", a: "Peakhour is one option if you want a campaign discount created on approval and ended on schedule, and markdowns within a margin floor. If you need quantity breaks or wholesale pricing, read Bold's own pages first." },
    { q: "Where does this information come from?", a: "Only from Bold's own help centre and its Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
