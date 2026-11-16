import { PEAKHOUR, pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://www.wati.io/", label: "Wati home page" },
  pricing: { href: "https://www.wati.io/pricing/", label: "Wati pricing" },
  shopify: { href: "https://www.wati.io/shopify/", label: "Wati Shopify integration" },
  astra: { href: "https://www.wati.io/products/astra/", label: "Wati Astra AI agents" },
  chatButton: { href: "https://www.wati.io/whatsapp-chat-button/", label: "Wati WhatsApp chat button" },
};

export const WATI: CompetitorBrief = {
  slug: "wati",
  pageId: "shopify.compare.wati",
  name: "Wati",
  url: "https://www.wati.io/",
  category: "WhatsApp-first team inbox, broadcast and chatbot platform",
  observedAt: D,
  title: "Peakhour vs Wati for Shopify",
  description:
    "Peakhour and Wati compared for Shopify stores: broadcasts, COD, AI replies, chat, shared inbox and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Wati for Shopify",
  directAnswer:
    "Wati is built around WhatsApp: a shared team inbox, broadcasts, a no-code chatbot and an AI agent, with a Shopify integration. Peakhour is built around the store itself, with an AI shopping assistant and product shelves on your storefront. Which fits depends on whether your main job is running WhatsApp conversations as a team or selling on the storefront. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "A team answering WhatsApp together", body: "Several people reply from one number and you want assignment, tags and reports." },
    { title: "WhatsApp broadcast campaigns", body: "You message a large opted-in list and want templates and volume pricing." },
    { title: "Cash-on-delivery confirmation", body: "Many of your orders are cash on delivery and you want buyers to confirm before you ship." },
    { title: "Answering shoppers from your catalogue", body: "You want an assistant that knows your products and replies to questions on the store." },
  ],
  claims: [
    {
      dimension: "WhatsApp template broadcasts",
      vendor: { value: "yes", note: "Its pricing page gives broadcast allowances per plan (15k a month on Growth, unlimited on Pro and Business).", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "COD confirmation on WhatsApp",
      vendor: { value: "yes", note: "Its Shopify page: \"Confirm COD orders using WhatsApp\" with order verification messages.", source: S.shopify, observedAt: D },
      peakhour: PEAKHOUR.codConfirmation,
    },
    {
      dimension: "Abandoned-cart messages",
      vendor: { value: "yes", note: "Its Shopify page lists abandoned cart, delivery and tracking update messages on WhatsApp.", source: S.shopify, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "AI replies from your product catalogue",
      vendor: {
        value: "partial",
        note: "Its Astra AI agent learns from content you upload. A live Shopify catalogue feeding the AI is not described on that page.",
        source: S.astra,
        observedAt: D,
      },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Product recommendations",
      vendor: { value: "not-documented", note: "The pages we read do not describe product recommendations or shelves.", source: S.astra, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Chat on your storefront",
      vendor: {
        value: "partial",
        note: "A WhatsApp chat button lets visitors start a WhatsApp chat from your site, and Astra can run on a website. A storefront shopping assistant is not described.",
        source: S.chatButton,
        observedAt: D,
      },
      peakhour: PEAKHOUR.storefrontChat,
    },
    {
      dimension: "Shared team inbox",
      vendor: { value: "yes", note: "Its pricing page lists a shared team inbox on every plan, with routing and reports on higher plans.", source: S.pricing, observedAt: D },
      peakhour: pending("support.channel_inbox"),
    },
  ],
  pricing: {
    rows: [
      { plan: "Growth (billed quarterly)", price: "₹2,699 per month", currency: "INR", region: "Not stated on the page", observedAt: D, source: S.pricing },
      { plan: "Pro (billed quarterly)", price: "₹5,799 per month", currency: "INR", region: "Not stated on the page", observedAt: D, source: S.pricing },
      { plan: "Business (billed quarterly)", price: "₹16,799 per month", currency: "INR", region: "Not stated on the page", observedAt: D, source: S.pricing },
      { plan: "Monthly and annual billing", price: "Not shown; the page offers a toggle and \"Save up to 10%\" without figures", currency: "INR", region: "Not stated on the page", observedAt: D, source: S.pricing },
      { plan: "Per-message WhatsApp charges", price: "Not published on the page: \"Per message charges vary for marketing, utility & authentication\"", currency: "INR", region: "Not stated on the page", observedAt: D, source: S.pricing },
      { plan: "Shopify add-on", price: "USD 4.99 per month; the page does not say which plan it applies to", currency: "USD", region: "Not stated on the page", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Wati", bestFor: "Teams whose work is WhatsApp conversations: a shared inbox with assignment and reports, broadcasts at volume and chatbot flows, with Shopify order and cash-on-delivery messages on top." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want an AI shopping assistant and product shelves on the storefront, answering from their own catalogue, plus WhatsApp confirmation of cash-on-delivery orders." },
  ],
  limitations: [
    "We read only Wati's own public pages. A feature it does not document is marked Not documented, which is not the same as No.",
    "Pricing is copied from its pricing page on the date shown; plans, taxes and message rates change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Wati alternative for Shopify?", a: "Peakhour is one option if you want an AI shopping assistant and product shelves on your storefront. If a team shared inbox and broadcasts are your main use, check Wati's own pages first." },
    { q: "Where does this information come from?", a: "Only from Wati's own public pages, each linked in the table with the date we read it." },
  ],
};
