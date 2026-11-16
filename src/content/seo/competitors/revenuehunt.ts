import { PEAKHOUR, pending } from "./peakhour";
import { PEAKHOUR_W3A } from "./peakhour-w3a";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  pricing: { href: "https://revenuehunt.com/pricing/", label: "RevenueHunt pricing" },
  quiz: { href: "https://revenuehunt.com/product-recommendation-quiz-shopify/", label: "RevenueHunt product recommendation quiz" },
  listing: { href: "https://apps.shopify.com/product-recommendation-quiz-revenuehunt", label: "RevenueHunt on the Shopify App Store" },
};

export const REVENUEHUNT = {
  slug: "revenuehunt" as const,
  pageId: "shopify.compare.revenuehunt",
  relatedIds: ["shopify", "shopify.features.product.finder", "shopify.features.ai.shopping.assistant", "pricing"],
  name: "RevenueHunt",
  url: "https://revenuehunt.com/",
  category: "Product recommendation quiz app for Shopify",
  observedAt: D,
  title: "Peakhour vs RevenueHunt for Shopify product finders",
  description: "Peakhour Find my match compared with the RevenueHunt product quiz on Shopify: building quizzes, results, setup and pricing, each sourced and dated.",
  h1: "Peakhour vs RevenueHunt: product finders on Shopify",
  directAnswer:
    "RevenueHunt is a dedicated product quiz builder: you pick a template, write the questions, link answers to products and publish it as a page, popup or embed, at no charge to start. Peakhour's Find my match is part of its shopping assistant: shoppers answer a few quick questions made from your own product attributes and price range, and get a shortlist. It is not a separate quiz builder. If you want to design your own quizzes, RevenueHunt documents far more. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "A designed quiz", body: "You want to write your own questions and link each answer to products." },
    { title: "A quick shortlist from your catalogue", body: "You want shoppers to answer a few questions and see matching products." },
    { title: "A free place to start", body: "You want to try a quiz before paying." },
    { title: "One assistant for questions and matching", body: "You want a chat assistant and a finder in the same place." },
  ],
  claims: [
    {
      dimension: "A shortlist from a few questions",
      vendor: { value: "yes", note: "You link answer choices to products or collections, and shoppers get recommendations.", source: S.quiz, observedAt: D },
      peakhour: PEAKHOUR_W3A.findMyMatch,
    },
    {
      dimension: "Build your own quiz with your own questions",
      vendor: { value: "yes", note: "Templates, conditional logic and an AI quiz builder are listed.", source: S.quiz, observedAt: D },
      peakhour: PEAKHOUR_W3A.noQuizBuilder,
    },
    {
      dimension: "Questions drawn from your own product attributes",
      vendor: { value: "not-documented", note: "The pages we read have you write the questions and link answers to products. They do not say questions are generated from your catalogue's attributes.", source: S.quiz, observedAt: D },
      peakhour: PEAKHOUR_W3A.questionsFromCatalogue,
    },
    {
      dimension: "AI shopping assistant that chats with shoppers",
      vendor: { value: "not-documented", note: "The pages we read describe quizzes and an AI quiz builder, not a chat assistant for shoppers.", source: S.quiz, observedAt: D },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "A results page you can customise",
      vendor: { value: "yes", note: "Customisable quiz results pages are listed.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "A/B tests of the quiz",
      vendor: { value: "not-documented", note: "The pages we read do not mention A/B testing.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Answers synced to email and SMS tools",
      vendor: { value: "yes", note: "Klaviyo, Omnisend, webhooks and Zapier are listed on its Basic plan and above.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "yes", note: "Its pages say quizzes need no coding, and that most merchants launch in under 15 minutes.", source: S.quiz, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Free, 100 quiz responses a month", price: "Free", currency: "USD", region: "RevenueHunt pricing page; region not stated", observedAt: D, source: S.pricing },
      { plan: "Basic, 500 responses a month", price: "39 or 31 per month; the page does not label which is monthly and which is yearly", currency: "USD (stated for Enterprise only; no symbol or code on this row)", region: "RevenueHunt pricing page; region not stated", observedAt: D, source: S.pricing },
      { plan: "Pro, 1,000 responses a month", price: "99 or 79 per month; the page does not label which is monthly and which is yearly", currency: "USD (stated for Enterprise only; no symbol or code on this row)", region: "RevenueHunt pricing page; region not stated", observedAt: D, source: S.pricing },
      { plan: "Premium, 2,500 responses a month", price: "199 or 159 per month; the page does not label which is monthly and which is yearly", currency: "USD (stated for Enterprise only; no symbol or code on this row)", region: "RevenueHunt pricing page; region not stated", observedAt: D, source: S.pricing },
      { plan: "Enterprise, unlimited responses", price: "Starting at 299 per month", currency: "USD", region: "RevenueHunt pricing page; region not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "RevenueHunt", bestFor: "Stores that want to design their own quizzes from templates, with conditional logic, no charge to start and syncs to email tools." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want a quick Find my match shortlist made from their own catalogue, next to a shopping assistant that answers from that catalogue, without building a quiz." },
  ],
  limitations: [
    "We read only RevenueHunt's own pricing page, product quiz page and Shopify App Store listing. A feature a page does not document is marked Not documented, which is not the same as No.",
    "Its pricing page states USD for the Enterprise plan, shows paired amounts for the others without labelling monthly or yearly, and limits plans by quiz responses a month. The listing showed INR estimates for a viewer in India, which we do not repeat as the price. Plans and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a RevenueHunt alternative for Shopify?", a: "Peakhour is one option if you want a quick Find my match shortlist inside its shopping assistant. If you want to design your own quizzes, read RevenueHunt's own pages first." },
    { q: "Where does this information come from?", a: "Only from RevenueHunt's own pricing page, product page and Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
