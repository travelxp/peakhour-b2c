import { PEAKHOUR, pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-15";
const S = {
  home: { href: "https://aisensy.com/", label: "AiSensy home page" },
  pricing: { href: "https://aisensy.com/pricing", label: "AiSensy pricing" },
  broadcast: { href: "https://aisensy.com/features/whatsapp-broadcasting", label: "AiSensy broadcasting" },
  shopify: { href: "https://aisensy.com/integrations/shopify", label: "AiSensy Shopify integration" },
  agents: { href: "https://aisensy.com/features/ai-agents-on-whatsapp", label: "AiSensy AI agents" },
};

export const AISENSY = {
  slug: "aisensy" as const,
  pageId: "shopify.compare.aisensy",
  name: "AiSensy",
  url: "https://aisensy.com/",
  category: "WhatsApp-first marketing and support platform",
  observedAt: D,
  title: "Peakhour vs AiSensy for Shopify",
  description:
    "Peakhour and AiSensy compared for Shopify stores: broadcasts, COD, AI replies, chat and pricing, each cell sourced and dated.",
  h1: "Peakhour vs AiSensy for Shopify",
  directAnswer:
    "AiSensy is built around WhatsApp: broadcasts, chatbots and Shopify order flows. Peakhour is built around the store itself, with an AI shopping assistant and product shelves on your storefront. Which fits depends on whether your main job is messaging customers or selling on the storefront. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Large WhatsApp broadcast campaigns", body: "You send promotions and updates to a big opted-in list and want scheduling and templates." },
    { title: "Cash-on-delivery confirmation", body: "Most of your orders are cash on delivery and you want buyers to confirm before you ship." },
    { title: "Answering shoppers from your catalogue", body: "You want an assistant that knows your products and replies to questions." },
    { title: "Selling on the storefront", body: "You want chat and product shelves on the store itself, not only on WhatsApp." },
  ],
  claims: [
    {
      dimension: "WhatsApp template broadcasts",
      vendor: { value: "yes", note: "Its own page promotes broadcasting, and scheduling broadcasts ahead of time.", source: S.broadcast, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "COD confirmation on WhatsApp",
      vendor: { value: "yes", note: "Its Shopify page lists COD confirmation, follow-up and payment-request flows.", source: S.shopify, observedAt: D },
      peakhour: PEAKHOUR.codConfirmation,
    },
    {
      dimension: "Abandoned-cart reminders",
      vendor: { value: "yes", note: "Up to three automated reminders, per its Shopify page.", source: S.shopify, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "AI replies from your product catalogue",
      vendor: {
        value: "partial",
        note: "Its AI agent is trained on content you upload (websites, PDFs, catalogues). A live Shopify catalogue sync is not described.",
        source: S.agents,
        observedAt: D,
      },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Product recommendations",
      vendor: {
        value: "partial",
        note: "Personalised suggestions inside WhatsApp conversations. Shelves on the storefront are not described.",
        source: S.agents,
        observedAt: D,
      },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Chat on your storefront",
      vendor: { value: "not-documented", note: "Its pages describe WhatsApp, not a website chat widget.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.storefrontChat,
    },
    {
      dimension: "Human handover",
      vendor: { value: "yes", note: "The AI agent \"escalates to humans when needed\".", source: S.agents, observedAt: D },
      peakhour: pending("support.whatsapp_support"),
    },
    {
      dimension: "Setup without a developer",
      vendor: {
        value: "yes",
        note: "Shopify: install the app and paste the app token. The AI agent builder is a visual, no-code interface.",
        source: S.shopify,
        observedAt: D,
      },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Chatbot builder (5 chatbots)", price: "₹2,500 per month, or ₹2,250 per month billed annually", currency: "INR", region: "India", observedAt: D, source: S.pricing },
      { plan: "AI agent builder (1,000 AI messages)", price: "₹1,350 per month, or ₹1,215 per month billed annually", currency: "INR", region: "India", observedAt: D, source: S.pricing },
      { plan: "Main subscription (monthly, quarterly, yearly)", price: "Base price not stated on the page when we read it", currency: "INR", region: "India", observedAt: D, source: S.pricing },
      { plan: "WhatsApp marketing message", price: "₹1.09 per message", currency: "INR", region: "India", observedAt: D, source: S.pricing },
      { plan: "WhatsApp utility message", price: "₹0.145 per message", currency: "INR", region: "India", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "AiSensy", bestFor: "Merchants whose main channel is WhatsApp: broadcast campaigns, chatbot flows and Shopify order and cash-on-delivery messages, if the documented flows match what you send." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want an AI shopping assistant and product shelves on the storefront, answering from their own catalogue." },
  ],
  limitations: [
    "We read only AiSensy's own public pages. A feature it does not document is marked Not documented, which is not the same as No.",
    "Pricing is copied from its pricing page on the date shown; plans, taxes and message rates change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there an AiSensy alternative for Shopify?", a: "Peakhour is one option if you want an AI shopping assistant and product shelves on your storefront. If broadcasts are your main use, check AiSensy's own broadcasting page first." },
    { q: "Where does this information come from?", a: "Only from AiSensy's own public pages, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
