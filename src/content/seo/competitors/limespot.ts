import { PEAKHOUR, pending } from "./peakhour";
import { PEAKHOUR_C } from "./peakhour-cmp-c";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://limespot.com/", label: "LimeSpot home page" },
  pricing: { href: "https://limespot.com/pricing", label: "LimeSpot pricing" },
  recs: { href: "https://limespot.com/smart-recommendations", label: "LimeSpot smart recommendations" },
  offers: { href: "https://limespot.com/personalized-discounts-offers", label: "LimeSpot discounts and offers" },
  listing: { href: "https://apps.shopify.com/limespot", label: "LimeSpot on the Shopify App Store" },
};

export const LIMESPOT = {
  slug: "limespot" as const,
  pageId: "shopify.compare.limespot",
  relatedIds: ["shopify", "shopify.features.product.recommendations", "shopify.features.frequently.bought.together", "pricing"],
  name: "LimeSpot",
  url: "https://limespot.com/",
  category: "Product recommendation and upsell app for Shopify",
  observedAt: D,
  title: "Peakhour vs LimeSpot for Shopify",
  description: "Peakhour and LimeSpot compared for Shopify stores: recommendations, bundles, upsells, tests and pricing, each cell sourced and dated.",
  h1: "Peakhour vs LimeSpot for Shopify",
  directAnswer:
    "LimeSpot focuses on product recommendations, upsells, bundles and personalised email and SMS. Peakhour covers shelves, cart suggestions and bundles too, and adds an AI shopping assistant that answers from your catalogue. LimeSpot documents email and SMS personalisation, which Peakhour does not claim. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Recommendations and upsells", body: "You want suggestions on product, cart and post-purchase pages." },
    { title: "Bundles with a discount", body: "You want frequently bought together bundles that carry an offer." },
    { title: "Personalised email and SMS", body: "You want recommendations carried into your messages." },
    { title: "Answering shoppers from your catalogue", body: "You want an assistant that knows your products and replies to questions." },
  ],
  claims: [
    {
      dimension: "Product recommendations",
      vendor: { value: "yes", note: "AI-powered product suggestions; its Shopify listing says they can appear on any page.", source: S.recs, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Cart and post-purchase offers",
      vendor: { value: "yes", note: "Cart and bundle upsells on its Shopify listing; AI offers on the post-purchase page on its own site.", source: S.offers, observedAt: D },
      peakhour: PEAKHOUR_C.cartUpsells,
    },
    {
      dimension: "Bundles with discounts",
      vendor: { value: "yes", note: "Auto-generated frequently bought together bundles, with personalised bundle discounts on its Max plan.", source: S.offers, observedAt: D },
      peakhour: PEAKHOUR_C.bundles,
    },
    {
      dimension: "A/B tests",
      vendor: { value: "yes", note: "A/B/n testing and advanced analytics, listed under its Max plan.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.abTesting,
    },
    {
      dimension: "Personalised email and SMS",
      vendor: { value: "yes", note: "Email and SMS personalisation is listed, with Klaviyo, Omnisend and SMSBump integrations.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "AI shopping assistant that chats with shoppers",
      vendor: { value: "not-documented", note: "Neither its home page nor its listing describes one.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "yes", note: "Its home page says no developer is required.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Shopify Plus stores",
      vendor: { value: "not-supported", note: "Its listing marks both paid plans as not compatible with Shopify Plus.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Max on its own site, up to $50,000 revenue per 30 days", price: "$150 per month, 15-day free trial", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Free on its Shopify listing", price: "Free for up to 10 orders a month, then order-based fees", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Turbo on its Shopify listing", price: "₹941.65 per month plus order-based fees, 15-day free trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Max on its Shopify listing", price: "₹4,712.98 per month plus revenue-based fees, 15-day free trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "LimeSpot", bestFor: "Stores that want recommendations, discounted bundles and personalised email and SMS from one app, and are not on Shopify Plus." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want shelves, bundles and shelf tests together with an AI shopping assistant that answers from their own catalogue." },
  ],
  limitations: [
    "We read only LimeSpot's own public pages and its Shopify listing. A feature a page does not document is marked Not documented, which is not the same as No.",
    "Its own pricing page and its Shopify listing show different prices for the same plan name, and we did not reconcile them. Both are shown with their source. The listing's order and revenue fee schedules are not reproduced.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a LimeSpot alternative for Shopify?", a: "Peakhour is one option if you want shelves, bundles and shelf tests together with an AI shopping assistant. If personalised email and SMS matter most, check LimeSpot's own pages first." },
    { q: "Where does this information come from?", a: "Only from LimeSpot's own public pages and its Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
