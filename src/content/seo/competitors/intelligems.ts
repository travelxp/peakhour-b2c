import { pending } from "./peakhour";
import { PEAKHOUR } from "./peakhour";
import { PEAKHOUR_W3B } from "./peakhour-cmp-w3b";
import type { CompetitorBrief } from "./types";

// CMP-W3B
const D = "2026-11-16";
const B = "https://www.intelligems.io";
const S = {
  home: { href: `${B}/`, label: "Intelligems home page" },
  pricing: { href: `${B}/pricing`, label: "Intelligems pricing" },
};
const unknownNote = (note: string) => ({ ...pending(), note });

export const INTELLIGEMS = {
  slug: "intelligems" as const,
  pageId: "shopify.compare.intelligems",
  relatedIds: ["shopify", "shopify.features.merchandising.ab.testing", "shopify.features.product.recommendations", "pricing"],
  name: "Intelligems",
  url: `${B}/`,
  category: "A/B testing for prices, shipping, content and checkout on Shopify",
  observedAt: D,
  title: "Peakhour vs Intelligems for Shopify",
  description: "Peakhour and Intelligems compared for Shopify A/B testing: what each tests, winners, setup and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Intelligems for Shopify",
  directAnswer:
    "Intelligems runs A/B tests on prices, shipping, content, checkout and post-purchase offers. Peakhour tests one thing: product shelves. It compares two shelf strategies in the same spot, says which is ahead, and proposes the winner for your approval. It does not test prices or themes, and Intelligems goes much further there. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Finding the best price", body: "You want to test product prices and keep the one that earns the most." },
    { title: "Testing shipping and checkout", body: "You want to try shipping rates, free-shipping thresholds or checkout offers." },
    { title: "Testing a product shelf", body: "You want to compare two ways of choosing the products a shelf shows." },
    { title: "Keeping control of the winner", body: "You want the test to propose a winner and wait for your approval." },
  ],
  claims: [
    {
      dimension: "A/B tests of product shelves",
      vendor: { value: "partial", note: "Recommended products can be tested at checkout and post-purchase. The page we read does not say whether shelves on product or collection pages can be tested.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.shelfTests,
    },
    {
      dimension: "Product shelves to test",
      vendor: { value: "partial", note: "It has a product recommendations feature page; we did not read it, so we record only that merchandising and recommended-product tests are listed.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR.recommendations,
    },
    {
      dimension: "Price tests",
      vendor: { value: "yes", note: "\"Find the price that maximizes profit per visitor.\" Product prices, subscription prices and multi-currency.", source: S.home, observedAt: D },
      peakhour: unknownNote("Peakhour's approved claim covers shelf tests only, so nothing is claimed for price tests."),
    },
    {
      dimension: "Shipping and checkout tests",
      vendor: { value: "yes", note: "Shipping rates and free-shipping thresholds, checkout blocks and post-purchase offers. Checkout blocks need Shopify Plus.", source: S.pricing, observedAt: D },
      peakhour: unknownNote("Peakhour's approved claim covers shelf tests only, so nothing is claimed for shipping or checkout tests."),
    },
    {
      dimension: "Theme, page and content tests",
      vendor: { value: "yes", note: "Landing pages, on-site edits, themes, templates and split URL tests.", source: S.pricing, observedAt: D },
      peakhour: unknownNote("Peakhour's approved claim covers shelf tests only, so nothing is claimed for theme or page tests."),
    },
    {
      dimension: "Which shelves can be compared",
      vendor: { value: "not-documented", note: "The pages we read do not set limits on what a test can target beyond the plan and Shopify tier.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_W3B.shelfLimit,
    },
    {
      dimension: "Winner proposed for your approval",
      vendor: { value: "not-documented", note: "The pages we read do not describe how a winner is applied. Its home page shows an example AI recommendation labelled \"94% confident\".", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_W3B.winnerForApproval,
    },
    {
      dimension: "Saying when there is not enough data",
      vendor: { value: "not-documented", note: "The pages we read do not describe the statistical method or when a test is inconclusive.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_W3B.notEnoughData,
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "yes", note: "\"Launch tests without touching code\", using Shopify templates and themes and an AI visual builder.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Build Your Own, lowest order volume", price: "From $69 per month, flat by order volume", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Unlimited, all modules, monthly billing", price: "$2,894 per month, 3 month minimum", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Unlimited, all modules, annual billing", price: "$1,279 per month", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Intelligems", bestFor: "Stores that want to test prices, shipping, checkout, post-purchase offers and whole pages, and read profit and revenue results. It tests far more than Peakhour does." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want to compare two shelf strategies in the same spot and have the winner proposed for their approval." },
  ],
  limitations: [
    "We read only Intelligems' own site, pricing page and Shopify App Store listing. A feature they do not document is marked Not documented, which is not the same as No.",
    "Its pricing page shows a bare $ with no currency code or region; we record it as shown. Plans, trials and offers change, and price tests have a separate minimum term.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there an Intelligems alternative for Shopify?", a: "Peakhour is a narrower option: shelf tests only, with the winner proposed for your approval. For price, shipping, checkout or theme tests, read Intelligems' own pages first." },
    { q: "Where does this information come from?", a: "Only from Intelligems' own site and pricing page, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
