import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://tinyseo.com/", label: "TinyIMG (now TinySEO) home page" },
  pricing: { href: "https://tinyseo.com/pricing/", label: "TinyIMG (now TinySEO) pricing" },
  listing: { href: "https://apps.shopify.com/smart-image-optimizer", label: "Tiny SEO Speed Image Optimizer on the Shopify App Store" },
};

export const TINYIMG: CompetitorBrief = {
  slug: "tinyimg",
  pageId: "shopify.compare.tinyimg",
  pillar: "content",
  relatedIds: ["shopify", "shopify.features.ai.seo", "shopify.features.ai.product.descriptions", "pricing"],
  name: "TinyIMG",
  url: "https://tinyseo.com/",
  category: "Image optimisation and SEO app for Shopify",
  observedAt: D,
  title: "Peakhour vs TinyIMG for Shopify",
  description: "Peakhour and TinyIMG compared for Shopify stores: image speed, alt text, SEO fixes, AI descriptions and pricing, each cell sourced and dated.",
  h1: "Peakhour vs TinyIMG for Shopify",
  directAnswer:
    "TinyIMG, now branded TinySEO, started from image compression and page speed and has grown into SEO fixes and AI content. Peakhour drafts SEO titles, descriptions and alt text for you to approve, audits your products, and writes product descriptions and blog drafts. TinyIMG documents image compression, structured data and speed tools that Peakhour does not claim. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Faster pages through smaller images", body: "Your main problem is heavy images and slow pages." },
    { title: "Fixing product SEO", body: "You want titles, meta descriptions and alt text drafted and applied across the catalogue." },
    { title: "Technical SEO", body: "You want structured data, a sitemap and broken-link handling." },
    { title: "Writing product content", body: "You want descriptions and blog posts drafted for you to review." },
  ],
  claims: [
    {
      dimension: "Image compression",
      vendor: { value: "yes", note: "Its home page says it reduces image file size with no visible quality loss, and its pricing page lists a monthly image allowance per plan.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Image alt text",
      vendor: { value: "yes", note: "Alt text and filename optimisation is listed. Whether the text is AI-written is not stated on the pages we read.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_C.seoFixes,
    },
    {
      dimension: "Meta titles and descriptions",
      vendor: { value: "yes", note: "Its home page says it can generate metadata for any page; its pricing page lists AI metadata.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_C.seoFixes,
    },
    {
      dimension: "Structured data (JSON-LD)",
      vendor: { value: "yes", note: "JSON-LD structured data is listed. Its listing and its pricing page place it on different plans.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Sitemap and broken links",
      vendor: { value: "yes", note: "Sitemap, broken links and IndexNow are listed on one of its plans.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "SEO audit",
      vendor: { value: "partial", note: "A per-page SEO checklist and a full-site audit are listed, with an audit page cap per plan. A numeric score is not stated.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_C.seoAudit,
    },
    {
      dimension: "AI product descriptions",
      vendor: { value: "yes", note: "Its home page says it can create product descriptions; AI credits are limited per plan.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_C.productDescriptions,
    },
    {
      dimension: "AI blog posts",
      vendor: { value: "yes", note: "An AI blog builder is listed on its pricing page.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_C.blogWriter,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "yes", note: "Its home page says you can improve page load times without coding.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Free, 50 images and 10 AI credits a month", price: "$0 per month", currency: "Not stated (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Beginner, 1,500 images and 150 AI credits a month", price: "$14 per month, 7-day trial", currency: "Not stated (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Advanced, 5,000 images and 300 AI credits a month", price: "$23 per month, 7-day trial", currency: "Not stated (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Expert, 15,000 images and 1,000 AI credits a month", price: "$49 per month, 7-day trial", currency: "Not stated (shown as $)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Beginner on its Shopify listing", price: "₹1,319.63 per month, 7-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
    ],
  },
  bestFor: [
    { vendor: "TinyIMG", bestFor: "Stores whose main issue is page speed through image weight, or that want technical SEO tools such as structured data, a sitemap and broken-link handling, with an image allowance priced per plan." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want SEO titles, descriptions and alt text, product descriptions and blog drafts prepared for them to approve, and a product-by-product audit." },
  ],
  limitations: [
    "We read only TinyIMG's own public pages and its Shopify listing. Its site now sits at tinyseo.com, and its older address redirects there.",
    "Its listing and its pricing page place some features on different plans, so check the live page before relying on a plan-level feature. Its pricing page shows a bare $ with no currency code.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a TinyIMG alternative for Shopify?", a: "Peakhour is one option if you want SEO fixes, product descriptions and blog drafts prepared for your approval. If image compression is your main need, read TinyIMG's own pages first." },
    { q: "Where does this information come from?", a: "Only from TinyIMG's own public pages and its Shopify App Store listing, each linked in the table with the date we read it." },
  ],
};
