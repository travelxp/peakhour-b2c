import { PEAKHOUR_W3C as P } from "./peakhour-cmp-w3c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://www.hypotenuse.ai/", label: "Hypotenuse AI home page" },
  pricing: { href: "https://www.hypotenuse.ai/pricing", label: "Hypotenuse AI pricing" },
  listing: { href: "https://apps.shopify.com/product-description-writer", label: "Tako SEO Description AI writer (by Hypotenuse AI) on the Shopify App Store" },
};

export const HYPOTENUSE = {
  slug: "hypotenuse" as const,
  pageId: "shopify.compare.hypotenuse",
  pillar: "content",
  relatedIds: ["shopify", "shopify.features.ai.product.descriptions", "shopify.features.ai.blog.generator", "pricing"],
  name: "Hypotenuse AI",
  url: "https://www.hypotenuse.ai/",
  category: "AI writing platform for ecommerce content, with a Shopify app listed as Tako SEO Description AI writer",
  observedAt: D,
  title: "Peakhour vs Hypotenuse AI for Shopify",
  description: "Peakhour and Hypotenuse AI compared for Shopify product and blog content: descriptions, tone, languages, approvals and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Hypotenuse AI for Shopify",
  directAnswer:
    "Hypotenuse AI writes product descriptions, blog articles, category page text and ads, in over 20 languages, through its Shopify app. Peakhour writes descriptions for products that have none or thin ones, drafts blog articles to your Shopify blog as hidden drafts, and learns your brand voice from your own posts. Hypotenuse AI documents languages, ads and category text that Peakhour does not claim. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Writing product copy in volume", body: "You want many descriptions generated quickly in a tone that suits your brand." },
    { title: "Selling in other languages", body: "You want product text written for international shoppers." },
    { title: "Writing blog articles", body: "You want blog drafts that land in your Shopify blog for you to check." },
    { title: "Keeping your own voice", body: "You want drafts to sound like your existing posts." },
  ],
  claims: [
    {
      dimension: "AI product descriptions",
      vendor: { value: "yes", note: "Product descriptions generated with AI, per its Shopify listing.", source: S.listing, observedAt: D },
      peakhour: P.productDescriptions,
    },
    {
      dimension: "Tone of voice",
      vendor: { value: "yes", note: "Descriptions in a tone of voice that suits yours.", source: S.listing, observedAt: D },
      peakhour: P.brandVoice,
    },
    {
      dimension: "Blog articles",
      vendor: { value: "partial", note: "Blog articles are listed. Its AI Blog Writer is included on the Pro and Elite plans, not Free or Starter.", source: S.listing, observedAt: D },
      peakhour: P.blogWriter,
    },
    {
      dimension: "Bulk writing in 20 or more languages",
      vendor: { value: "yes", note: "Content for international audiences in bulk, in over 20 languages.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Category page text and ads",
      vendor: { value: "yes", note: "Category page descriptions and ads are listed, and ad writing is unlimited on every paid plan.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "SEO titles, meta descriptions and alt text",
      vendor: { value: "not-documented", note: "The listing says content helps SEO rankings but does not name titles, meta descriptions or alt text.", source: S.listing, observedAt: D },
      peakhour: P.seoTitlesAndAlt,
    },
    {
      dimension: "Approve before it goes live",
      vendor: { value: "not-documented", note: "The listing does not say whether you approve a description before it is written to your store.", source: S.listing, observedAt: D },
      peakhour: P.descriptionsApprove,
    },
    {
      dimension: "Undo an applied change",
      vendor: { value: "not-documented", note: "Undo is not mentioned in the listing.", source: S.listing, observedAt: D },
      peakhour: P.descriptionsUndo,
    },
  ],
  pricing: {
    rows: [
      { plan: "Free, 20 credits on install", price: "Free to install", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Starter, 40 credits a month", price: "₹848.34 per month", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Pro, 200 credits a month", price: "₹3,676.12 per month", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Elite, 1,000 credits a month", price: "₹9,331.70 per month", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Basic and Ecommerce Enterprise on its site", price: "Not published, both plans show custom pricing", currency: "Not stated", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Hypotenuse AI", bestFor: "Merchants who want a general ecommerce writing tool: many languages, ads and category text as well as descriptions, with monthly credits." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want descriptions for the products that need them, blog drafts that land hidden in their Shopify blog, and every change approved first and undoable." },
  ],
  limitations: [
    "We read Hypotenuse AI's pricing page and its Shopify listing. Its pricing page shows two custom-priced plans and does not mention the Shopify app plans, so we could not reconcile the two.",
    "Its help page on the Shopify integration could not be read. Its site only lists Shopify among its integrations.",
    "Its listing shows INR as an estimate for the visitor's location. Plans and credits change.",
    "Where our own side says Unknown, the evidence for Peakhour is not yet approved and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Hypotenuse AI alternative for Shopify?", a: "Peakhour is one option if you want product descriptions and blog drafts prepared for your approval inside Shopify. If you need many languages, ads or category text, read Hypotenuse AI's own pages first." },
    { q: "Where does this information come from?", a: "Only from Hypotenuse AI's own public pages and its Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
