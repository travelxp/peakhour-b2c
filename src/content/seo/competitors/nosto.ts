import { PEAKHOUR, pending } from "./peakhour";
import { PEAKHOUR_C } from "./peakhour-cmp-c";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://www.nosto.com/", label: "Nosto home page" },
  pricing: { href: "https://www.nosto.com/pricing", label: "Nosto pricing" },
  listing: { href: "https://apps.shopify.com/nosto-personalization-for-shopify", label: "Nosto on the Shopify App Store" },
};

export const NOSTO = {
  slug: "nosto" as const,
  pageId: "shopify.compare.nosto",
  relatedIds: ["shopify", "shopify.features.product.recommendations", "pricing"],
  name: "Nosto",
  url: "https://www.nosto.com/",
  category: "Commerce experience and personalisation platform",
  observedAt: D,
  title: "Peakhour vs Nosto for Shopify",
  description: "Peakhour and Nosto compared for Shopify stores: recommendations, search, tests, an AI assistant and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Nosto for Shopify",
  directAnswer:
    "Nosto is an enterprise-style platform covering recommendations, AI search, content personalisation, category merchandising and email, priced by quote. Peakhour is narrower: shelves, shelf tests and an AI shopping assistant that answers from your catalogue. If you need search or merchandising at volume, Nosto documents far more. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Personalisation at volume", body: "You run a large catalogue or high traffic and want recommendations, search and merchandising from one platform." },
    { title: "Testing what works", body: "You want to compare two strategies in the same spot and keep the winner." },
    { title: "Answering shoppers from your catalogue", body: "You want an assistant that knows your products and replies to questions." },
  ],
  claims: [
    {
      dimension: "Product recommendations",
      vendor: { value: "yes", note: "Listed on its pricing page and its Shopify listing.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "AI search on the storefront",
      vendor: { value: "yes", note: "Its listing describes personalised AI search.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Personalised content, pop-ups and category merchandising",
      vendor: { value: "yes", note: "Content personalisation, pop-ups and category merchandising are listed.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "A/B tests",
      vendor: { value: "yes", note: "A/B testing and optimisation is listed.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_C.abTesting,
    },
    {
      dimension: "Email",
      vendor: { value: "partial", note: "Personalised emails are a listed module. We found no SMS on its home or pricing pages.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "AI shopping assistant that chats with shoppers",
      vendor: { value: "not-documented", note: "Its pages describe an AI agent, Huginn, but we could not confirm a shopper-facing chat.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "not-documented", note: "Its pages say integrations help you go live faster, with no statement about developer work.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Platform plan", price: "Not published (a base fee plus a volume fee, quoted after a demo)", currency: "Not stated", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Self-service free trial", price: "Not published (no self-service trial as standard; a proof of concept can be requested)", currency: "Not stated", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Shopify listing", price: "Free to install, but a Nosto account is required and is not free; charges are billed in USD by Nosto", currency: "USD", region: "Not stated", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "Nosto", bestFor: "Larger stores with the traffic and catalogue to justify a quoted platform that covers recommendations, AI search, merchandising and email together." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want shelves and shelf tests together with an AI shopping assistant that answers from their own catalogue, without a sales process." },
  ],
  limitations: [
    "We read only Nosto's own public pages and its Shopify listing. Its help centre was not read, so setup and SMS details are not documented here.",
    "Nosto does not publish prices, so no price comparison is possible. Currency is stated as USD only on the listing.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Nosto alternative for Shopify?", a: "Peakhour is one option if you want shelves, shelf tests and an AI shopping assistant. If you need AI search or category merchandising at volume, read Nosto's own pages first." },
    { q: "Where does this information come from?", a: "Only from Nosto's own public pages and its Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
