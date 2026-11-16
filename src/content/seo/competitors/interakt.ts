import { PEAKHOUR, pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-15";
const S = {
  home: { href: "https://www.interakt.shop/", label: "Interakt home page" },
  pricing: { href: "https://www.interakt.shop/pricing", label: "Interakt pricing" },
  agents: { href: "https://www.interakt.shop/whatsapp-ai-agents/", label: "Interakt AI agents" },
  shopify: { href: "https://www.interakt.shop/integrations/integrating-whatsapp-business-api-with-shopify/", label: "Interakt Shopify guide" },
};

export const INTERAKT: CompetitorBrief = {
  slug: "interakt",
  pageId: "shopify.compare.interakt",
  name: "Interakt",
  url: "https://www.interakt.shop/",
  category: "WhatsApp and Instagram messaging platform with a shared inbox",
  observedAt: D,
  title: "Peakhour vs Interakt for Shopify",
  description:
    "Peakhour and Interakt compared for Shopify stores: broadcasts, COD flows, AI replies, inbox, checkout and pricing, each cell sourced.",
  h1: "Peakhour vs Interakt for Shopify",
  directAnswer:
    "Interakt is a WhatsApp and Instagram messaging platform with broadcasts, a shared team inbox and Shopify flows. Peakhour puts an AI shopping assistant on the storefront and asks cash-on-delivery buyers to confirm on WhatsApp. Choose by where your customers talk to you. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Broadcasts and campaigns", body: "You run one-time and ongoing WhatsApp campaigns and want tracking." },
    { title: "A shared team inbox", body: "Several people answer customers on WhatsApp and Instagram." },
    { title: "Cash on delivery to prepaid", body: "You want to nudge cash-on-delivery buyers to pay in advance." },
    { title: "Selling on the storefront", body: "You want an assistant answering from your catalogue on the store itself." },
  ],
  claims: [
    {
      dimension: "WhatsApp template broadcasts",
      vendor: { value: "yes", note: "One-time and ongoing campaigns on every WhatsApp plan; tracking and triggers on higher plans.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "COD confirmation or COD to prepaid",
      vendor: { value: "partial", note: "A \"CoD to Prepaid Flow\" is listed from its ₹2,799 tier up. Plain COD confirmation is not described.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR.codConfirmation,
    },
    {
      dimension: "Abandoned-cart reminders",
      vendor: { value: "yes", note: "Simple reminders on the entry WhatsApp tier, multiple reminders from the ₹2,799 tier.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "AI replies from your product catalogue",
      vendor: {
        value: "partial",
        note: "Its AI agents use website and catalogue context and suggest products from a Meta catalogue. AI Agents are a paid add-on.",
        source: S.agents,
        observedAt: D,
      },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Shared team inbox",
      vendor: { value: "yes", note: "WhatsApp on every plan; Instagram from Growth.", source: S.pricing, observedAt: D },
      peakhour: pending("support.channel_inbox"),
    },
    {
      dimension: "WhatsApp checkout and payments",
      vendor: { value: "yes", note: "Payment links from the inbox on the entry WhatsApp tier; checkout bot and WhatsApp Pay from the ₹2,799 tier.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR.whatsappBuyingStep,
    },
    {
      dimension: "Chat on your storefront",
      vendor: { value: "not-documented", note: "Its pages describe WhatsApp and Instagram, not a website chat widget.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.storefrontChat,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "not-documented", note: "The Shopify guide we read does not describe setup steps.", source: S.shopify, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Starter (Instagram only)", price: "₹999 per month, taxes extra", currency: "INR", region: "India", observedAt: D, source: S.pricing },
      { plan: "Growth (WhatsApp and Instagram)", price: "₹2,799 per month, taxes extra", currency: "INR", region: "India", observedAt: D, source: S.pricing },
      { plan: "Advanced (WhatsApp and Instagram)", price: "₹3,799 per month, taxes extra", currency: "INR", region: "India", observedAt: D, source: S.pricing },
      { plan: "AI Agents", price: "₹2,499 per month with 100 AI messages, then ₹0.50 per message", currency: "INR", region: "India", observedAt: D, source: S.pricing },
      { plan: "Enterprise", price: "Not published (on request)", currency: "INR", region: "India", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Interakt", bestFor: "Teams that run WhatsApp and Instagram campaigns and answer customers together in a shared inbox, including WhatsApp checkout and payments." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want an AI shopping assistant on the storefront, answering from their own catalogue." },
  ],
  limitations: [
    "We read only Interakt's own public pages. A feature it does not document is marked Not documented, which is not the same as No.",
    "Pricing is copied from its pricing page for Indian numbers on the date shown. Taxes are extra and other regions are priced separately.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there an Interakt alternative for Shopify?", a: "Peakhour is one option if you want an AI assistant on your storefront. If a shared WhatsApp and Instagram inbox is the need, check Interakt's own pages first." },
    { q: "Where does this information come from?", a: "Only from Interakt's own public pages, each linked in the table with the date we read it." },
  ],
};
