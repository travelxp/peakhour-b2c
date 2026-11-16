import { PEAKHOUR, pending } from "./peakhour";
import { PEAKHOUR_W3B } from "./peakhour-cmp-w3b";
import type { CompetitorBrief } from "./types";

// CMP-W3B
const D = "2026-11-16";
const B = "https://www.shoplift.ai";
const S = {
  home: { href: `${B}/`, label: "Shoplift home page" },
  pricing: { href: `${B}/pricing`, label: "Shoplift pricing" },
};
const unknownNote = (note: string) => ({ ...pending(), note });

export const SHOPLIFT = {
  slug: "shoplift" as const,
  pageId: "shopify.compare.shoplift",
  relatedIds: ["shopify", "shopify.features.merchandising.ab.testing", "shopify.features.product.recommendations", "pricing"],
  name: "Shoplift",
  url: `${B}/`,
  category: "Theme, page and price A/B testing for Shopify",
  observedAt: D,
  title: "Peakhour vs Shoplift for Shopify",
  description: "Peakhour and Shoplift compared for Shopify A/B testing: what each tests, how winners are read, setup and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Shoplift for Shopify",
  directAnswer:
    "Shoplift tests whole themes, page templates, single products, carts and prices, and reads results probabilistically. Peakhour tests one thing: product shelves. It compares two shelf strategies in the same spot, says which is ahead, and proposes the winner for your approval. It does not test prices or themes, and Shoplift goes much further there. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Testing a theme or page", body: "You want to compare a new theme, template or landing page against the one you have." },
    { title: "Testing prices", body: "You want to try product or subscription prices on real traffic." },
    { title: "Testing a product shelf", body: "You want to compare two ways of choosing the products a shelf shows." },
    { title: "Keeping control of the winner", body: "You want the test to propose a winner and wait for your approval." },
  ],
  claims: [
    {
      dimension: "A/B tests of product shelves",
      vendor: { value: "not-documented", note: "The page we read does not say whether recommendation shelves can be tested. It lists Rebuy and Constructor among its integrations.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.shelfTests,
    },
    {
      dimension: "Product shelves to test",
      vendor: { value: "not-documented", note: "Shoplift tests changes to your store; the pages we read do not describe building shelves.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Theme and template tests",
      vendor: { value: "yes", note: "Theme, template and split URL tests, from the Core plan, including custom and Theme Store themes.", source: S.pricing, observedAt: D },
      peakhour: unknownNote("Peakhour's approved claim covers shelf tests only, so nothing is claimed for theme or template tests."),
    },
    {
      dimension: "Price tests",
      vendor: { value: "yes", note: "Price testing for product prices and Recharge subscription prices, on the Advanced plan and above.", source: S.pricing, observedAt: D },
      peakhour: unknownNote("Peakhour's approved claim covers shelf tests only, so nothing is claimed for price tests."),
    },
    {
      dimension: "Which shelves can be compared",
      vendor: { value: "not-documented", note: "It lists product pages, collections, landing pages, cart, search and navigation as targets; the page does not set other limits.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.shelfLimit,
    },
    {
      dimension: "Winner proposed for your approval",
      vendor: { value: "partial", note: "Core plans can apply a winner in one click, below a monthly visitor limit. We did not find an approval step described.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_W3B.winnerForApproval,
    },
    {
      dimension: "Saying when there is not enough data",
      vendor: { value: "yes", note: "\"Shoplift reads results probabilistically\" and \"Most tests never reach significance.\" It reports the chance a variant wins and a range for the lift.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.notEnoughData,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "yes", note: "\"Make the change directly in the Shopify Theme Editor, and go live without a developer.\"", source: S.home, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Core", price: "$99 per month, or $74 per month charged annually", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Advanced", price: "$299 per month", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Pro, annual plan only", price: "$699 per month, charged annually", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Shoplift", bestFor: "Stores that want to test whole themes, page templates, carts and prices, with probabilistic results and segmenting on the higher plans. It tests far more than Peakhour does." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want to compare two shelf strategies in the same spot and have the winner proposed for their approval." },
  ],
  limitations: [
    "We read only Shoplift's own site and pricing page. A feature they do not document is marked Not documented, which is not the same as No.",
    "Its pricing page shows a bare $ with no currency code or region; we record it as shown. Its visitor limit for Core reads 50k on one view and 100k on another, so we do not state one. Plans and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Shoplift alternative for Shopify?", a: "Peakhour is a narrower option: shelf tests only, with the winner proposed for your approval. For theme, template or price tests, read Shoplift's own pages first." },
    { q: "Where does this information come from?", a: "Only from Shoplift's own site and pricing page, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
