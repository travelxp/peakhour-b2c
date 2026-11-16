import { PEAKHOUR } from "./peakhour";
import { pending } from "./peakhour";
import { PEAKHOUR_W3A } from "./peakhour-w3a";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  pricing: { href: "https://octaneai.com/pricing", label: "Octane AI pricing" },
  listing: { href: "https://apps.shopify.com/octane-ai-quiz-personalization", label: "Octane AI on the Shopify App Store" },
};

export const OCTANE_AI = {
  slug: "octane-ai" as const,
  pageId: "shopify.compare.octane.ai",
  relatedIds: ["shopify", "shopify.features.product.finder", "shopify.features.ai.shopping.assistant", "pricing"],
  name: "Octane AI",
  url: "https://octaneai.com/",
  category: "Quiz and product finder app for Shopify",
  observedAt: D,
  title: "Peakhour vs Octane AI for Shopify product finders",
  description: "Peakhour Find my match compared with the Octane AI quiz maker on Shopify: building quizzes, results, tests, setup and pricing, each sourced and dated.",
  h1: "Peakhour vs Octane AI: product finders on Shopify",
  directAnswer:
    "Octane AI is a dedicated quiz maker: you design the quiz, it explains each recommended product on a results page, and it syncs answers to tools such as Klaviyo. Peakhour's Find my match is part of its shopping assistant: shoppers answer a few quick questions made from your own product attributes and price range, and get a shortlist. It is not a separate quiz builder. If you want to design and test your own quizzes, Octane documents far more. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "A designed quiz", body: "You want to write your own questions, branding and result logic." },
    { title: "A quick shortlist from your catalogue", body: "You want shoppers to answer a few questions and see matching products." },
    { title: "Quiz answers in your marketing tools", body: "You want answers synced to email and SMS tools." },
    { title: "One assistant for questions and matching", body: "You want a chat assistant and a finder in the same place." },
  ],
  claims: [
    {
      dimension: "A shortlist from a few questions",
      vendor: { value: "yes", note: "Its listing describes personalised product recommendations that explain why each product fits.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3A.findMyMatch,
    },
    {
      dimension: "Build your own quiz with your own questions",
      vendor: { value: "yes", note: "A drag-and-drop editor and an AI quiz builder where you describe the quiz.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3A.noQuizBuilder,
    },
    {
      dimension: "Questions drawn from your own product attributes",
      vendor: { value: "not-documented", note: "The pages we read describe building a quiz yourself or with AI. They do not say questions are generated from your catalogue's attributes.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR_W3A.questionsFromCatalogue,
    },
    {
      dimension: "AI shopping assistant that chats with shoppers",
      vendor: { value: "not-documented", note: "The pages we read describe quizzes, not a chat assistant.", source: S.listing, observedAt: D },
      peakhour: PEAKHOUR.catalogueAnswers,
    },
    {
      dimension: "A results page that explains each pick",
      vendor: { value: "yes", note: "A results page that explains every pick, and a shareable results page on its pricing page.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "A/B tests of the quiz",
      vendor: { value: "yes", note: "Analytics and A/B tests are listed; its pricing page places A/B testing on the Plus plan.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Answers synced to email and SMS tools",
      vendor: { value: "yes", note: "Klaviyo and Shopify sync on Basic; Zapier, Postscript and others are listed.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "partial", note: "A drag-and-drop editor and an AI builder are listed. The pages we read do not use the term no-code.", source: S.listing, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Basic, 400 credits, up to 2 quizzes", price: "$50 per month, or $43 per month billed yearly; 14-day trial", currency: "USD", region: "Octane AI pricing page; region not stated", observedAt: D, source: S.pricing },
      { plan: "Plus, 2,200 credits, unlimited quizzes", price: "$200 per month, or $170 per month billed yearly", currency: "USD", region: "Octane AI pricing page; region not stated", observedAt: D, source: S.pricing },
      { plan: "Enterprise and Unlimited, 7,250+ credits", price: "From $500 per month, or $425 per month billed yearly", currency: "USD", region: "Octane AI pricing page; region not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Octane AI", bestFor: "Stores that want to design branded quizzes, test them, explain each pick on a results page and send answers to Klaviyo or other tools." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want a quick Find my match shortlist made from their own catalogue, next to a shopping assistant that answers from that catalogue, without building a quiz." },
  ],
  limitations: [
    "We read only Octane AI's own pricing page and its Shopify App Store listing. A feature a page does not document is marked Not documented, which is not the same as No.",
    "One credit is one quiz start, so cost follows how many shoppers start a quiz. The listing showed INR estimates for a viewer in India, which we do not repeat as the price. Plans and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there an Octane AI alternative for Shopify?", a: "Peakhour is one option if you want a quick Find my match shortlist inside its shopping assistant. If you want to design and test your own quizzes, read Octane AI's own pages first." },
    { q: "Where does this information come from?", a: "Only from Octane AI's own pricing page and Shopify App Store listing, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
