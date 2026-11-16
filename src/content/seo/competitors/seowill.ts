import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://seowill.com/", label: "SEOWILL home page" },
  pricing: { href: "https://seowill.com/pages/pricing", label: "SEOWILL pricing" },
  listing: { href: "https://apps.shopify.com/seo-master", label: "SEOWILL on the Shopify App Store" },
};

export const SEOWILL: CompetitorBrief = {
  slug: "seowill",
  pageId: "shopify.compare.seowill",
  pillar: "content",
  relatedIds: ["shopify", "shopify.features.ai.seo", "shopify.features.ai.product.descriptions", "pricing"],
  name: "SEOWILL",
  url: "https://seowill.com/",
  category: "SEO and AI blog app for Shopify, formerly SEOAnt",
  observedAt: D,
  title: "Peakhour vs SEOWILL for Shopify",
  description: "Peakhour and SEOWILL compared for Shopify stores: SEO audit, meta tags, alt text, schema, AI blog and pricing, each cell sourced and dated.",
  h1: "Peakhour vs SEOWILL for Shopify",
  directAnswer:
    "SEOWILL, formerly SEOAnt, is a Shopify SEO app with an audit, meta tag editing, structured data, redirects, speed tools, an AI blog generator and keyword tools. Peakhour audits your products, drafts SEO titles, descriptions and alt text for you to approve, and writes product descriptions and blog drafts. SEOWILL documents structured data, redirects and speed tools that Peakhour does not claim. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "An SEO audit and fixes", body: "You want a store-wide scan and one-click fixes." },
    { title: "Technical SEO", body: "You want structured data, redirects for broken links and speed tools." },
    { title: "Writing blog and product content", body: "You want blog posts and descriptions drafted for you to review." },
    { title: "Keyword planning", body: "You want keyword research and rank tracking." },
  ],
  claims: [
    {
      dimension: "SEO audit",
      vendor: { value: "yes", note: "A full-site SEO and AI-search audit at no charge, with a page cap per plan.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.seoAudit,
    },
    {
      dimension: "Meta titles and descriptions",
      vendor: { value: "yes", note: "Auto and bulk meta tag editing is listed on its Pro plan.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.seoFixes,
    },
    {
      dimension: "Image alt text",
      vendor: { value: "yes", note: "Alt text and image compression for 50 images at no charge. Whether the alt text is AI-written is not separately stated.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.seoFixes,
    },
    {
      dimension: "Structured data (JSON-LD)",
      vendor: { value: "yes", note: "JSON-LD, FAQ and How-To structured data on its Pro plan.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Redirects for broken links",
      vendor: { value: "yes", note: "Auto-redirect of broken links on its Pro plan.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Image compression and page speed",
      vendor: { value: "yes", note: "Monthly image compression and speed optimisation tiers, with basic speed tools at no charge.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "AI blog posts",
      vendor: { value: "yes", note: "An AI blog generator is included at no charge, counted in monthly credits.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.blogWriter,
    },
    {
      dimension: "AI product descriptions",
      vendor: { value: "partial", note: "AI content optimisation is listed; product descriptions are not named explicitly.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.productDescriptions,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "not-documented", note: "One-click scan and fix is described, but no statement about developer work.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Free", price: "$0 USD per month", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Pro, 1,000 audited pages", price: "$29.99 USD per month, billed annually, 7-day trial", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Premium, unlimited audited pages", price: "$59.99 USD per month, billed annually, 7-day trial", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Pro on its Shopify listing", price: "₹2,826.85 per month, 7-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Premium on its Shopify listing", price: "₹5,654.63 per month, 7-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "SEOWILL", bestFor: "Stores that want a broad SEO toolkit with structured data, redirects, speed tools and keyword tracking, and a no-charge way to start." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want SEO titles, descriptions and alt text drafted for them to approve and undo, a product audit, product descriptions and blog drafts." },
  ],
  limitations: [
    "We read only SEOWILL's own public pages and its Shopify listing. Its help centre was not read.",
    "Its site states USD and its listing shows INR as a regional estimate. Plans, credits and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a SEOWILL alternative for Shopify?", a: "Peakhour is one option if you want SEO fixes, product descriptions and blog drafts prepared for your approval. If you need structured data, redirects or speed tools, read SEOWILL's own pages first." },
    { q: "Where does this information come from?", a: "Only from SEOWILL's own public pages and its Shopify App Store listing, each linked in the table with the date we read it." },
  ],
};
