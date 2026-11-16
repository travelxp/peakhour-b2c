import { PEAKHOUR, pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://www.gorgias.com/", label: "Gorgias home page" },
  pricing: { href: "https://www.gorgias.com/pricing", label: "Gorgias pricing" },
};

/** CMP-B. Gorgias is a helpdesk: only the pre-sales assistant use case is compared (registry audit note). */
export const GORGIAS: CompetitorBrief = {
  slug: "gorgias",
  pageId: "shopify.compare.gorgias",
  name: "Gorgias",
  url: "https://www.gorgias.com/",
  category: "Customer support helpdesk for online stores, with an AI Agent",
  observedAt: D,
  title: "Peakhour vs Gorgias for Shopify",
  description:
    "Peakhour and Gorgias compared on one job only, the pre-sales shopping assistant on a Shopify store. Sourced, dated and honest about scope.",
  h1: "Peakhour vs Gorgias for Shopify",
  directAnswer:
    "Gorgias is a customer support helpdesk with an AI Agent and a Shopping Assistant. Peakhour does not offer a helpdesk today, so this page compares one job only: answering shoppers before they buy. On that job, Peakhour puts an AI shopping assistant and product shelves on your storefront. If you need tickets, a team inbox and support automation, Gorgias is the more complete choice. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Questions before a purchase", body: "You want shoppers to get product answers and suggestions while they browse." },
    { title: "A full support desk", body: "You need tickets, a team inbox and support automation across channels." },
    { title: "Chat on WhatsApp", body: "Your customers already message you on WhatsApp." },
    { title: "Cash on delivery", body: "You sell mostly cash on delivery and want orders confirmed before shipping." },
  ],
  claims: [
    {
      dimension: "Pre-sales shopping assistant",
      vendor: { value: "yes", note: "It lists a \"Shopping Assistant (pre-sales conversion)\" among its features.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR.storefrontChat,
    },
    {
      dimension: "AI replies from your Shopify catalogue",
      vendor: { value: "not-documented", note: "It says Shopify data is built in natively and agents see orders, customers and products in a ticket. The pages we read do not say the AI answers from the catalogue.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "Product recommendations",
      vendor: { value: "partial", note: "It says the AI engages shoppers proactively with suggestions at the right moment. Product shelves are not described.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Human handover",
      vendor: { value: "yes", note: "It says the AI hands conversations to human agents with the context needed to continue.", source: S.home, observedAt: D },
      peakhour: pending("support.whatsapp_support"),
    },
    {
      dimension: "Chat on WhatsApp",
      vendor: { value: "yes", note: "Chat, WhatsApp, email, SMS, Instagram and Facebook messages are listed in one inbox.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.whatsappBuyingStep,
    },
    {
      dimension: "COD confirmation",
      vendor: { value: "not-documented", note: "Cash on delivery is not mentioned on the pages we read.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.codConfirmation,
    },
    {
      dimension: "Setup support",
      vendor: { value: "partial", note: "A \"50 in 50\" programme covers connecting channels, migrating data and launching the team. It is guided onboarding; it does not say \"no developer\".", source: S.home, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Starter (50 tickets, 30 automated AI interactions)", price: "$10 per month, monthly billing only", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Basic (300 tickets, 30 automated AI interactions)", price: "$50 per month billed annually, $60 billed monthly", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Pro (2,000 tickets, 190 automated AI interactions)", price: "$300 per month billed annually, $360 billed monthly", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Advanced (5,000 tickets, 530 automated AI interactions)", price: "$750 per month billed annually, $900 billed monthly", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "AI Agent add-on, per automated interaction", price: "$0.90 on annual contracts, $1.00 on monthly; $1.50 above the plan allowance", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Enterprise (over 5,000 conversations a month)", price: "Not published (custom quote)", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Gorgias", bestFor: "Stores that need a real support desk: tickets, a shared team inbox, automation and several channels in one place, with an AI Agent on top." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want a shopping assistant and product shelves on the storefront that answer from their own catalogue, and have no need to move their support desk." },
  ],
  limitations: [
    "Gorgias is a helpdesk and Peakhour does not offer one today. This page does not compare support, tickets or team inboxes.",
    "We read only Gorgias's own public pages. A feature it does not document is marked Not documented, which is not the same as No.",
    "Its pricing page shows $ plans; a separate block of structured data on the same page lists different monthly figures, and the page does not explain the gap. We record the plan table as shown.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Does Peakhour replace Gorgias?", a: "No. Peakhour does not offer a helpdesk today. It is an option for the pre-sales job: an assistant and product shelves on the storefront, answering from your catalogue." },
    { q: "Where does this information come from?", a: "Only from Gorgias's own public pages, each linked in the table with the date we read it." },
  ],
};
