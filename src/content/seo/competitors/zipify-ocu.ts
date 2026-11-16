import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import { PEAKHOUR_W3A } from "./peakhour-w3a";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  ocu: { href: "https://zipify.com/ocu", label: "Zipify OCU product page" },
  billing: { href: "https://help.zipify.com/en/articles/4571658-plan-billing-for-your-subscription-ocu", label: "Zipify OCU plan billing" },
  listing: { href: "https://apps.shopify.com/zipify-oneclickupsell", label: "Zipify OCU on the Shopify App Store" },
};

export const ZIPIFY_OCU = {
  slug: "zipify-ocu" as const,
  pageId: "shopify.compare.zipify.ocu",
  relatedIds: ["shopify", "shopify.features.cart.upsells", "shopify.features.bundles", "pricing"],
  name: "Zipify OCU",
  url: "https://zipify.com/ocu",
  category: "One-click upsell app for Shopify",
  observedAt: D,
  title: "Peakhour vs Zipify OCU for Shopify upsells",
  description: "Peakhour cart and thank-you suggestions compared with Zipify OCU one-click upsells on Shopify: offers, tests, setup and pricing, each sourced and dated.",
  h1: "Peakhour vs Zipify OCU: cart and thank-you upsells on Shopify",
  directAnswer:
    "Zipify OCU is a dedicated upsell app with one-click post-purchase offers, a cart drawer with upsells, thank-you page offers and split testing, priced by the upsell revenue it earns. Peakhour shows cart suggestions and thank-you page links drawn from what customers bought together, and cannot add an item to the order from the thank-you page. If one-click offers are the job, OCU documents far more. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "One-click offers after checkout", body: "You want a shopper to add an item with one tap after ordering." },
    { title: "A cart drawer with upsells", body: "You want offers in a slide-out cart." },
    { title: "Pay only when it earns", body: "You prefer a price that follows the upsell revenue it makes you." },
    { title: "Light cart suggestions", body: "You want sensible suggestions without building funnels." },
  ],
  claims: [
    {
      dimension: "One-click post-purchase offers that add to the order",
      vendor: { value: "yes", note: "One-click post-purchase upsells and downsells.", source: S.ocu, observedAt: D },
      peakhour: PEAKHOUR_W3A.noOneClickAdd,
    },
    {
      dimension: "Thank-you page offers",
      vendor: { value: "yes", note: "Thank-you page offers are listed.", source: S.ocu, observedAt: D },
      peakhour: PEAKHOUR_W3A.thankYouLinks,
    },
    {
      dimension: "Cart page suggestions",
      vendor: { value: "yes", note: "A slide cart drawer with cart upsells.", source: S.ocu, observedAt: D },
      peakhour: PEAKHOUR_C.cartUpsells,
    },
    {
      dimension: "How suggestions are picked",
      vendor: { value: "yes", note: "AI product recommendations, and on its listing targeting by product, cart value and customer tags.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3A.picks,
    },
    {
      dimension: "A/B tests of offers",
      vendor: { value: "yes", note: "Split testing (A/B/C/D).", source: S.ocu, observedAt: D },
      peakhour: PEAKHOUR_C.abTesting,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "yes", note: "Its FAQ says no coding or theme edits; every placement is added from its dashboard.", source: S.ocu, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "One plan, up to $200 of monthly upsell revenue", price: "From $9.95 per month; the price rises with upsell revenue", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.ocu },
      { plan: "Higher tiers by upsell revenue", price: "$25 per month for $200 to $500, then $49 per month for $500 to $1,000, and so on", currency: "USD (bare $, code not stated)", region: "Not stated; its help centre says this applies to new installs from 21 September 2026", observedAt: D, source: S.billing },
    ],
  },
  bestFor: [
    { vendor: "Zipify OCU", bestFor: "Stores that want one-click post-purchase offers, a cart drawer with upsells and split tests, and a price that grows only as the upsell revenue grows." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want cart suggestions and thank-you page links drawn from what their own customers bought together, inside one suite, and do not need to add an item to the order after checkout." },
  ],
  limitations: [
    "We read only Zipify's own public pages: its OCU page, its help centre and its Shopify App Store listing. A feature a page does not document is marked Not documented, which is not the same as No.",
    "Its pages show a bare $ with no currency code or region. Pricing follows the upsell revenue OCU earns, and its own pages and listing show different tier amounts; its help centre says the amounts we show apply to new installs from 21 September 2026. Plans and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Zipify OCU alternative for Shopify?", a: "Peakhour is one option if you want cart suggestions and thank-you page links from what customers bought together, within a wider suite. If one-click offers are your main need, read Zipify's own pages first." },
    { q: "Where does this information come from?", a: "Only from Zipify's own public pages, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
