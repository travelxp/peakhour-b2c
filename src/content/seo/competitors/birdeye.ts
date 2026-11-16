import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://birdeye.com/", label: "Birdeye home page" },
  pricing: { href: "https://www.birdeye.com/pricing", label: "Birdeye pricing" },
  reviews: { href: "https://www.birdeye.com/reviews", label: "Birdeye reviews" },
  listings: { href: "https://birdeye.com/listings/", label: "Birdeye listings" },
  messaging: { href: "https://birdeye.com/messaging/", label: "Birdeye messaging" },
  google: { href: "https://birdeye.com/blog/birdeye-google-partnership-integrations/", label: "Birdeye and Google" },
};

export const BIRDEYE = {
  slug: "birdeye" as const,
  pageId: "compare.birdeye",
  scope: "global",
  pillar: "presence",
  relatedIds: ["pricing", "presence"],
  name: "Birdeye",
  url: "https://birdeye.com/",
  category: "Reviews, listings and messaging platform for local and multi-location businesses",
  observedAt: D,
  title: "Peakhour vs Birdeye for local presence",
  description: "Peakhour and Birdeye compared for reviews and listings: monitoring, AI replies, directories, Google profile, messaging and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Birdeye",
  directAnswer:
    "Birdeye is a mature platform for multi-location businesses: reviews from many sites, review requests, listings across directories, messaging, payments and appointments. Peakhour brings Google reviews in with AI-drafted replies a person sends, scores your Google listing, and prepares Google Business Profile changes for approval. Birdeye is far broader; Peakhour is focused on Google. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Reviews from many sites", body: "You want ratings and reviews from several sites in one place." },
    { title: "Listings across directories", body: "You want your business details kept right across more than Google." },
    { title: "Texting and webchat with customers", body: "You want messaging, payments and appointments from one tool." },
    { title: "Google reviews and your Google listing", body: "Google is where your customers find you and you want replies drafted for a person to send." },
  ],
  claims: [
    {
      dimension: "Reviews in one place, with AI-drafted replies",
      vendor: { value: "partial", note: "It promises every rating and review from every site in one place, without naming the sites, and a review response agent that posts on its own or holds for approval.", source: S.reviews, observedAt: D },
      peakhour: PEAKHOUR_C.reviews,
    },
    {
      dimension: "Listings across directories",
      vendor: { value: "partial", note: "Google, Facebook, Apple, Yelp and Bing are native integrations, with approval required by default.", source: S.listings, observedAt: D },
      peakhour: PEAKHOUR_C.listingHealth,
    },
    {
      dimension: "Google Business Profile management",
      vendor: { value: "yes", note: "Create, edit, update and monitor Profiles from one dashboard.", source: S.google, observedAt: D },
      peakhour: PEAKHOUR_C.gbpManagement,
    },
    {
      dimension: "Messaging and webchat inbox",
      vendor: { value: "partial", note: "Replies to webchat, text, Facebook, Instagram, email and voicemail. WhatsApp is not documented on the page we read.", source: S.messaging, observedAt: D },
      peakhour: pending("support.channel_inbox"),
    },
    {
      dimension: "Review request campaigns",
      vendor: { value: "partial", note: "A review generation agent reaches out on the channel that gets the most responses. The channels are not named on the page.", source: S.reviews, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Payments and appointments",
      vendor: { value: "yes", note: "Collect payments, and schedule and confirm appointments, from messaging.", source: S.messaging, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Surveys",
      vendor: { value: "partial", note: "Text message surveys for instant feedback. NPS is not named.", source: S.messaging, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "All plans", price: "Not published (quoted per location after a form or demo)", currency: "Not stated", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Birdeye", bestFor: "Multi-location and service businesses that need reviews from many sites, listings across directories, review requests, texting, payments and appointments in one platform." },
    { vendor: "Peakhour", bestFor: "Businesses whose customers find them on Google and who want Google reviews answered by drafts a person approves, a Google listing health score, and profile changes prepared for approval." },
  ],
  limitations: [
    "We read only Birdeye's own public pages. A Birdeye support article (support.birdeye.com, article 12654747) limits AI-assisted review replies to US-based locations, as we read it. The sites it monitors, the channels it uses for review requests and WhatsApp were not confirmed on pages we read, so they are not stated here.",
    "Birdeye publishes no prices and no currency, so no price comparison is possible.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed. Peakhour's Google profile management is in beta.",
  ],
  faqs: [
    { q: "Is there a Birdeye alternative for Google reviews?", a: "Peakhour is one option if Google is where your customers find you: reviews with AI-drafted replies a person sends, and a Google listing health score. If you need many review sites or directories, read Birdeye's own pages first." },
    { q: "Where does this information come from?", a: "Only from Birdeye's own public pages, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
