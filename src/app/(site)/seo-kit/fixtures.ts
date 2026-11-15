import type {
  ComparisonPageContent,
  DirectoryContent,
  FeatureContent,
  GuideContent,
  IndustryContent,
  IntegrationContent,
  PlatformContent,
  PlatformItem,
  ProofContent,
  ShopifyFeatureContent,
  SolutionContent,
} from "@/components/marketing/seo/content-types";
import type { PageRecord } from "@/lib/seo/types";

/**
 * Review fixtures for /seo-kit. English only. They use Peakhour's real capabilities (WhatsApp COD confirmation and
 * Smart Rails, as /shopify describes them), every competitor cell is "Unknown" with no source, and every record is a
 * draft: this is a design review, never page copy. Nothing here reaches production (the route 404s there) or the
 * sitemap.
 */

const base = (
  pageId: string,
  family: PageRecord["family"],
  path: string,
  h1: string,
  extra: Partial<PageRecord> = {},
): PageRecord => ({
  pageId: `fixture.${pageId}`,
  family,
  scope: "global",
  path,
  capabilityIds: [],
  surface: "web",
  editorialStatus: "draft",
  indexable: false,
  title: h1.slice(0, 60),
  description: "Fixture page for the template kit review.",
  h1,
  primaryCta: { label: "Join the waitlist", href: "/launch-partner", kind: "waitlist" },
  owner: "growth",
  lastReviewedAt: "2026-11-15",
  relatedIds: [],
  ...extra,
});

const demoProof: ProofContent = {
  kind: "sample",
  title: "Shelf: you may also like",
  caption: "Sample store art. A shelf built by Smart Rails, with the reason beside each pick.",
  tiles: [
    { art: "kurta", tint: "indigo", label: "Indigo kurta" },
    { art: "scarf", tint: "rose", label: "Silk scarf" },
    { art: "bag", tint: "marigold", label: "Jute tote" },
  ],
};

const codProof: ProofContent = {
  kind: "demo",
  title: "Orders on hold",
  caption: "Demo. Orders wait for the shopper's reply on WhatsApp before the parcel goes out.",
  tiles: [
    { art: "mug", tint: "clay", label: "Order 1042" },
    { art: "bottle", tint: "leaf", label: "Order 1043" },
    { art: "bag", tint: "indigo", label: "Order 1044" },
  ],
};

const platforms: PlatformItem[] = [
  { surface: "shopify", label: "Shopify", status: "live", body: "Runs inside your Shopify admin and theme editor.", href: "/seo-kit?template=shopify-feature" },
  { surface: "woocommerce", label: "WooCommerce", status: "development", body: "Being built. Nothing to install yet.", limitations: ["No plugin available"] },
  { surface: "web", label: "Your own site", status: "planned", body: "Planned once the store platforms are done." },
];

const crumbs = (label: string) => [
  { label: "Home", href: "/" },
  { label: "Template kit", href: "/seo-kit" },
  { label: label, href: "/seo-kit" },
];

const faqs = [
  { q: "Does it work without WhatsApp?", a: "No. COD confirmation messages the shopper on WhatsApp, so your WhatsApp Business number has to be connected first." },
  { q: "Who approves what goes live?", a: "You do. Peakhour suggests and prepares; changes that touch your store wait for your approval, and almost all can be undone." },
  { q: "Does it add a fee to WhatsApp messages?", a: "No. Meta bills its WhatsApp fees to you directly, and Peakhour adds no markup." },
];

const related = [
  { label: "WhatsApp COD confirmation for Shopify", href: "/seo-kit?template=shopify-feature", note: "The Shopify setup, step by step." },
  { label: "Peakhour for Shopify", href: "/shopify", note: "Everything the Shopify app does." },
  { label: "How Peakhour works", href: "/how-it-works", note: "Ask, approve, undo." },
  { label: "Pricing", href: "/pricing", note: "One plan, with the trial." },
];

const closing = { headline: "Try it on your own store.", body: "Join the waitlist and we will tell you the day it opens to your store." };

