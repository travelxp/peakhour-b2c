import { pending } from "./peakhour";
import { PEAKHOUR_W3B } from "./peakhour-cmp-w3b";
import type { CompetitorBrief } from "./types";

// CMP-W3B
const D = "2026-11-16";
const B = "https://www.inventory-planner.com";
const S = {
  home: { href: `${B}/`, label: "Inventory Planner home page" },
  pricing: { href: `${B}/pricing/`, label: "Inventory Planner pricing" },
  listing: { href: "https://apps.shopify.com/inventory-planner", label: "Inventory Planner on the Shopify App Store" },
};

export const INVENTORY_PLANNER = {
  slug: "inventory-planner" as const,
  pageId: "shopify.compare.inventory.planner",
  relatedIds: ["shopify", "shopify.features.inventory.alerts", "pricing"],
  name: "Inventory Planner",
  url: `${B}/`,
  category: "Demand forecasting and replenishment planning for retailers",
  observedAt: D,
  title: "Peakhour vs Inventory Planner for Shopify",
  description: "Peakhour and Inventory Planner compared for Shopify stock-out alerts and purchase orders: forecasts, alerts, setup time and pricing, sourced.",
  h1: "Peakhour vs Inventory Planner for Shopify",
  directAnswer:
    "Inventory Planner is a forecasting and replenishment platform for retailers on Shopify and many other systems, set up with expert onboarding. Peakhour does a smaller job. It warns you when a selling product is forecast to run out, and builds a purchase-order sheet per vendor that you print or download. Nothing is sent to your vendor. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "A warning before a product runs out", body: "You want to hear about a stock-out before it costs you sales." },
    { title: "A purchase order per supplier", body: "You want a ready sheet of what to reorder from each vendor." },
    { title: "Planning across many locations and systems", body: "You want forecasts, transfers and open-to-buy planning for a larger catalogue." },
    { title: "Keeping it light", body: "You want a simple stock warning and an order sheet, without a planning tool to learn." },
  ],
  claims: [
    {
      dimension: "Stock-out and low-stock alerts",
      vendor: { value: "yes", note: "The listing names low stock and out-of-stock notifications. We did not find alerts on its home page.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3B.stockoutAlert,
    },
    {
      dimension: "Demand forecasting",
      vendor: { value: "yes", note: "\"Predict what customers will buy, SKU by SKU.\"", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Purchase orders",
      vendor: { value: "yes", note: "\"Replenishment & POs: Know what to order, when and where.\"", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.poSheet,
    },
    {
      dimension: "Sending a purchase order to the supplier",
      vendor: { value: "not-documented", note: "The pages we read do not say whether orders can be sent to vendors or exported.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.poNotSent,
    },
    {
      dimension: "Automatic reordering",
      vendor: { value: "not-documented", note: "The pages we read describe purchasing recommendations. They do not say whether orders are placed automatically.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.noAutoReorder,
    },
    {
      dimension: "Stores beyond Shopify",
      vendor: { value: "yes", note: "Shopify and Shopify Plus, plus Amazon, WooCommerce, eBay, BigCommerce and several ERP and warehouse systems.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.shopifyOnly,
    },
    {
      dimension: "Setup time",
      vendor: { value: "partial", note: "It says \"Live in 5-6 weeks\", with expert-supported onboarding.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Pricing model",
      vendor: { value: "partial", note: "Priced by the volume of inventory you manage, with unlimited users. Plan prices are not shown; you request a quote.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Shopify App Store plans", price: "Not published (contact us for a quote)", currency: "USD", region: "Not stated", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "Inventory Planner", bestFor: "Retailers with a larger catalogue, several locations or several systems, who want SKU-level forecasts, transfers and open-to-buy planning, and will invest in onboarding. It documents far more planning than Peakhour does." },
    { vendor: "Peakhour", bestFor: "Shopify stores that want a plain warning before a selling product runs out and a purchase-order sheet per vendor, without learning a planning tool." },
  ],
  limitations: [
    "We read only Inventory Planner's own site, pricing page and Shopify App Store listing. A feature they do not document is marked Not documented, which is not the same as No.",
    "Its pricing page shows no plan prices, and its listing says to contact them for a quote and that charges are in USD, so no price is recorded.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there an Inventory Planner alternative for Shopify?", a: "Peakhour is a lighter option: stock-out alerts and a purchase-order sheet per vendor. If you need SKU-level forecasts and transfers, read Inventory Planner's own pages first." },
    { q: "Where does this information come from?", a: "Only from Inventory Planner's own site and Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
