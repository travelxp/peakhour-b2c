import { PEAKHOUR, pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  pricing: { href: "https://www.tidio.com/pricing/", label: "Tidio pricing" },
  lyro: { href: "https://www.tidio.com/lyro/", label: "Tidio Lyro AI agent" },
};

export const TIDIO = {
  slug: "tidio" as const,
  pageId: "shopify.compare.tidio",
  name: "Tidio",
  url: "https://www.tidio.com/",
  category: "Live chat and AI customer service platform (Lyro AI agent)",
  observedAt: D,
  title: "Peakhour vs Tidio for Shopify",
  description:
    "Peakhour and Tidio compared for Shopify stores: live chat, Lyro AI replies, recommendations, WhatsApp, COD and pricing, each cell sourced.",
  h1: "Peakhour vs Tidio for Shopify",
  directAnswer:
    "Tidio is a live chat and customer service platform with a Lyro AI agent, no-cost entry and WhatsApp on every plan. Peakhour puts an AI shopping assistant and product shelves on your Shopify storefront and asks cash-on-delivery buyers to confirm on WhatsApp. Choose by whether you want a general chat and service tool or a store-focused assistant. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Live chat plus AI", body: "You want one chat widget for your team and an AI agent for routine questions." },
    { title: "Product suggestions in chat", body: "You want shoppers guided to products while they browse." },
    { title: "Chat on WhatsApp", body: "You want to answer customers on WhatsApp as well as the site." },
    { title: "Cash on delivery", body: "You sell mostly cash on delivery and want orders confirmed before shipping." },
  ],
  claims: [
    {
      dimension: "Chat on your storefront",
      vendor: { value: "yes", note: "Live Chat is included on all plans.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR.storefrontChat,
    },
    {
      dimension: "AI replies from your Shopify catalogue",
      vendor: { value: "not-documented", note: "The Lyro page does not describe answering from a Shopify catalogue. The pricing page lists \"Native Shopify actions\" on Growth, Plus and Premium.", source: S.lyro, observedAt: D },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Product recommendations",
      vendor: { value: "yes", note: "Lyro product recommendations come with a paid Lyro AI Agent quota (50 to 1,000 conversations).", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Human handover",
      vendor: { value: "yes", note: "It says Lyro alerts your team instantly when a customer needs human help.", source: S.lyro, observedAt: D },
      peakhour: pending("support.whatsapp_support"),
    },
    {
      dimension: "Chat on WhatsApp",
      vendor: { value: "yes", note: "\"WhatsApp integration\" is listed on all plans.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR.whatsappBuyingStep,
    },
    {
      dimension: "COD confirmation",
      vendor: { value: "not-documented", note: "Cash on delivery is not mentioned on the pages we read.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR.codConfirmation,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "yes", note: "It says you can add Lyro \"in a few clicks, without technical knowledge\".", source: S.lyro, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Free (50 billable conversations)", price: "$0 per month", currency: "USD (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Starter (100 billable conversations)", price: "$24.17 per month", currency: "USD (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Growth (from 250 billable conversations)", price: "Starts at $49.17 per month", currency: "USD (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Plus", price: "Starts at $300 per month, plus monthly usage", currency: "USD (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Premium", price: "Not published (contact for pricing)", currency: "USD (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Lyro AI Agent add-on (from 50 Lyro conversations)", price: "Starts at $32.50 per month", currency: "USD (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Tidio", bestFor: "Stores that want live chat for their team with an AI agent on top, a no-cost way to start, and WhatsApp on every plan." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want a shopping assistant and product shelves from one product, answering from their own catalogue, with cash-on-delivery confirmation on WhatsApp." },
  ],
  limitations: [
    "We read only Tidio's own public pages. A feature it does not document is marked Not documented, which is not the same as No.",
    "Its pricing page shows $ without naming a country, and prices are per month; annual billing is labelled \"2 months free\" without listed annual prices. The Growth card and the comparison table on the page differ on the conversation count.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Tidio alternative for Shopify?", a: "Peakhour is one option, with an assistant and product shelves on the storefront, and cash-on-delivery confirmation on WhatsApp. Check Tidio's own pages for live chat and Lyro." },
    { q: "Where does this information come from?", a: "Only from Tidio's own public pages, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
