import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://www.hootsuite.com/", label: "Hootsuite home page" },
  plans: { href: "https://www.hootsuite.com/plans", label: "Hootsuite plans" },
  faq: { href: "https://www.hootsuite.com/faq", label: "Hootsuite FAQ" },
};

export const HOOTSUITE: CompetitorBrief = {
  slug: "hootsuite",
  pageId: "compare.hootsuite",
  scope: "global",
  pillar: "content",
  relatedIds: ["pricing", "content"],
  name: "Hootsuite",
  url: "https://www.hootsuite.com/",
  category: "Social media management platform",
  observedAt: D,
  title: "Peakhour vs Hootsuite for social media",
  description: "Peakhour and Hootsuite compared for social publishing: networks, AI drafting, inbox, analytics, listening, approvals and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Hootsuite",
  directAnswer:
    "Hootsuite is a dedicated social media management platform: scheduling across many networks, a unified inbox, analytics, listening and team workflows. Peakhour publishes approved content to LinkedIn, X, Facebook Pages and Instagram and learns your brand voice, as one part of a wider growth product. If social media is your whole job, Hootsuite documents far more. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "Scheduling across many networks", body: "You publish to several networks, including TikTok, YouTube or Pinterest, from one calendar." },
    { title: "Answering messages in one place", body: "You want comments and messages from several networks in one inbox." },
    { title: "Listening and reporting", body: "You need trend tracking, competitor benchmarks and custom reports." },
    { title: "Posts in your own voice", body: "You want drafts that sound like your brand and a person approves." },
  ],
  claims: [
    {
      dimension: "Scheduled publishing and networks",
      vendor: { value: "yes", note: "One calendar across networks. Its FAQ lists Facebook, Instagram, X, LinkedIn, TikTok, YouTube, Threads, WhatsApp and Pinterest.", source: S.faq, observedAt: D },
      peakhour: PEAKHOUR_C.socialPublishing,
    },
    {
      dimension: "AI drafting of posts",
      vendor: { value: "yes", note: "Its plans page lists AI post and image generation.", source: S.plans, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Brand voice learned from your posts",
      vendor: { value: "not-documented", note: "Its AI page says answers are grounded in your brand's data, which is not a brand-voice claim.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_C.brandVoice,
    },
    {
      dimension: "Unified inbox for comments and messages",
      vendor: { value: "yes", note: "One inbox for public and private messages across networks; automation and AI smart replies from its Professional plan.", source: S.home, observedAt: D },
      peakhour: pending("support.channel_inbox"),
    },
    {
      dimension: "Analytics and reporting",
      vendor: { value: "yes", note: "Engagement and revenue reporting, with custom reports on its Professional plan.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Social listening",
      vendor: { value: "yes", note: "Trend tracking and discovery streams, with deeper search on higher plans.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Team approvals",
      vendor: { value: "partial", note: "Content approvals are listed from its Advanced plan.", source: S.plans, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Review monitoring",
      vendor: { value: "partial", note: "Brand review monitoring is listed under its Enterprise listening only.", source: S.plans, observedAt: D },
      peakhour: PEAKHOUR_C.reviews,
    },
  ],
  pricing: {
    rows: [
      { plan: "Standard, per user, 10 social accounts", price: "$99 per user per month, annual billing rate, 14-day free trial", currency: "USD", region: "Not stated", observedAt: D, source: S.plans },
      { plan: "Professional, per user", price: "$199 per user per month, annual billing rate, 14-day free trial", currency: "USD", region: "Not stated", observedAt: D, source: S.plans },
      { plan: "Advanced, per user", price: "Up to $399 per user per month, annual billing rate, 14-day free trial", currency: "USD", region: "Not stated", observedAt: D, source: S.plans },
      { plan: "Enterprise", price: "Not published (contact for pricing)", currency: "Not stated", region: "Not stated", observedAt: D, source: S.plans },
    ],
  },
  bestFor: [
    { vendor: "Hootsuite", bestFor: "Social teams that publish to many networks, answer messages in one inbox, and need listening, benchmarking, custom reports and approvals. It is the stronger choice if social media is your main job." },
    { vendor: "Peakhour", bestFor: "Small teams that want posts to LinkedIn, X, Facebook Pages and Instagram drafted in their own voice and published only after approval, alongside the rest of their growth work." },
  ],
  limitations: [
    "We read only Hootsuite's own public pages. Its FAQ network list reached us through a search summary of that page and is worth re-checking. A feature a page does not document is marked Not documented, which is not the same as No.",
    "Its plans page shows annual-billing rates, excludes taxes and leaves its currency footnote blank, though the prices say USD.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Hootsuite alternative for small teams?", a: "Peakhour is one option if you want approved posts published to LinkedIn, X, Facebook Pages and Instagram in your own voice. If you need many more networks, listening or a unified inbox, read Hootsuite's own pages first." },
    { q: "Where does this information come from?", a: "Only from Hootsuite's own public pages, each linked in the table with the date we read it." },
  ],
};
