import { PEAKHOUR, pending } from "./peakhour";
import { PEAKHOUR_C } from "./peakhour-cmp-c";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const B = "https://www.rebuyengine.com";
const S = {
  home: { href: `${B}/`, label: "Rebuy home page" },
  pricing: { href: `${B}/pricing`, label: "Rebuy pricing" },
  merch: { href: `${B}/product/merchandising`, label: "Rebuy merchandising" },
  postPurchase: { href: `${B}/product/post-purchase`, label: "Rebuy post-purchase" },
  bundles: { href: `${B}/product/dynamic-bundles`, label: "Rebuy dynamic bundles" },
  ab: { href: `${B}/product/ab-testing`, label: "Rebuy A/B testing" },
  search: { href: `${B}/product/smart-search`, label: "Rebuy smart search" },
  builder: { href: `${B}/product/bundle-builder`, label: "Rebuy bundle builder" },
  checkout: { href: `${B}/product/checkout-extensions`, label: "Rebuy checkout extensions" },
};

export const REBUY = {
  slug: "rebuy" as const,
  pageId: "shopify.compare.rebuy",
  relatedIds: ["shopify", "shopify.features.product.recommendations", "shopify.features.frequently.bought.together", "pricing"],
  name: "Rebuy",
  url: `${B}/`,
  category: "Personalisation and upsell platform for Shopify",
  observedAt: D,
  title: "Peakhour vs Rebuy for Shopify",
  description: "Peakhour and Rebuy compared for Shopify stores: recommendations, upsells, bundles, A/B tests and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Rebuy for Shopify",
  directAnswer:
    "Rebuy is a deep personalisation and upsell platform: recommendations, cart and post-purchase offers, bundles, search and experiments. Peakhour covers shelves, cart suggestions, bundles and shelf tests too, and adds an AI shopping assistant that answers from your catalogue. Rebuy documents far more on checkout and post-purchase offers; Peakhour is the lighter option if you also want the assistant. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Lifting order value", body: "You want recommendations, cart suggestions and bundles that raise what each shopper spends." },
    { title: "Testing what works", body: "You want to compare two strategies in the same spot and keep the winner." },
    { title: "Checkout and post-purchase offers", body: "You want offers at checkout or after the order, and may be on Shopify Plus." },
    { title: "Answering shoppers from your catalogue", body: "You want an assistant that knows your products and replies to questions." },
  ],
  claims: [
    {
      dimension: "Product recommendations on the storefront",
      vendor: { value: "yes", note: "Its merchandising page says recommendations can live on any page.", source: S.merch, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Cart and post-purchase offers",
      vendor: { value: "yes", note: "Smart Cart, checkout extensions and post-purchase offers are documented.", source: S.postPurchase, observedAt: D },
      peakhour: PEAKHOUR_C.cartUpsells,
    },
    {
      dimension: "Bundles",
      vendor: { value: "partial", note: "Dynamic bundles and a bundle builder are documented. The page we read does not state a shopper discount on bundles.", source: S.bundles, observedAt: D },
      peakhour: PEAKHOUR_C.bundles,
    },
    {
      dimension: "A/B tests of strategies",
      vendor: { value: "yes", note: "Low-code experiments, described as unlimited.", source: S.ab, observedAt: D },
      peakhour: PEAKHOUR_C.abTesting,
    },
    {
      dimension: "AI shopping assistant that chats with shoppers",
      vendor: { value: "partial", note: "AI-powered search is documented. We did not find a conversational assistant on its own pages.", source: S.search, observedAt: D },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "partial", note: "Its pages describe a drag-and-drop editor and low-code tools, and say most brands launch with minimal technical support.", source: S.builder, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Checkout extensions",
      vendor: { value: "yes", note: "Documented, and stated as available only to brands on Shopify Plus.", source: S.checkout, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Rebuy Monetize", price: "Free (\"always free\" on its pricing page)", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Cart and Merchandising package, up to 500 orders a month", price: "$45 per month", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Cart and Merchandising package, up to 5,000 orders a month", price: "$425 per month", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Checkout and Post-Purchase package, up to 500 orders a month", price: "$25 per month", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Any package above 10,000 orders a month", price: "Not published (talk to sales)", currency: "Not stated", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Rebuy", bestFor: "Stores that want one dedicated engine for recommendations, checkout and post-purchase offers, search and unlimited experiments, and are happy to price by monthly orders. It documents far more in checkout and post-purchase than we do." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want shelves, cart suggestions, bundles and shelf tests together with an AI shopping assistant that answers from their own catalogue." },
  ],
  limitations: [
    "We read only Rebuy's own public pages. Its Shopify App Store listing did not load for us, so no listing price is shown. A feature a page does not document is marked Not documented, which is not the same as No.",
    "Its pricing page shows a bare $ with no currency code or region; we record it as shown. Package prices scale with monthly orders, and plans and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Rebuy alternative for Shopify?", a: "Peakhour is one option if you want shelves, cart suggestions and bundles together with an AI shopping assistant. If checkout and post-purchase offers are your main need, read Rebuy's own pages first." },
    { q: "Where does this information come from?", a: "Only from Rebuy's own public pages, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
