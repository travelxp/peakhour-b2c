import { pending } from "./peakhour";
import { PEAKHOUR_W3B } from "./peakhour-cmp-w3b";
import type { CompetitorBrief } from "./types";

// CMP-W3B
const D = "2026-11-16";
const L = "https://apps.shopify.com/releasit-cod-order-form";
const S = {
  listing: { href: L, label: "Releasit COD Form & Upsells on the Shopify App Store" },
};

export const RELEASIT = {
  slug: "releasit" as const,
  pageId: "shopify.compare.releasit",
  relatedIds: ["shopify", "shopify.features.whatsapp.cod.confirmation", "pricing"],
  name: "Releasit COD Form & Upsells",
  url: L,
  category: "Cash-on-delivery order form and upsells for Shopify",
  observedAt: D,
  title: "Peakhour vs Releasit COD Form for Shopify",
  description: "Peakhour and Releasit COD Form compared for cash-on-delivery stores: order form, OTP, WhatsApp confirmation, blocking and pricing, sourced.",
  h1: "Peakhour vs Releasit COD Form for Shopify",
  directAnswer:
    "Releasit COD Form is a cash-on-delivery order form with OTP phone verification, blocking rules and upsells, sold on the Shopify App Store. Peakhour does a different job on cash-on-delivery orders: once an order arrives on Shopify, it asks the shopper on WhatsApp to confirm or cancel, and marks orders unanswered after 24 hours. It never cancels by itself. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "A cash-on-delivery order form", body: "You want a one-step COD form in place of the normal checkout." },
    { title: "Fewer fake orders", body: "You want to verify phone numbers or block bad orders before they are placed." },
    { title: "Confirming orders already placed", body: "You want shoppers to confirm a cash-on-delivery order before you ship it." },
    { title: "Keeping the final call", body: "You want to decide yourself which unconfirmed orders get cancelled." },
  ],
  claims: [
    {
      dimension: "A COD order form in place of checkout",
      vendor: { value: "yes", note: "\"1-Click COD form as a popup or advanced Cash on Delivery without Shopify Checkout.\"", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "OTP phone verification before the order",
      vendor: { value: "yes", note: "\"Reduce fake orders with OTP phone verification (SMS/WhatsApp).\" SMS messages are charged separately.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Blocking rules",
      vendor: { value: "yes", note: "It lists limiting postal codes and blocking IPs.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Upsells on the order form",
      vendor: { value: "yes", note: "Pre and post purchase upsells, downsells, quantity offers and A/B testing.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "WhatsApp confirmation of orders already placed",
      vendor: { value: "partial", note: "It lists confirming via SMS or WhatsApp. The listing does not say whether this asks the shopper to confirm an order after it is placed.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3B.codAsk,
    },
    {
      dimension: "Unanswered orders marked after 24 hours",
      vendor: { value: "not-documented", note: "The listing does not describe a follow-up on orders the shopper did not answer.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3B.codUnanswered,
    },
    {
      dimension: "Every outcome in one orders queue",
      vendor: { value: "not-documented", note: "The listing does not describe a confirmation queue.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3B.codQueue,
    },
    {
      dimension: "Automatic cancellation on No or silence",
      vendor: { value: "not-documented", note: "The listing does not say whether orders are cancelled automatically.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3B.codNoAutoCancel,
    },
  ],
  pricing: {
    rows: [
      { plan: "Free to install", price: "Free; SMS messages are charged separately", currency: "INR", region: "Not stated", observedAt: D, source: S.listing },
      { plan: "Premium", price: "₹1,083.04 per month, or ₹9,754.93 per year", currency: "INR, shown as an estimate and billed in the store currency", region: "Not stated", observedAt: D, source: S.listing },
      { plan: "Enterprise", price: "₹2,826.85 per month, or ₹25,449.15 per year", currency: "INR, shown as an estimate and billed in the store currency", region: "Not stated", observedAt: D, source: S.listing },
      { plan: "Unlimited", price: "₹6,597.23 per month, or ₹59,382.60 per year", currency: "INR, shown as an estimate and billed in the store currency", region: "Not stated", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "Releasit COD Form & Upsells", bestFor: "Cash-on-delivery stores that want the order form itself: a one-step COD form, OTP phone verification, blocking rules and upsells, before the order is placed. Peakhour works after the order is placed instead." },
    { vendor: "Peakhour", bestFor: "Cash-on-delivery stores that already take orders through Shopify and want shoppers asked on WhatsApp to confirm, with you deciding which orders to cancel." },
  ],
  limitations: [
    "We read only Releasit's own Shopify App Store listing; its own website did not load for us. A feature the listing does not document is marked Not documented, which is not the same as No.",
    "The listing shows prices in INR as estimates, billed in the store's currency, and does not state a country. Plans, messaging charges and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Releasit COD Form alternative for Shopify?", a: "Peakhour is a different kind of option: it does not replace your checkout with a COD form. It asks shoppers on WhatsApp to confirm a cash-on-delivery order after it arrives on Shopify. If you want the form, read Releasit's own listing first." },
    { q: "Where does this information come from?", a: "Only from Releasit's own Shopify App Store listing, linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
