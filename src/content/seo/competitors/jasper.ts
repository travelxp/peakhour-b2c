import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const J = "https://www.jasper.ai";
const S = {
  home: { href: `${J}/`, label: "Jasper home page" },
  pricing: { href: `${J}/pricing`, label: "Jasper pricing" },
  blog: { href: `${J}/use-cases/blog-writing`, label: "Jasper blog writing" },
  voice: { href: `${J}/brand-voice`, label: "Jasper brand voice" },
  api: { href: `${J}/api`, label: "Jasper API and agents" },
  integrations: { href: `${J}/integrations`, label: "Jasper integrations" },
};

export const JASPER: CompetitorBrief = {
  slug: "jasper",
  pageId: "compare.jasper",
  scope: "global",
  pillar: "content",
  relatedIds: ["pricing", "content"],
  name: "Jasper",
  url: `${J}/`,
  category: "AI marketing content platform",
  observedAt: D,
  title: "Peakhour vs Jasper for marketing content",
  description: "Peakhour and Jasper compared for AI marketing content: blogs, brand voice, campaigns, publishing, SEO, teams and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Jasper",
  directAnswer:
    "Jasper is an AI content platform for marketing teams: long-form writing, campaigns, brand settings, integrations and agents. Peakhour drafts in your brand voice and publishes only what you approve, for Shopify blogs and social posts, and sits inside a wider growth product. Jasper is broader as a writing and team tool; Peakhour is narrower but connects drafting to publishing. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "A writing workspace for a team", body: "You want a shared editor, brand settings and collaboration for many kinds of content." },
    { title: "Campaign content across channels", body: "You want briefs turned into on-brand content for several channels." },
    { title: "Drafts that publish after approval", body: "You want drafts to go to your Shopify blog or social accounts once you approve them." },
    { title: "Product SEO on a Shopify store", body: "You want product pages fixed for search inside the store." },
  ],
  claims: [
    {
      dimension: "Long-form and blog writing",
      vendor: { value: "partial", note: "A document editor for writing and editing content. Its own page warns AI content will not be publish-ready right away.", source: S.blog, observedAt: D },
      peakhour: PEAKHOUR_C.blogWriter,
    },
    {
      dimension: "Brand voice",
      vendor: { value: "partial", note: "Brand settings for voice, tone and style, with off-brand flags. How a voice is learned is not described on the page we read.", source: S.voice, observedAt: D },
      peakhour: PEAKHOUR_C.brandVoice,
    },
    {
      dimension: "Campaign content across channels",
      vendor: { value: "yes", note: "Turns briefs and channel requirements into on-brand campaign content.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Product descriptions for a store",
      vendor: { value: "not-documented", note: "We did not find a product-description page on its own site.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_C.productDescriptions,
    },
    {
      dimension: "Publishing straight to channels",
      vendor: { value: "not-documented", note: "Its integrations page lists tools such as Google Docs, Slack and Webflow, and no social or Shopify publishing.", source: S.integrations, observedAt: D },
      peakhour: PEAKHOUR_C.socialPublishing,
    },
    {
      dimension: "SEO help",
      vendor: { value: "partial", note: "A SurferSEO add-on analyses content against competing pages.", source: S.blog, observedAt: D },
      peakhour: PEAKHOUR_C.seoFixes,
    },
    {
      dimension: "Team collaboration",
      vendor: { value: "yes", note: "A shared workspace where work is assigned and status is visible; admin controls and groups on its Business plan.", source: S.api, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "API and custom agents",
      vendor: { value: "yes", note: "A Jasper API and agents, with API access limited to Business customers and partners.", source: S.api, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Pro, 1 seat", price: "$69 per seat per month billed monthly, or $59 billed yearly, 7-day free trial", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Business", price: "Not published (custom pricing, contact sales, 12-month commitment)", currency: "USD", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Jasper", bestFor: "Marketing teams that want a shared AI writing workspace with brand settings, campaign content, integrations and agents, and are comfortable moving finished content into their channels themselves. It is the broader writing tool." },
    { vendor: "Peakhour", bestFor: "Shopify merchants and small teams who want drafts in their own brand voice that publish to a Shopify blog or social accounts only after approval, with product SEO fixes in the same product." },
  ],
  limitations: [
    "We read only Jasper's own public pages. Several product pages we tried returned an error, so a feature we did not find is marked Not documented, which is not the same as No.",
    "Its pricing is stated in USD with a Stripe exchange rate at purchase, and no region. Plans, credits and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed. Peakhour's blog publishing is Shopify only.",
  ],
  faqs: [
    { q: "Is there a Jasper alternative that publishes after approval?", a: "Peakhour is one option if you want drafts in your own brand voice published to a Shopify blog or social accounts only after you approve them. For a broad team writing workspace, read Jasper's own pages first." },
    { q: "Where does this information come from?", a: "Only from Jasper's own public pages, each linked in the table with the date we read it." },
  ],
};
