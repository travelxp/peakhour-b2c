import { pending } from "./peakhour";
import { PEAKHOUR_W3B } from "./peakhour-cmp-w3b";
import type { CompetitorBrief } from "./types";

// CMP-W3B
const D = "2026-11-16";
const B = "https://easysellapp.com";
const S = {
  home: { href: `${B}/`, label: "EasySell home page" },
  listing: { href: "https://apps.shopify.com/easy-order-form", label: "EasySell COD Form & Upsells on the Shopify App Store" },
};

export const EASYSELL = {
  slug: "easysell" as const,
  pageId: "shopify.compare.easysell",
  relatedIds: ["shopify", "shopify.features.whatsapp.cod.confirmation", "pricing"],
  name: "EasySell COD Form & Upsells",
  url: `${B}/`,
  category: "Cash-on-delivery order form and upsells for Shopify",
  observedAt: D,
  title: "Peakhour vs EasySell COD Form for Shopify",
  description: "Peakhour and EasySell COD Form compared for cash-on-delivery stores: order form, OTP, WhatsApp confirmation, blocking and pricing, sourced.",
  h1: "Peakhour vs EasySell COD Form for Shopify",
  directAnswer:
    "EasySell is a cash-on-delivery order form with OTP verification by SMS or WhatsApp, blocking rules and upsells. Peakhour does a different job on cash-on-delivery orders: once an order arrives on Shopify, it asks the shopper on WhatsApp to confirm or cancel, and marks orders unanswered after 24 hours. It never cancels by itself. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "A cash-on-delivery order form", body: "You want a one-step COD form in place of the normal checkout." },
    { title: "Fewer fake orders", body: "You want to verify phone numbers or block bad orders before they are placed." },
    { title: "Confirming orders already placed", body: "You want shoppers to confirm a cash-on-delivery order before you ship it." },
    { title: "Keeping the final call", body: "You want to decide yourself which unconfirmed orders get cancelled." },
  ],
  claims: [
    {
      dimension: "A COD order form in place of checkout",
      vendor: { value: "yes", note: "\"Create 1-Click COD order form with upsells, product bundles, OTP verification, and fraud prevention.\"", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "OTP phone verification before the order",
      vendor: { value: "yes", note: "\"OTP verification via SMS and WhatsApp.\" SMS and WhatsApp messages are optional and charged separately.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Blocking rules",
      vendor: { value: "yes", note: "\"Auto-block by phone, IP, or order limits.\"", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Upsells on the order form",
      vendor: { value: "yes", note: "Quantity offers, bonus gifts, bundles, and upsell and downsell flows, plus post-purchase offers.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "WhatsApp confirmation of orders already placed",
      vendor: { value: "partial", note: "The listing mentions phone confirmation and SMS and WhatsApp notifications. Its home page does not mention WhatsApp order confirmation.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.codAsk,
    },
    {
      dimension: "Unanswered orders marked after 24 hours",
      vendor: { value: "not-documented", note: "The pages we read do not describe a follow-up on orders the shopper did not answer.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.codUnanswered,
    },
    {
      dimension: "Every outcome in one orders queue",
      vendor: { value: "not-documented", note: "The pages we read do not describe a confirmation queue.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.codQueue,
    },
    {
      dimension: "Automatic cancellation on No or silence",
      vendor: { value: "not-documented", note: "The pages we read do not say whether orders are cancelled automatically.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.codNoAutoCancel,
    },
  ],
  pricing: {
    rows: [
      { plan: "Free to install, up to 60 orders a month", price: "Free", currency: "INR", region: "Not stated", observedAt: D, source: S.listing },
      { plan: "PRO, up to 440 orders a month", price: "₹937.88 per month, or ₹8,482.42 per year", currency: "INR, shown as an estimate and billed in the store currency", region: "Not stated", observedAt: D, source: S.listing },
      { plan: "ADVANCED, up to 10,000 orders a month", price: "₹2,351.78 per month, or ₹21,301.72 per year", currency: "INR, shown as an estimate and billed in the store currency", region: "Not stated", observedAt: D, source: S.listing },
      { plan: "UNLIMITED orders", price: "₹5,650.86 per month, or ₹50,899.24 per year", currency: "INR, shown as an estimate and billed in the store currency", region: "Not stated", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "EasySell COD Form & Upsells", bestFor: "Cash-on-delivery stores that want the order form itself: a one-step COD form, OTP phone verification, blocking rules and upsells, before the order is placed. Peakhour works after the order is placed instead." },
    { vendor: "Peakhour", bestFor: "Cash-on-delivery stores that already take orders through Shopify and want shoppers asked on WhatsApp to confirm, with you deciding which orders to cancel." },
  ],
  limitations: [
    "We read only EasySell's own site and Shopify App Store listing. A feature they do not document is marked Not documented, which is not the same as No.",
    "The listing shows prices in INR as estimates, billed in the store's currency, and does not state a country. It also lists $0.05 per extra order on paid plans. Plans, messaging charges and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there an EasySell COD Form alternative for Shopify?", a: "Peakhour is a different kind of option: it does not replace your checkout with a COD form. It asks shoppers on WhatsApp to confirm a cash-on-delivery order after it arrives on Shopify. If you want the form, read EasySell's own pages first." },
    { q: "Where does this information come from?", a: "Only from EasySell's own site and Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
