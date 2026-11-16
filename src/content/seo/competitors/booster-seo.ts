import { PEAKHOUR_W3C as P } from "./peakhour-cmp-w3c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://boosterseo.com/", label: "Booster SEO home page" },
  listing: { href: "https://apps.shopify.com/seo-image-optimizer", label: "Booster SEO and Image Optimizer on the Shopify App Store" },
};

export const BOOSTER_SEO = {
  slug: "booster-seo" as const,
  pageId: "shopify.compare.booster.seo",
  pillar: "content",
  relatedIds: ["shopify", "shopify.features.seo.audit", "shopify.features.ai.seo", "pricing"],
  name: "Booster SEO",
  url: "https://boosterseo.com/",
  category: "SEO and image optimisation app for Shopify",
  observedAt: D,
  title: "Peakhour vs Booster SEO for Shopify",
  description: "Peakhour and Booster SEO compared for Shopify stores: SEO audit, automatic fixes, alt text, structured data, images and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Booster SEO for Shopify",
  directAnswer:
    "Booster SEO audits your store and fixes SEO problems on its own through an AutoPilot, and also compresses images. Peakhour audits your products and drafts SEO titles, descriptions and alt text that you edit, tick and can undo. Booster SEO documents structured data, image compression and automatic fixes that Peakhour does not do the same way. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Hands-off SEO fixing", body: "You want an app that finds and fixes SEO issues automatically." },
    { title: "Faster images", body: "You want your product images compressed for faster pages." },
    { title: "Fixing product text", body: "You want titles, meta descriptions and alt text drafted for you." },
    { title: "Approving every change", body: "You want to choose which fixes apply and undo them." },
  ],
  claims: [
    {
      dimension: "SEO audit",
      vendor: { value: "yes", note: "Manual SEO audits and insights are included at no charge.", source: S.listing, observedAt: D },
      peakhour: P.seoAudit,
    },
    {
      dimension: "Fixes applied automatically",
      vendor: { value: "yes", note: "AutoPilot applies SEO fixes and monitors your store, on its Pro plan.", source: S.listing, observedAt: D },
      peakhour: P.seoTickAndUndo,
    },
    {
      dimension: "Meta tags and image alt text",
      vendor: { value: "yes", note: "Meta title and description optimisation on Pro, and alt text optimisation with templates at no charge.", source: S.listing, observedAt: D },
      peakhour: P.seoTitlesAndAlt,
    },
    {
      dimension: "Structured data",
      vendor: { value: "yes", note: "Google rich snippets and structured data on its Pro plan.", source: S.listing, observedAt: D },
      peakhour: P.seoNoSchema,
    },
    {
      dimension: "Redirects for broken links",
      vendor: { value: "partial", note: "Its home page says it addresses broken links. Redirects are not named as a plan feature.", source: S.home, observedAt: D },
      peakhour: P.seoNoRedirects,
    },
    {
      dimension: "Image compression",
      vendor: { value: "yes", note: "Image compression with 5GB of storage a month, on its Premium plan.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "AI product descriptions",
      vendor: { value: "not-documented", note: "Writing product descriptions is not named in the listing.", source: S.listing, observedAt: D },
      peakhour: P.productDescriptions,
    },
  ],
  pricing: {
    rows: [
      { plan: "Free", price: "Free, no price shown", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Pro", price: "₹3,676.12 per month or ₹32,896.60 per year, 14-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Premium", price: "₹6,503.91 per month or ₹58,346.69 per year, 14-day trial", currency: "INR", region: "India, as shown on its listing", observedAt: D, source: S.listing },
      { plan: "Plans on its home page", price: "Not published, its pricing sits on a separate page we did not read", currency: "Not stated", region: "Not stated", observedAt: D, source: S.home },
    ],
  },
  bestFor: [
    { vendor: "Booster SEO", bestFor: "Stores that want SEO fixed automatically in the background, with structured data and image compression in the same app." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want to see and tick each SEO fix before it applies, undo any batch, and get product descriptions drafted too." },
  ],
  limitations: [
    "We read Booster SEO's home page and its Shopify listing. Its pricing page and help pages were not read.",
    "Its listing shows INR as an estimate for the visitor's location; billing is in your store's currency. Plans and offers change.",
    "Where our own side says Not supported, that is a limit recorded on our own SEO features, not a statement about Booster SEO.",
  ],
  faqs: [
    { q: "Is there a Booster SEO alternative for Shopify?", a: "Peakhour is one option if you want SEO fixes drafted for your approval, with undo. If you want fixes applied automatically, or structured data and image compression, read Booster SEO's own pages first." },
    { q: "Where does this information come from?", a: "Only from Booster SEO's own public pages and its Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