export const FEATURE_PAGE: PageRecord = base("feature", "feature", "/features/cod-confirmation", "Confirm cash-on-delivery orders on WhatsApp");
export const FEATURE: FeatureContent = {
  crumbs: crumbs("COD confirmation"),
  eyebrow: "Commerce",
  directAnswer:
    "Peakhour messages a shopper on WhatsApp to confirm a cash-on-delivery order and holds the parcel until they reply, so fewer parcels go to people who never meant to take them.",
  secondaryCta: { label: "See how it works", href: "#workflow" },
  proof: codProof,
  status: "live",
  limitations: ["It needs your WhatsApp Business number connected.", "It does not guarantee a reply: an order with no answer stays on hold for you to decide.", "It is not available on WooCommerce yet."],
  verifiedAt: "2026-11-15",
  platforms,
  steps: [
    { title: "Connect WhatsApp", body: "Link your WhatsApp Business number once." },
    { title: "Switch on COD confirmation", body: "Turn it on in Autopilot, one task at a time." },
    { title: "Shopper confirms", body: "They reply on WhatsApp; the order is released." },
    { title: "Review the feed", body: "Every confirmation shows in your activity feed." },
  ],
  prerequisites: ["A Shopify store taking cash on delivery", "A connected WhatsApp Business number"],
  approvalBoundaries: ["You switch it on, and you can stop it in a second", "Orders with no reply wait for you; nothing is cancelled on its own"],
  integrations: [
    { label: "WhatsApp", href: "/seo-kit?template=integration", note: "The number the confirmations come from." },
    { label: "Shopify", href: "/shopify", note: "Where the orders live." },
  ],
  pricingNote: "Included in the one plan. WhatsApp fees are billed by Meta to you, with no Peakhour markup.",
  faqs,
  related,
  closing,
};

export const SHOPIFY_FEATURE_PAGE: PageRecord = base("shopify-feature", "shopify-feature", "/shopify/features/cod-confirmation", "WhatsApp COD confirmation for Shopify", {
  scope: "shopify",
  surface: "shopify",
});
export const SHOPIFY_FEATURE: ShopifyFeatureContent = {
  crumbs: [{ label: "Home", href: "/" }, { label: "Shopify", href: "/shopify" }, { label: "COD confirmation", href: "/seo-kit?template=shopify-feature" }],
  eyebrow: "Peakhour for Shopify",
  directAnswer: "On Shopify, Peakhour confirms each cash-on-delivery order on WhatsApp and holds the parcel until the shopper replies. You switch it on in Autopilot.",
  proof: codProof,
  status: "live",
  limitations: ["Needs WhatsApp connected", "Covers cash-on-delivery orders only"],
  verifiedAt: "2026-11-15",
  setupSteps: [
    { title: "Install the app", body: "Add Peakhour from the Shopify App Store." },
    { title: "Connect WhatsApp", body: "Link your WhatsApp Business number." },
    { title: "Switch on COD confirmation", body: "In Autopilot, turn on the one task." },
  ],
  permissions: [
    { name: "read_orders", why: "To see new cash-on-delivery orders and their status." },
    { name: "write_orders", why: "To mark an order on hold and release it after the shopper confirms." },
  ],
  globalPage: { label: "COD confirmation across Peakhour", href: "/seo-kit?template=feature" },
  faqs,
  related,
  closing,
};

