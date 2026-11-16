import { PEAKHOUR, pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  listing: { href: "https://apps.shopify.com/inbox", label: "Shopify Inbox on the Shopify App Store" },
  blog: { href: "https://www.shopify.com/blog/ai-chatbot-customer-service", label: "Shopify guide to AI chatbots for customer service" },
};

/** Shopify's own product: factual and respectful, sourced from Shopify's own pages only. */
export const SHOPIFY_INBOX: CompetitorBrief = {
  slug: "shopify-inbox",
  pageId: "shopify.compare.shopify.inbox",
  name: "Shopify Inbox",
  url: "https://apps.shopify.com/inbox",
  category: "Shopify's own chat app with an AI sales assistant",
  observedAt: D,
  title: "Peakhour vs Shopify Inbox",
  description:
    "Peakhour and Shopify Inbox compared for Shopify stores: storefront chat, catalogue answers, recommendations, WhatsApp, COD and price, sourced.",
  h1: "Peakhour vs Shopify Inbox",
  directAnswer:
    "Shopify Inbox is Shopify's own chat app, free for every store, with an AI sales associate that answers from your catalogue. Peakhour is a separate app that also puts an assistant and product shelves on your storefront, and adds cash-on-delivery confirmation and a checkout link on WhatsApp. The Shopify app is the simplest start; Peakhour covers more of the selling job. Every answer below links to Shopify's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Chat that comes with Shopify", body: "You want shoppers to ask questions on the storefront with nothing extra to pay for." },
    { title: "Product help from the catalogue", body: "You want answers and suggestions drawn from your own products." },
    { title: "Chat on WhatsApp", body: "You want to sell on WhatsApp as well as the storefront." },
    { title: "Cash on delivery", body: "You sell mostly cash on delivery and want orders confirmed before shipping." },
  ],
  claims: [
    {
      dimension: "Chat on your storefront",
      vendor: { value: "yes", note: "Live chat, email chat and AI chatbots are listed under real-time messaging.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR.storefrontChat,
    },
    {
      dimension: "AI replies from your Shopify catalogue",
      vendor: { value: "yes", note: "It describes an AI-powered sales associate on your storefront that connects to your catalogue, inventory and policies automatically.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Product recommendations",
      vendor: { value: "yes", note: "Product recommendations are listed as an automated response feature. Product shelves on pages are not described.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Human handover",
      vendor: { value: "partial", note: "Chat assignment is listed. Shopify's guide does not tie handover to Inbox in so many words.", source: S.blog, observedAt: D },
      peakhour: pending("support.whatsapp_support"),
    },
    {
      dimension: "Chat on WhatsApp",
      vendor: { value: "not-documented", note: "WhatsApp is not mentioned on the listing.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR.whatsappBuyingStep,
    },
    {
      dimension: "COD confirmation",
      vendor: { value: "not-documented", note: "Cash on delivery is not mentioned on the pages we read.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR.codConfirmation,
    },
  ],
  pricing: {
    rows: [
      { plan: "Shopify Inbox", price: "Free; Shopify says it is free for every Shopify store", currency: "No charge", region: "Not stated", observedAt: D, source: S.blog },
    ],
  },
  bestFor: [
    { vendor: "Shopify Inbox", bestFor: "Any Shopify store that wants chat and an AI sales associate built by Shopify, at no cost, with nothing outside Shopify to manage." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who also want product shelves, cash-on-delivery confirmation on WhatsApp and a checkout link sent on WhatsApp." },
  ],
  limitations: [
    "We read only Shopify's own pages (its App Store listing and its blog). A feature it does not document is marked Not documented, which is not the same as No.",
    "The listing says Inbox works only with certain stores; we could not read the criteria, so check your store on Shopify's page.",
    "The two apps can be used together; this page is not a reason to remove Inbox.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Do I need Peakhour if I have Shopify Inbox?", a: "Not necessarily. Inbox is free and covers chat and a sales associate. Peakhour is an option when you also want product shelves and cash-on-delivery confirmation on WhatsApp." },
    { q: "Where does this information come from?", a: "Only from Shopify's own pages, each linked in the table with the date we read it." },
  ],
};
