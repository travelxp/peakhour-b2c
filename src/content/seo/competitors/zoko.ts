import { PEAKHOUR, pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://www.zoko.io/", label: "Zoko home page" },
  pricing: { href: "https://www.zoko.io/pricing", label: "Zoko pricing" },
  shopify: { href: "https://www.zoko.io/whatsapp-for-shopify", label: "Zoko for Shopify" },
};
const R = "Not stated on the page (it says charges are always in USD)";

export const ZOKO: CompetitorBrief = {
  slug: "zoko",
  pageId: "shopify.compare.zoko",
  name: "Zoko",
  url: "https://www.zoko.io/",
  category: "Shopify-focused WhatsApp inbox, flows and AI agent platform",
  observedAt: D,
  title: "Peakhour vs Zoko for Shopify",
  description:
    "Peakhour and Zoko compared for Shopify stores: broadcasts, COD, AI replies, chat, shared inbox and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Zoko for Shopify",
  directAnswer:
    "Zoko is a Shopify-focused WhatsApp platform: a shared inbox, broadcasts, ready-made flows including cash-on-delivery confirmation, and AI agents that sell inside WhatsApp. Peakhour is built around the store itself, with an AI shopping assistant and product shelves on your storefront. Zoko is the closer match if WhatsApp is where you sell; Peakhour is the closer match if the storefront is. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Selling and supporting on WhatsApp", body: "Your team replies from one official number and you want flows and an AI agent in the chat." },
    { title: "Cash-on-delivery confirmation", body: "Many of your orders are cash on delivery and you want buyers to confirm before you ship." },
    { title: "Recovering abandoned carts", body: "You want reminders on WhatsApp after a shopper leaves checkout." },
    { title: "Answering shoppers on the storefront", body: "You want an assistant and product shelves on the store itself, answering from your catalogue." },
  ],
  claims: [
    {
      dimension: "WhatsApp template broadcasts",
      vendor: { value: "yes", note: "Its pricing page lists WhatsApp bulk broadcasts, included in every plan.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "COD confirmation on WhatsApp",
      vendor: { value: "yes", note: "A free Essential flow double-confirms COD orders; COD reconfirmation with auto-cancel is a premium flow at $5.99 per month per flow.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR.codConfirmation,
    },
    {
      dimension: "Abandoned-cart reminders",
      vendor: { value: "yes", note: "Its Shopify page: \"recover your abandoned carts by sending reminders on WhatsApp\", with coupon codes.", source: S.shopify, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "AI replies from your product catalogue",
      vendor: {
        value: "yes",
        note: "Its home page: sync your Shopify catalogue with WhatsApp and let AI sell products inside the chat. The AI agents are paid add-ons, not part of the plans.",
        source: S.home,
        observedAt: D,
      },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Product recommendations on the storefront",
      vendor: { value: "not-documented", note: "The pages we read do not describe product shelves or recommendations on the storefront.", source: S.shopify, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Chat on your storefront",
      vendor: { value: "not-documented", note: "The pages we read describe WhatsApp, not a chat widget on the store.", source: S.shopify, observedAt: D },
      peakhour: PEAKHOUR.storefrontChat,
    },
    {
      dimension: "Shared team inbox and agent handover",
      vendor: { value: "yes", note: "A unified WhatsApp inbox where you can \"add as many agents as you want to the same WhatsApp number\"; Agent Handover is listed.", source: S.shopify, observedAt: D },
      peakhour: pending("support.channel_inbox"),
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "not-documented", note: "The page offers an Install on Shopify button and a 7-day free trial, and does not describe the setup steps.", source: S.shopify, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Starter", price: "$49.99 per month, with a $0.015 markup per conversation", currency: "USD", region: R, observedAt: D, source: S.pricing },
      { plan: "Plus", price: "$79.99 per month, 5K conversations at no markup, then $0.00199 each; first 5 agents free, then $15 each", currency: "USD", region: R, observedAt: D, source: S.pricing },
      { plan: "Elite", price: "$139.99 per month, 100K conversations at no markup, then $0.00099 each; first 10 agents free, then $12 each", currency: "USD", region: R, observedAt: D, source: S.pricing },
      { plan: "AI agents Guru and Wismo", price: "$24.99 per month each, plus $0.09 per resolution after the first 100", currency: "USD", region: R, observedAt: D, source: S.pricing },
      { plan: "AI agent Sello", price: "$24.99 per month, plus 3% of order value after the first 100 orders", currency: "USD", region: R, observedAt: D, source: S.pricing },
      { plan: "Enterprise and annual volume discounts", price: "Not published", currency: "USD", region: R, observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Zoko", bestFor: "Shopify merchants who sell and support inside WhatsApp: one shared official number, ready-made flows for cash-on-delivery confirmation and abandoned carts, and AI agents that answer, track orders and take orders in the chat." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want an AI shopping assistant and product shelves on the storefront, answering from their own catalogue, plus WhatsApp confirmation of cash-on-delivery orders." },
  ],
  limitations: [
    "We read only Zoko's own public pages. A feature it does not document is marked Not documented, which is not the same as No.",
    "Pricing is copied from its pricing page on the date shown. WhatsApp fees paid to Meta are extra and vary by country; plans and rates change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Zoko alternative for Shopify?", a: "Peakhour is one option if you want an AI shopping assistant and product shelves on your storefront. If selling inside WhatsApp is your main use, check Zoko's own pages first." },
    { q: "Where does this information come from?", a: "Only from Zoko's own public pages, each linked in the table with the date we read it." },
  ],
};