export const SOLUTION_PAGE: PageRecord = base("solution", "solution", "/solutions/reduce-rto", "Cut returns to origin on cash-on-delivery orders");
export const SOLUTION: SolutionContent = {
  crumbs: crumbs("Reduce RTO"),
  eyebrow: "Solution",
  directAnswer: "Returns to origin fall when you confirm the order before you ship it. Peakhour asks the shopper on WhatsApp, and only releases the parcel once they answer.",
  secondaryCta: { label: "Read the steps", href: "#workflow" },
  problem: {
    heading: "A parcel nobody wanted costs you twice.",
    body: "You pay to ship it out and to bring it back, and the stock sits unsold in between. It matters most when cash on delivery is a large share of your orders.",
  },
  alternatives: [
    { name: "Call every buyer", body: "Works at ten orders a day and breaks at a hundred." },
    { name: "Prepay incentives", body: "Moves some buyers to prepaid, but not those who will not." },
    { name: "Confirm on WhatsApp", body: "Asks every cash-on-delivery buyer, at any volume." },
  ],
  steps: [
    { title: "Order arrives", body: "A cash-on-delivery order is placed." },
    { title: "Peakhour asks", body: "The shopper gets a WhatsApp message." },
    { title: "Shopper replies", body: "The order is released or stays on hold." },
  ],
  examples: [
    { title: "A fashion store on a sale weekend", body: "Order volume triples; every cash-on-delivery order is still asked, with no extra staff." },
    { title: "A store with a new pincode range", body: "Confirmation shows which new areas reply, before you ship there at scale." },
  ],
  kpis: [
    { name: "RTO rate", definition: "Parcels returned undelivered, divided by parcels shipped, over the same period." },
    { name: "Confirmation rate", definition: "Cash-on-delivery orders the shopper confirmed, divided by those asked." },
  ],
  prerequisites: ["A connected WhatsApp Business number", "Cash-on-delivery turned on in your store"],
  faqs,
  related,
  closing,
};

export const INDUSTRY_PAGE: PageRecord = base("industry", "industry", "/industries/fashion-apparel", "Peakhour for fashion and apparel stores");
export const INDUSTRY: IndustryContent = {
  crumbs: crumbs("Fashion and apparel"),
  eyebrow: "Industry",
  directAnswer: "Fashion stores live on a wide range and fast-moving stock. Peakhour answers shopper questions from your catalogue, builds shelves that surface the range, and confirms cash-on-delivery orders.",
  secondaryCta: { label: "See the use cases", href: "#use-cases" },
  proof: demoProof,
  problem: "Sizes, colours and seasons multiply the catalogue, shoppers ask the same fit questions all day, and a returned parcel is a sold-out size you cannot resell.",
  useCases: [
    { pillar: "Support", title: "Answer fit and delivery questions", body: "The assistant answers from your real catalogue, so shoppers stop waiting for you." },
    { pillar: "Commerce", title: "Shelves that show the range", body: "Smart Rails builds shelves such as you may also like, with a reason beside each pick." },
    { pillar: "Commerce", title: "Confirm cash-on-delivery orders", body: "Fewer parcels go to people who never meant to take them." },
  ],
  integrations: [
    { label: "WhatsApp", href: "/seo-kit?template=integration", note: "Confirmations and shopper chat." },
    { label: "Shopify", href: "/shopify", note: "Catalogue and orders." },
  ],
  risks: ["Size and fit advice comes from your catalogue data, so thin product pages give thin answers.", "Peakhour does not promise a lift in sales."],
  platforms,
  faqs,
  related,
  closing,
};

export const PLATFORM_PAGE: PageRecord = base("platform", "platform", "/platforms/shopify", "Peakhour on your store platform");
export const PLATFORM: PlatformContent = {
  crumbs: crumbs("Platforms"),
  eyebrow: "Platforms",
  directAnswer: "Peakhour runs on Shopify today. WooCommerce is being built, and your own site is planned.",
  secondaryCta: { label: "Install on Shopify", href: "/shopify" },
  proof: demoProof,
  platforms,
  included: [
    { label: "Shopping assistant", status: "live", body: "Answers shoppers from your catalogue." },
    { label: "Smart Rails", status: "live", body: "Shelves with a reason beside each pick." },
    { label: "COD confirmation", status: "live", body: "Confirms cash-on-delivery orders on WhatsApp." },
    { label: "Store-wide reporting", status: "beta", body: "One view of what Peakhour did." },
  ],
  steps: [
    { title: "Install", body: "Add the app from your platform's store." },
    { title: "Connect", body: "Link WhatsApp and your catalogue." },
    { title: "Approve", body: "Switch tasks on one at a time." },
  ],
  faqs,
  related,
  closing,
};

