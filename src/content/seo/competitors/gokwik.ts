import { PEAKHOUR, pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://www.gokwik.co/", label: "GoKwik home page" },
  pricing: { href: "https://www.gokwik.co/pricing", label: "GoKwik pricing" },
  checkout: { href: "https://www.gokwik.co/product/kwikcheckout", label: "GoKwik Kwik Checkout" },
  shopify: { href: "https://www.gokwik.co/platform/shopify", label: "GoKwik for Shopify" },
};

export const GOKWIK = {
  slug: "gokwik" as const,
  pageId: "shopify.compare.gokwik",
  name: "GoKwik",
  url: "https://www.gokwik.co/",
  category: "One-click checkout and COD risk platform for D2C brands",
  observedAt: D,
  title: "Peakhour vs GoKwik for Shopify",
  description:
    "Peakhour and GoKwik compared for Shopify stores: checkout, COD risk, WhatsApp confirmation, AI replies and pricing, each cell sourced and dated.",
  h1: "Peakhour vs GoKwik for Shopify",
  directAnswer:
    "GoKwik is a checkout and cash-on-delivery risk platform: one-click checkout, risk scoring of COD orders, and customer engagement and upsell tools. Peakhour does not replace your checkout; it adds an AI shopping assistant and product shelves on the storefront, and asks COD shoppers to confirm on WhatsApp. The two solve different problems, and some stores could use both. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Faster checkout", body: "Shoppers drop at checkout and you want a one-click flow with address prefill." },
    { title: "Fewer returned COD orders", body: "Too many cash-on-delivery parcels come back and you want to spot risky orders before you ship." },
    { title: "Confirming COD orders on WhatsApp", body: "You want the shopper to confirm or cancel on WhatsApp before you ship." },
    { title: "Answering shoppers on the storefront", body: "You want an assistant and product shelves on the store, answering from your catalogue." },
  ],
  claims: [
    {
      dimension: "One-click checkout",
      vendor: { value: "yes", note: "Kwik Checkout: \"One-click checkout solution built to boost conversions by up to 40%\" (its own claim).", source: S.checkout, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "COD risk scoring (RTO)",
      vendor: { value: "yes", note: "Its Smart COD Suite flags risky shoppers with RTO insights and lists 70+ interventions (its own claim).", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "COD confirmation on WhatsApp",
      vendor: { value: "not-documented", note: "The pages we read do not mention WhatsApp; they refer to messaging \"across channels\".", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.codConfirmation,
    },
    {
      dimension: "AI replies from your product catalogue",
      vendor: {
        value: "partial",
        note: "Kwik Engage includes an AI support chatbot. The pages we read do not say it answers from your catalogue.",
        source: S.home,
        observedAt: D,
      },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Upsells and product recommendations",
      vendor: { value: "partial", note: "GoKwik Cart offers in-cart upsells and discounts. Shelves on product pages are not described.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Chat on your storefront",
      vendor: { value: "not-documented", note: "The pages we read describe checkout and engagement tools, not a shopping chat on the store.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.storefrontChat,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "partial", note: "Its Shopify page says \"Go live in ~1 week\" and mentions plug-and-play integration without dev overhead; no setup steps are given.", source: S.shopify, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Emerging platform fee (up to 2,000 orders a month)", price: "₹3,000 per month", currency: "INR", region: "Not stated on the page", observedAt: D, source: S.pricing },
      { plan: "Emerging COD charge", price: "3.5%, which the page says applies on all transactions; payment aggregator charges apply where applicable", currency: "INR", region: "Not stated on the page", observedAt: D, source: S.pricing },
      { plan: "Enterprise (over 2,000 orders a month)", price: "Custom, through its sales team", currency: "INR", region: "Not stated on the page", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "GoKwik", bestFor: "D2C brands, mostly in India, whose main problems are checkout conversion and returned cash-on-delivery orders: one-click checkout and COD risk tools are its core, and Peakhour does not offer a checkout replacement." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want an AI shopping assistant and product shelves on the storefront, answering from their own catalogue, plus WhatsApp confirmation of cash-on-delivery orders." },
  ],
  limitations: [
    "We read only GoKwik's own public pages. A feature it does not document is marked Not documented, which is not the same as No.",
    "We read GoKwik's home, Kwik Checkout, Shopify and pricing pages only; its other product pages (for example Kwik Engage) may describe more, which is why WhatsApp is marked Not documented rather than No.",
    "Its figures such as conversion and RTO gains are its own marketing claims; we have not verified them.",
    "Pricing is copied from its pricing page on the date shown; plans and charges change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a GoKwik alternative for Shopify?", a: "Peakhour does not replace a checkout. If you want an AI shopping assistant and product shelves on your storefront, and WhatsApp confirmation of cash-on-delivery orders, it may fit; for one-click checkout, check GoKwik's own pages." },
    { q: "Where does this information come from?", a: "Only from GoKwik's own public pages, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
