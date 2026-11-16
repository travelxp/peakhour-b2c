import { PEAKHOUR_W3C as P } from "./peakhour-cmp-w3c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://www.describely.ai/", label: "Describely home page" },
  pricing: { href: "https://www.describely.ai/pricing", label: "Describely pricing" },
  listing: { href: "https://apps.shopify.com/describely", label: "Describely on the Shopify App Store" },
};

export const DESCRIBELY = {
  slug: "describely" as const,
  pageId: "shopify.compare.describely",
  pillar: "content",
  relatedIds: ["shopify", "shopify.features.ai.product.descriptions", "shopify.features.ai.seo", "pricing"],
  name: "Describely",
  url: "https://www.describely.ai/",
  category: "Bulk product description and catalogue SEO app for Shopify",
  observedAt: D,
  title: "Peakhour vs Describely for Shopify",
  description: "Peakhour and Describely compared for Shopify product content: descriptions, SEO titles, approvals, languages and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Describely for Shopify",
  directAnswer:
    "Describely writes product descriptions, titles, tags and SEO text in bulk, in several languages, and starts with an audit of your products. Peakhour writes descriptions for products that have none or thin ones, drafts SEO titles and alt text, and applies nothing until you approve. Describely documents bulk editing and translation that Peakhour does not claim. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Filling a large catalogue", body: "Thousands of products have no description or a thin one, and you want them drafted in one pass." },
    { title: "Selling in more than one language", body: "You want product text translated and written for other markets." },
    { title: "Keeping control of what goes live", body: "You want to approve each draft and undo what you applied." },
    { title: "Fixing SEO text at the same time", body: "You want search titles and descriptions written along with the product copy." },
  ],
  claims: [
    {
      dimension: "AI product descriptions",
      vendor: { value: "yes", note: "AI generation of product descriptions with prompt templates, tone and style settings.", source: S.listing, observedAt: D },
      peakhour: P.productDescriptions,
    },
    {
      dimension: "SEO titles and meta descriptions",
      vendor: { value: "yes", note: "SEO titles and descriptions are among the content types it writes.", source: S.listing, observedAt: D },
      peakhour: P.seoTitlesAndAlt,
    },
    {
      dimension: "Approve before it goes live",
      vendor: { value: "yes", note: "The listing says to review and publish, and re-audit as content changes.", source: S.listing, observedAt: D },
      peakhour: P.descriptionsApprove,
    },
    {
      dimension: "Undo an applied change",
      vendor: { value: "not-documented", note: "Undo is not mentioned in the listing.", source: S.listing, observedAt: D },
      peakhour: P.descriptionsUndo,
    },
    {
      dimension: "Product audit first",
      vendor: { value: "yes", note: "It starts with an audit that scores products for AI-search visibility and conversion.", source: S.listing, observedAt: D },
      peakhour: P.seoAudit,
    },
    {
      dimension: "Translation and other languages",
      vendor: { value: "yes", note: "Multi-language support and translation are listed.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Bulk editing across the store",
      vendor: { value: "yes", note: "A bulk editor covers products, variants, images, tags, descriptions, metafields and collections.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Blog posts",
      vendor: { value: "not-documented", note: "Blog writing is not named in the listing.", source: S.listing, observedAt: D },
      peakhour: P.blogWriter,
    },
  ],
  pricing: {
    rows: [
      { plan: "Free, 5 products", price: "Free, with unlimited AI generations and audits for those 5 products", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Pay as you go", price: "$0.75 per product for generations and audits, shown as a one-time ₹70.69 charge", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "50 products", price: "₹2,639.27 per month or ₹26,392.69 per year", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "250 products", price: "₹13,007.82 per month or ₹130,078.24 per year", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Pay as you go on its site", price: "$0.75 per product, first 5 products free", currency: "USD (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "High volume, 500 or more products", price: "Not published, custom pricing", currency: "Not stated", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Describely", bestFor: "Stores with a large catalogue that want bulk generation and editing, translation into other languages, and a free first five products." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want descriptions written only for products that have none or thin ones, SEO text drafted with them, and every change approved first and undoable." },
  ],
  limitations: [
    "We read only Describely's own site, pricing page and Shopify listing. Its help centre page for the Shopify app could not be loaded.",
    "Its listing shows INR as an estimate for the visitor's location; billing is in your store's currency. Plans and credits change.",
    "Where our own side says Unknown, the evidence for Peakhour is not yet approved and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Describely alternative for Shopify?", a: "Peakhour is one option if you want product descriptions and SEO text drafted for your approval. If you need bulk editing or translation, read Describely's own pages first." },
    { q: "Where does this information come from?", a: "Only from Describely's own public pages and its Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
