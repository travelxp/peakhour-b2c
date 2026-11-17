import { PEAKHOUR, pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://getmanifest.ai/", label: "Manifest AI home page" },
  pricing: { href: "https://getmanifest.ai/pricing", label: "Manifest AI pricing" },
  listing: { href: "https://apps.shopify.com/manifest-ai-shopping-assistant", label: "Manifest AI on the Shopify App Store" },
};

export const MANIFEST_AI = {
  slug: "manifest-ai" as const,
  pageId: "shopify.compare.manifest.ai",
  name: "Manifest AI",
  url: "https://getmanifest.ai/",
  category: "AI sales and support agent for online stores",
  observedAt: D,
  title: "Peakhour vs Manifest AI for Shopify",
  description:
    "Peakhour and Manifest AI compared for Shopify stores: catalogue answers, chat, recommendations, WhatsApp, handover and pricing, sourced.",
  h1: "Peakhour vs Manifest AI for Shopify",
  directAnswer:
    "Manifest AI is an AI agent for online stores that answers from your catalogue and runs on chat, WhatsApp, Instagram, voice and email. Peakhour also puts an assistant and product shelves on your Shopify storefront, and sends a checkout link on WhatsApp when a shopper agrees to buy. Manifest AI does not publish its prices on its own site. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "An assistant on the storefront", body: "You want shoppers to ask questions and get product suggestions while they browse." },
    { title: "One agent on many channels", body: "You want the same agent on chat, WhatsApp, Instagram and email." },
    { title: "Handover to your team", body: "You want what the agent cannot answer passed to your existing support tools." },
    { title: "Cash on delivery", body: "You sell mostly cash on delivery and want orders confirmed before shipping." },
  ],
  claims: [
    {
      dimension: "AI replies from your catalogue",
      vendor: { value: "yes", note: "It says it syncs automatically with your product catalogue, descriptions and store pages such as policies and FAQs.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Chat on your storefront",
      vendor: { value: "yes", note: "A website chat widget is listed among its channels.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.storefrontChat,
    },
    {
      dimension: "Product recommendations",
      vendor: { value: "yes", note: "It says recommendations come from your actual catalogue. The Shopify listing names AI Product Recommendations.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Human handover",
      vendor: { value: "yes", note: "It says it hands off what it cannot answer to your existing helpdesk, email, live chat or WhatsApp.", source: S.home, observedAt: D },
      peakhour: pending("support.whatsapp_support"),
    },
    {
      dimension: "Chat on WhatsApp",
      vendor: { value: "yes", note: "WhatsApp is listed with chat widget, Instagram, voice calling and email. The Shopify listing does not mention WhatsApp.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.whatsappBuyingStep,
    },
    {
      dimension: "COD confirmation",
      vendor: { value: "not-documented", note: "Cash on delivery is not mentioned on the pages we read.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.codConfirmation,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "partial", note: "It says to install the app, let it sync with your store, and test it privately before going live. It does not say \"no developer\" in so many words.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Shopify App Store listing", price: "Free to install, additional charges may apply; 7-day free trial; no amounts shown", currency: "USD (charges billed in USD)", region: "Not stated", observedAt: D, source: S.listing },
      { plan: "Plans on its own site", price: "Not published (its pricing page lists no plans; it offers a demo)", currency: "Not stated", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Manifest AI", bestFor: "Stores that want one AI agent across chat, WhatsApp, Instagram, voice and email, handing over to the helpdesk they already use." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want a storefront assistant and product shelves from one product, answering from their own catalogue, with cash-on-delivery confirmation on WhatsApp." },
  ],
  limitations: [
    "We read only Manifest AI's own public pages and its Shopify App Store listing. A feature it does not document is marked Not documented, which is not the same as No.",
    "Manifest AI states no plan prices on either page we read, so we record none. Plans, trials and offers change.",
    "Its Shopify listing is inconsistent about languages (English listed, all languages claimed in the description).",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Manifest AI alternative for Shopify?", a: "Peakhour is one option, with an assistant and product shelves on the storefront, and a checkout link sent on WhatsApp when a shopper agrees to buy. Check Manifest AI's own pages for its channels." },
    { q: "Where does this information come from?", a: "Only from Manifest AI's own site and its Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
