import { PEAKHOUR, pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  page: { href: "https://www.shopify.com/sidekick", label: "Shopify Sidekick" },
  help: { href: "https://help.shopify.com/en/manual/shopify-admin/productivity-tools/sidekick", label: "Sidekick in the Shopify Help Center" },
};

/** Shopify's own product, and a different job: Sidekick helps the merchant in the admin; it is not a shopper-facing chat. */
export const SIDEKICK = {
  slug: "shopify-sidekick" as const,
  pageId: "shopify.compare.sidekick",
  name: "Shopify Sidekick",
  url: "https://www.shopify.com/sidekick",
  category: "Shopify's AI assistant for the merchant, inside the Shopify admin",
  observedAt: D,
  title: "Peakhour vs Shopify Sidekick",
  description:
    "Peakhour and Shopify Sidekick compared: Sidekick helps you run the store in the admin; Peakhour also answers shoppers. Sourced and dated.",
  h1: "Peakhour vs Shopify Sidekick",
  directAnswer:
    "Shopify Sidekick is Shopify's AI assistant for the merchant: it works with your store data in the Shopify admin and, Shopify says, is included with your Shopify plan. It is not a chat for your shoppers, so the two do different jobs and can sit side by side. Peakhour does not act inside your Shopify admin; it adds an AI shopping assistant and product shelves on your storefront. Every answer below links to Shopify's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Running the store faster", body: "You want help with admin tasks, reports and content, from inside Shopify." },
    { title: "Answering shoppers", body: "You want an assistant that talks to shoppers on the storefront." },
    { title: "Product suggestions", body: "You want product shelves and suggestions shoppers see while they browse." },
    { title: "Cash on delivery", body: "You sell mostly cash on delivery and want orders confirmed before shipping." },
  ],
  claims: [
    {
      dimension: "An AI assistant for you, the merchant, inside the Shopify admin",
      vendor: { value: "yes", note: "An AI-enabled commerce assistant that works with your store data and takes action in your admin; changes are presented for your review before they apply.", source: S.page, observedAt: D },
      peakhour: { ...pending(), note: "Peakhour's own assistant for you works in the Peakhour dashboard; it does not read or act in your Shopify admin." },
    },
    {
      dimension: "Writes content such as product descriptions",
      vendor: { value: "yes", note: "It can create content such as product descriptions and images.", source: S.help, observedAt: D },
      peakhour: PEAKHOUR.productDescriptions,
    },
    {
      dimension: "Chat that answers shoppers on your storefront",
      vendor: { value: "not-documented", note: "Its pages describe use by your staff in the admin and describe no shopper-facing chat. Shopify's shopper chat is Shopify Inbox.", source: S.page, observedAt: D },
      peakhour: PEAKHOUR.storefrontChat,
    },
    {
      dimension: "AI replies from your Shopify catalogue",
      vendor: { value: "not-documented", note: "Not described for shoppers; it works with store data for the merchant.", source: S.page, observedAt: D },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Product recommendations for shoppers",
      vendor: { value: "not-documented", note: "Not described on the pages we read.", source: S.page, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "COD confirmation",
      vendor: { value: "not-documented", note: "Cash on delivery is not mentioned on the pages we read.", source: S.help, observedAt: D },
      peakhour: PEAKHOUR.codConfirmation,
    },
  ],
  pricing: {
    rows: [
      { plan: "Shopify Sidekick", price: "Shopify says it is included with your Shopify plan; features and usage limits vary by plan", currency: "No charge", region: "Not stated", observedAt: D, source: S.page, noMoneyPrice: true },
    ],
  },
  bestFor: [
    { vendor: "Shopify Sidekick", bestFor: "Merchants who want an assistant for running the store itself: admin tasks, workflows, content and questions about their own data, as part of their Shopify plan." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who also want an assistant that talks to shoppers, product shelves on the storefront, and cash-on-delivery confirmation on WhatsApp." },
  ],
  limitations: [
    "We read only Shopify's own pages. A feature it does not document is marked Not documented, which is not the same as No.",
    "Sidekick and Peakhour mostly do different jobs. Not documented on a shopper-facing row means Sidekick is not described as doing it, not that it falls short.",
    "Sidekick's plan availability and usage limits are not on the pages we read; check Shopify's own page for your plan.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is Shopify Sidekick a customer chatbot?", a: "Shopify's pages describe it as an assistant for the merchant in the admin, not a chat for shoppers. Shopify's shopper chat is Shopify Inbox." },
    { q: "Where does this information come from?", a: "Only from Shopify's own pages, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
