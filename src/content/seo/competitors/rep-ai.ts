import { PEAKHOUR, pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-15";
const S = {
  home: { href: "https://hellorep.ai/", label: "Rep AI home page" },
  pricing: { href: "https://hellorep.ai/pricing", label: "Rep AI pricing" },
  sales: { href: "https://hellorep.ai/platform/sales-agent", label: "Rep AI sales agent" },
  whatsapp: { href: "https://hellorep.ai/channel/whatsapp", label: "Rep AI on WhatsApp" },
};

export const REP_AI = {
  slug: "rep-ai" as const,
  pageId: "shopify.compare.rep.ai",
  name: "Rep AI",
  url: "https://hellorep.ai/",
  category: "AI sales and support assistant for online stores",
  observedAt: D,
  title: "Peakhour vs Rep AI for Shopify",
  description:
    "Peakhour and Rep AI compared for Shopify stores: catalogue answers, storefront chat, recommendations, handover and pricing, sourced.",
  h1: "Peakhour vs Rep AI for Shopify",
  directAnswer:
    "Rep AI is an AI sales and support assistant for online stores, sold by sessions and per resolved conversation. Peakhour also puts an assistant and product shelves on your storefront, and, on WhatsApp, sends a checkout link when a shopper agrees to buy. Both answer from your Shopify catalogue. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "An assistant on the product page", body: "You want shoppers to ask questions and get product suggestions while they browse." },
    { title: "Support with handover", body: "You want routine questions answered and complex ones passed to your team with history." },
    { title: "Chat on WhatsApp too", body: "You want the same assistant to answer on WhatsApp." },
    { title: "Cash on delivery", body: "You sell mostly cash on delivery and want orders confirmed before shipping." },
  ],
  claims: [
    {
      dimension: "AI replies from your Shopify catalogue",
      vendor: { value: "yes", note: "It says it searches your live Shopify catalogue in real time.", source: S.sales, observedAt: D },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Chat on your storefront",
      vendor: { value: "yes", note: "An on-site chat widget, a search bar and a product page assistant.", source: S.sales, observedAt: D },
      peakhour: PEAKHOUR.storefrontChat,
    },
    {
      dimension: "Product recommendations",
      vendor: { value: "yes", note: "It says it recommends complementary items from your live catalogue, inside the conversation.", source: S.sales, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Human handover",
      vendor: { value: "yes", note: "Automatic routing to human support, with the conversation history.", source: S.home, observedAt: D },
      peakhour: pending("support.whatsapp_support"),
    },
    {
      dimension: "Sales and checkout on WhatsApp",
      vendor: { value: "yes", note: "It says it handles sales questions, order updates and support on WhatsApp. WhatsApp is priced as an add-on.", source: S.whatsapp, observedAt: D },
      peakhour: PEAKHOUR.whatsappBuyingStep,
    },
    {
      dimension: "WhatsApp template broadcasts",
      vendor: { value: "not-documented", note: "Its WhatsApp page does not mention broadcasts or templates.", source: S.whatsapp, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "COD confirmation",
      vendor: { value: "not-documented", note: "Cash on delivery is not mentioned on the pages we read.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.codConfirmation,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "partial", note: "It says \"Live in 6 clicks\" and that its team handles the setup. It does not say \"no developer\" in so many words.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Sales (up to 3,000 sessions)", price: "$29 per month billed annually, $39 billed monthly", currency: "USD ($)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Support (up to 3,000 sessions)", price: "$15 per month billed annually, $19 billed monthly", currency: "USD ($)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Concierge (sales and support)", price: "$37 per month billed annually, $46 billed monthly", currency: "USD ($)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "AI on WhatsApp, email and social", price: "$0.75 per AI-resolved conversation, $0.50 billed annually", currency: "USD ($)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Enterprise (above 500,000 sessions)", price: "Not published (custom)", currency: "USD ($)", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Rep AI", bestFor: "Stores that want a dedicated AI sales and support assistant on the storefront, with handover to a helpdesk." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want a storefront assistant and product shelves from one product, answering from their own catalogue." },
  ],
  limitations: [
    "We read only Rep AI's own public pages. A feature it does not document is marked Not documented, which is not the same as No.",
    "Its pricing page shows $ without naming a country or currency code; we record it as shown. Plans, trials and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Rep AI alternative for Shopify?", a: "Peakhour is one option, with an assistant and product shelves on the storefront, and a checkout link sent on WhatsApp when a shopper agrees to buy. Check Rep AI's own pages for its sales and support agents." },
    { q: "Where does this information come from?", a: "Only from Rep AI's own public pages, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
