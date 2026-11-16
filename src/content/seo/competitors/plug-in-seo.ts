import { PEAKHOUR_W3C as P } from "./peakhour-cmp-w3c";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://pluginseo.com/", label: "Plug in SEO site" },
  listing: { href: "https://apps.shopify.com/plug-in-seo", label: "Plug in SEO on the Shopify App Store" },
};

export const PLUG_IN_SEO = {
  slug: "plug-in-seo" as const,
  pageId: "shopify.compare.plug.in.seo",
  pillar: "content",
  relatedIds: ["shopify", "shopify.features.seo.audit", "shopify.features.ai.seo", "pricing"],
  name: "Plug in SEO",
  url: "https://pluginseo.com/",
  category: "SEO audit and fix app for Shopify, by Plug in Useful",
  observedAt: D,
  title: "Peakhour vs Plug in SEO for Shopify",
  description: "Peakhour and Plug in SEO compared for Shopify stores: SEO audit, meta tags, alt text, schema, redirects and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Plug in SEO for Shopify",
  directAnswer:
    "Plug in SEO scans your store for SEO problems and fixes them in bulk: meta tags, alt text, structured data, broken-link redirects, keyword research and speed reports. Peakhour audits your products, drafts SEO titles, descriptions and alt text for you to approve, and can undo each change. Plug in SEO documents structured data, redirects, keywords and speed reports that Peakhour does not do. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "A full SEO scan", body: "You want a scan that lists SEO problems across your pages." },
    { title: "Technical fixes", body: "You want structured data and redirects for broken links handled." },
    { title: "Fixing product text", body: "You want titles, meta descriptions and alt text drafted and applied in bulk." },
    { title: "Keeping control", body: "You want to tick which fixes apply and undo them if needed." },
  ],
  claims: [
    {
      dimension: "SEO audit",
      vendor: { value: "yes", note: "An SEO scanner runs a full audit for missing tags, broken schema and other issues.", source: S.listing, observedAt: D },
      peakhour: P.seoAudit,
    },
    {
      dimension: "Meta tags and alt text in bulk",
      vendor: { value: "yes", note: "Bulk edit of image alt text, file names, URLs, meta titles and descriptions. Bulk AI alt text starts on its Lite plan.", source: S.listing, observedAt: D },
      peakhour: P.seoTitlesAndAlt,
    },
    {
      dimension: "AI-written product titles and descriptions",
      vendor: { value: "yes", note: "AI writes product titles and descriptions.", source: S.listing, observedAt: D },
      peakhour: P.productDescriptions,
    },
    {
      dimension: "Structured data (JSON-LD)",
      vendor: { value: "yes", note: "Schema markup and JSON-LD structured data.", source: S.listing, observedAt: D },
      peakhour: P.seoNoSchema,
    },
    {
      dimension: "Redirects for broken links",
      vendor: { value: "yes", note: "Detects and redirects broken links, including one-click redirects.", source: S.listing, observedAt: D },
      peakhour: P.seoNoRedirects,
    },
    {
      dimension: "Keyword research",
      vendor: { value: "yes", note: "Keyword Studio: AI keyword research, search trends and keyword analytics.", source: S.listing, observedAt: D },
      peakhour: P.auditNoKeywords,
    },
    {
      dimension: "Page speed reports",
      vendor: { value: "yes", note: "Speed reports are included on its Standard and Premium plans.", source: S.listing, observedAt: D },
      peakhour: P.auditNoSpeed,
    },
    {
      dimension: "Tick which fixes apply, and undo",
      vendor: { value: "not-documented", note: "Choosing fixes one by one and undoing them is not described in the listing.", source: S.listing, observedAt: D },
      peakhour: P.seoTickAndUndo,
    },
  ],
  pricing: {
    rows: [
      { plan: "Starter, 30 pages scanned", price: "₹470.36 per month, 7-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Lite, 200 pages scanned", price: "₹2,826.85 per month, 7-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Standard, 2,000 pages scanned", price: "₹4,712.04 per month, 7-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Premium, unlimited pages scanned", price: "₹7,539.82 per month, 7-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "Plug in SEO", bestFor: "Stores that want a broad technical SEO toolkit: structured data, redirects for broken links, keyword research and speed reports, from a long-established app." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want SEO titles, descriptions and alt text drafted for them to approve and undo, with a product audit and product descriptions in the same place." },
  ],
  limitations: [
    "We read only Plug in SEO's Shopify listing. Its own site is an install page with no feature or pricing text.",
    "Its listing shows INR as an estimate for the visitor's location; billing is in your store's currency. Plans and offers change.",
    "Where our own side says Not supported, that is a limit recorded on our own SEO features, not a statement about Plug in SEO.",
  ],
  faqs: [
    { q: "Is there a Plug in SEO alternative for Shopify?", a: "Peakhour is one option if you want SEO fixes and product descriptions prepared for your approval. If you need structured data, redirects, keyword research or speed reports, read Plug in SEO's own listing first." },
    { q: "Where does this information come from?", a: "Only from Plug in SEO's own Shopify App Store listing, linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