export const INTEGRATION_PAGE: PageRecord = base("integration", "integration", "/integrations/whatsapp", "Peakhour and WhatsApp", { surface: "whatsapp" });
export const INTEGRATION: IntegrationContent = {
  crumbs: crumbs("WhatsApp"),
  eyebrow: "Integration",
  directAnswer: "Connect your WhatsApp Business number and Peakhour can confirm cash-on-delivery orders and answer shoppers on it. It does not message anyone you have not given it a reason to.",
  secondaryCta: { label: "Connect WhatsApp", href: "/launch-partner" },
  status: "live",
  limitations: ["It needs a WhatsApp Business number.", "Meta bills its fees to you directly."],
  verifiedAt: "2026-11-15",
  does: ["Confirms cash-on-delivery orders", "Answers shoppers from your catalogue", "Lets you approve or pause tasks from chat"],
  data: [
    { name: "The shopper's phone number", why: "To send the confirmation message for their own order." },
    { name: "Order and product details", why: "So the message names the right order." },
  ],
  steps: [
    { title: "Open settings", body: "Go to the WhatsApp connection." },
    { title: "Link your number", body: "Follow Meta's sign-in." },
    { title: "Choose tasks", body: "Switch on what should use WhatsApp." },
  ],
  faqs,
  related,
  closing,
};

export const COMPARISON_PAGE: PageRecord = base("compare", "shopify-compare", "/shopify/compare/example", "Peakhour and an example vendor, compared", { scope: "shopify", surface: "shopify" });
export const COMPARISON: ComparisonPageContent = {
  crumbs: [{ label: "Home", href: "/" }, { label: "Shopify", href: "/shopify" }, { label: "Compare", href: "/seo-kit?template=comparison" }],
  eyebrow: "Comparison",
  directAnswer: "Both can message shoppers on WhatsApp. This table shows what each vendor documents, and where we have not checked yet it says Unknown rather than guessing.",
  secondaryCta: { label: "Read the limits", href: "#limits" },
  comparison: {
    lastChecked: "2026-11-15",
    vendors: [
      { id: "ph", name: "Peakhour", isPeakhour: true },
      { id: "ex", name: "Example vendor", url: "https://example.com" },
    ],
    rows: [
      {
        dimension: "Confirms cash-on-delivery orders on WhatsApp",
        cells: {
          ph: { value: "yes", note: "Needs WhatsApp connected.", source: { href: "/shopify", label: "Peakhour for Shopify" }, observedAt: "2026-11-15" },
          ex: { value: "unknown" },
        },
      },
      {
        dimension: "Builds product shelves with a reason per pick",
        cells: { ph: { value: "yes", source: { href: "/shopify", label: "Peakhour for Shopify" }, observedAt: "2026-11-15" }, ex: { value: "unknown" } },
      },
      {
        dimension: "Works outside Shopify",
        cells: { ph: { value: "not-supported", note: "WooCommerce is being built.", source: { href: "/seo-kit?template=platform", label: "Platforms" }, observedAt: "2026-11-15" }, ex: { value: "unknown" } },
      },
      {
        dimension: "Publishes its pricing",
        cells: { ph: { value: "partial", note: "Plan price is public; WhatsApp fees are Meta's.", source: { href: "/pricing", label: "Pricing" }, observedAt: "2026-11-15" }, ex: { value: "unknown" } },
      },
    ],
  },
  buyerUseCases: [
    { title: "Cash-on-delivery confirmation", body: "A store that ships mostly cash on delivery and wants fewer returns." },
    { title: "Shopper chat", body: "A store that wants questions answered from its catalogue." },
  ],
  pricing: {
    asOf: "2026-11-15",
    currency: "INR",
    country: "India",
    rows: [
      { vendor: "Peakhour", plan: "Suite", price: "See pricing", source: { href: "/pricing", label: "Pricing" } },
      { vendor: "Example vendor", plan: "Unknown", price: "Unknown" },
    ],
  },
  suitability: [
    { vendor: "Peakhour", bestFor: "Shopify stores that want confirmation, shelves and chat in one place." },
    { vendor: "Example vendor", bestFor: "Unknown until we have read its documentation." },
  ],
  limitations: ["Every Unknown is a gap in our reading, not a finding about the vendor.", "Vendors change their products; check the linked source."],
  author: "Peakhour Growth",
  reviewer: "Pending review",
  faqs,
  related,
  closing,
};

