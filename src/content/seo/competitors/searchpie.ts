import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://searchpie.io/", label: "SearchPie home page" },
  pricing: { href: "https://searchpie.io/pricing", label: "SearchPie pricing" },
  listing: { href: "https://apps.shopify.com/seo-booster", label: "SearchPie on the Shopify App Store" },
};

export const SEARCHPIE: CompetitorBrief = {
  slug: "searchpie",
  pageId: "shopify.compare.searchpie",
  pillar: "content",
  relatedIds: ["shopify", "shopify.features.ai.seo", "shopify.features.ai.product.descriptions", "pricing"],
  name: "SearchPie",
  url: "https://searchpie.io/",
  category: "SEO, schema and speed app for Shopify",
  observedAt: D,
  title: "Peakhour vs SearchPie for Shopify",
  description: "Peakhour and SearchPie compared for Shopify stores: SEO audit, meta tags, alt text, schema, speed and pricing, each cell sourced and dated.",
  h1: "Peakhour vs SearchPie for Shopify",
  directAnswer:
    "SearchPie is a Shopify SEO app that bundles an audit, bulk meta tags, alt text, structured data, speed tools and keyword tracking. Peakhour audits your products, drafts SEO titles, descriptions and alt text for you to approve and undo, and writes product descriptions. SearchPie documents structured data, speed tools and rank tracking that Peakhour does not claim. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "A technical SEO checklist", body: "You want schema, a sitemap, broken-link handling and speed tools in one app." },
    { title: "Fixing product SEO in bulk", body: "You want meta tags and alt text drafted and applied across the catalogue." },
    { title: "Tracking rankings", body: "You want keyword research and position tracking." },
    { title: "Writing product content", body: "You want descriptions drafted for you to review." },
  ],
  claims: [
    {
      dimension: "SEO audit",
      vendor: { value: "yes", note: "Its listing says you can monitor an SEO health score, and its home page promises a daily report of where issues are.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.seoAudit,
    },
    {
      dimension: "Bulk meta titles and descriptions",
      vendor: { value: "yes", note: "Bulk meta tags with templates, with AI generation counted in monthly requests.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.seoFixes,
    },
    {
      dimension: "Image alt text",
      vendor: { value: "yes", note: "Bulk alt text with templates, and AI-generated alt tags on its listing.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.seoFixes,
    },
    {
      dimension: "Structured data (JSON-LD)",
      vendor: { value: "yes", note: "Price, rating, in-stock and FAQ schema on its Premium plan, with more on higher plans.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Sitemap and broken links",
      vendor: { value: "partial", note: "Sitemap submit and broken-link tools are listed. A dedicated redirect manager is not documented on the pages we read.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Image compression and page speed",
      vendor: { value: "yes", note: "Image compression, minification and lazy loading are listed across its plans.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "AI product descriptions",
      vendor: { value: "partial", note: "AI product descriptions are listed from its Premium plan. AI blog posts are not documented.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_C.productDescriptions,
    },
    {
      dimension: "Keyword research and rank tracking",
      vendor: { value: "yes", note: "Listed on its Enterprise plan.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "yes", note: "Its home page says it is a quick start with no code.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Starter", price: "$0 per month", currency: "Not stated (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Premium, 250 AI requests", price: "$39 per month, or $374 per year", currency: "Not stated (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Enterprise, 5,000 AI requests", price: "$99 per month, or $950 per year", currency: "Not stated (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Plus, 10,000 AI requests", price: "$399 per month, or $3830 per year", currency: "Not stated (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Premium on its Shopify listing", price: "₹1,838.06 per month, 7-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Enterprise on its Shopify listing", price: "₹4,665.85 per month, 7-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "SearchPie", bestFor: "Stores that want a broad technical SEO toolkit in one app, including schema, speed tools and keyword tracking, with a no-charge entry level." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want SEO titles, descriptions and alt text drafted for them to approve and undo, a product-by-product audit and product descriptions written for them." },
  ],
  limitations: [
    "We read only SearchPie's own public pages and its Shopify listing. Its listing shows three plans and its site shows a fourth, Plus; we did not reconcile them.",
    "Its pricing page shows a bare $ with no currency code, and its listing shows INR as a regional display. Plans and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a SearchPie alternative for Shopify?", a: "Peakhour is one option if you want SEO fixes and product descriptions prepared for your approval. If you need schema, speed tools or rank tracking, read SearchPie's own pages first." },
    { q: "Where does this information come from?", a: "Only from SearchPie's own public pages and its Shopify App Store listing, each linked in the table with the date we read it." },
  ],
};
