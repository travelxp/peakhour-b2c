import { pending } from "./peakhour";
import { PEAKHOUR_W3B } from "./peakhour-cmp-w3b";
import type { CompetitorBrief } from "./types";

// CMP-W3B
const D = "2026-11-16";
const B = "https://www.prediko.io";
const S = {
  home: { href: `${B}/`, label: "Prediko home page" },
  pricing: { href: `${B}/pricing`, label: "Prediko pricing" },
  listing: { href: "https://apps.shopify.com/prediko", label: "Prediko on the Shopify App Store" },
};

export const PREDIKO = {
  slug: "prediko" as const,
  pageId: "shopify.compare.prediko",
  relatedIds: ["shopify", "shopify.features.inventory.alerts", "pricing"],
  name: "Prediko",
  url: `${B}/`,
  category: "Demand forecasting and inventory planning for Shopify",
  observedAt: D,
  title: "Peakhour vs Prediko for Shopify",
  description: "Peakhour and Prediko compared for Shopify stock-out alerts and purchase orders: forecasting, supplier orders, alerts and pricing, sourced.",
  h1: "Peakhour vs Prediko for Shopify",
  directAnswer:
    "Prediko is a dedicated demand-planning app for Shopify, with AI forecasting, purchase-order management and inventory alerts, priced by annual sales. Peakhour does a smaller job. It warns you when a selling product is forecast to run out, and builds a purchase-order sheet per vendor that you print or download. Nothing is sent to your vendor. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "A warning before a product runs out", body: "You want to hear about a stock-out before it costs you sales." },
    { title: "A purchase order per supplier", body: "You want a ready sheet of what to reorder from each vendor." },
    { title: "Full demand planning", body: "You want forecasts, a buying calendar and supply planning across many products." },
    { title: "Keeping it light", body: "You want a simple stock warning and an order sheet, without a planning tool to learn." },
  ],
  claims: [
    {
      dimension: "Stock-out and low-stock alerts",
      vendor: { value: "yes", note: "The listing names \"Customizable Inventory Reports & Alerts\" and a low stock alerts category.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3B.stockoutAlert,
    },
    {
      dimension: "Demand forecasting",
      vendor: { value: "yes", note: "\"AI Demand Forecasting & Supply Planner\" on the listing; the site says \"Forecast demand and validate every plan against supply.\"", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Purchase orders",
      vendor: { value: "yes", note: "\"Unlimited Purchase Orders\" on the listing, and an AI-generated 12 month PO calendar on the site.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3B.poSheet,
    },
    {
      dimension: "Sending a purchase order to the supplier",
      vendor: { value: "not-documented", note: "The pages we read do not say whether orders can be sent to suppliers or exported.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.poNotSent,
    },
    {
      dimension: "Automatic reordering",
      vendor: { value: "not-documented", note: "The pages we read describe what, when and how much to buy. They do not say whether orders are placed automatically.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.noAutoReorder,
    },
    {
      dimension: "Stores beyond Shopify",
      vendor: { value: "yes", note: "Its site lists Amazon, TikTok Shop and WMS integrations, and says several Shopify stores can be connected.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.shopifyOnly,
    },
    {
      dimension: "Pricing model",
      vendor: { value: "yes", note: "Core plans are priced by annual sales, with a 14-day free trial.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Core, annual sales under 100K", price: "$49 per month, or $42 per month billed annually", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Core, annual sales 100K to 500K", price: "$119 per month, or $101 per month billed annually", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Core, annual sales 500K to 2M", price: "$199 per month, or $169 per month billed annually", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Core, annual sales 50M and above", price: "Not published (contact us)", currency: "Not stated", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Prediko", bestFor: "Stores that plan stock seriously: forecasting, a buying calendar, unlimited purchase orders and several sales channels, used by a team. It documents far more planning than Peakhour does." },
    { vendor: "Peakhour", bestFor: "Shopify stores that want a plain warning before a selling product runs out and a purchase-order sheet per vendor, without learning a planning tool." },
  ],
  limitations: [
    "We read only Prediko's own site, pricing page and Shopify App Store listing. A feature they do not document is marked Not documented, which is not the same as No.",
    "Its pricing is by annual sales; we list the first three tiers and the Contact us tier. Plans, trials and offers change, and add-ons are priced separately.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Prediko alternative for Shopify?", a: "Peakhour is a lighter option: stock-out alerts and a purchase-order sheet per vendor. If you need forecasting and a buying calendar, read Prediko's own pages first." },
    { q: "Where does this information come from?", a: "Only from Prediko's own site and Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