export const GUIDE_PAGE: PageRecord = base("guide", "shopify-guide", "/shopify/guides/whatsapp-cod-confirmation", "How to confirm cash-on-delivery orders on WhatsApp", { scope: "shopify", surface: "shopify" });
export const GUIDE: GuideContent = {
  crumbs: [{ label: "Home", href: "/" }, { label: "Guides", href: "/seo-kit?template=directory" }, { label: "COD confirmation", href: "/seo-kit?template=guide" }],
  eyebrow: "Guide",
  directAnswer: "Message each cash-on-delivery buyer on WhatsApp before you ship, hold the parcel until they reply, and review the orders that stay silent.",
  secondaryCta: { label: "Jump to the steps", href: "#steps" },
  author: "Peakhour Growth",
  reviewer: "Pending review",
  updatedAt: "2026-11-15",
  sections: [
    { id: "why", heading: "Why confirm before you ship", paragraphs: ["A parcel returned undelivered costs the freight both ways and ties up stock.", "A short message that asks the buyer to confirm is cheaper than either."] },
    {
      id: "steps",
      heading: "The steps",
      paragraphs: ["The order matters: ask first, hold the parcel, then release."],
      list: ["Connect your WhatsApp Business number.", "Switch on COD confirmation.", "Hold each order until the buyer replies.", "Decide what to do with orders that stay silent."],
    },
    { id: "measure", heading: "How to tell it is working", paragraphs: ["Compare the share of parcels returned undelivered before and after, over the same number of weeks."] },
  ],
  sources: [{ label: "Meta: WhatsApp Business Platform", href: "https://developers.facebook.com/docs/whatsapp", note: "How business messaging works" }],
  faqs,
  related,
  closing,
};

export const DIRECTORY_PAGE: PageRecord = base("directory", "feature", "/seo-kit", "The Daylight template kit");
export const DIRECTORY: DirectoryContent = {
  crumbs: [{ label: "Home", href: "/" }, { label: "Template kit", href: "/seo-kit" }],
  eyebrow: "Review route",
  directAnswer: "Every public page template, rendered with fixture content for design review. This route exists on dev only and is never in the sitemap.",
  secondaryCta: { label: "Peakhour for Shopify", href: "/shopify" },
  items: [
    { title: "Feature page", body: "Cross-platform feature.", href: "/seo-kit?template=feature", status: "live", pillar: "Commerce" },
    { title: "Shopify feature page", body: "Platform variant.", href: "/seo-kit?template=shopify-feature", status: "live", pillar: "Commerce" },
    { title: "Solution page", body: "A merchant problem.", href: "/seo-kit?template=solution", status: "beta", pillar: "Commerce" },
    { title: "Industry page", body: "One industry.", href: "/seo-kit?template=industry", status: "development", pillar: "Commerce" },
    { title: "Platform page", body: "Where it runs.", href: "/seo-kit?template=platform", status: "live", pillar: "Platforms" },
    { title: "Integration page", body: "One connection.", href: "/seo-kit?template=integration", status: "live", pillar: "Support" },
    { title: "Comparison page", body: "Brand-safe table.", href: "/seo-kit?template=comparison", status: "planned", pillar: "Commerce" },
    { title: "Guide page", body: "How-to with sources.", href: "/seo-kit?template=guide", status: "beta", pillar: "Content" },
    { title: "Module hub", body: "A module with each capability's status.", href: "/seo-kit?template=hub", status: "live", pillar: "Commerce" },
  ],
  faqs: [{ q: "Is this page public?", a: "No. It returns 404 on the production deployment and is never listed in the sitemap." }],
  related: [
    { label: "Peakhour for Shopify", href: "/shopify", note: "The page this kit's design comes from." },
    { label: "How Peakhour works", href: "/how-it-works", note: "Ask, approve, undo." },
  ],
  closing,
};
