import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://buffer.com/", label: "Buffer home page" },
  pricing: { href: "https://buffer.com/pricing", label: "Buffer pricing" },
};

export const BUFFER: CompetitorBrief = {
  slug: "buffer",
  pageId: "compare.buffer",
  scope: "global",
  pillar: "content",
  relatedIds: ["pricing", "content"],
  name: "Buffer",
  url: "https://buffer.com/",
  category: "Social media scheduling and engagement tool",
  observedAt: D,
  title: "Peakhour vs Buffer for social media",
  description: "Peakhour and Buffer compared for social publishing: networks, AI help, inbox, analytics, approvals, newsletters and pricing, each cell sourced and dated.",
  h1: "Peakhour vs Buffer",
  directAnswer:
    "Buffer is a simple, widely used social scheduling tool with a no-charge option, many networks, an AI assistant, analytics and a community inbox. Peakhour publishes approved content to LinkedIn, X, Facebook Pages and Instagram, learns your brand voice and connects Beehiiv newsletters, as part of a wider growth product. If you need many networks or a no-charge option, Buffer is the clearer fit. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "A free or low-cost scheduler", body: "You want to schedule posts to a few channels for little or nothing." },
    { title: "Many networks", body: "You publish to networks such as TikTok, YouTube, Pinterest or Bluesky." },
    { title: "Posts in your own voice", body: "You want drafts that sound like your brand and a person approves." },
    { title: "Newsletters beside social", body: "You send a newsletter and want it next to your social posts." },
  ],
  claims: [
    {
      dimension: "Scheduled publishing and networks",
      vendor: { value: "yes", note: "Schedules to Instagram, Facebook, TikTok, LinkedIn, X, YouTube, Threads, Pinterest, Google Business Profile, Bluesky, Mastodon and Substack.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_C.socialPublishing,
    },
    {
      dimension: "AI help with posts",
      vendor: { value: "yes", note: "An AI assistant for ideas, rewrites and platform-specific posts, on all plans.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_C.brandVoice,
    },
    {
      dimension: "Brand voice learned from your posts",
      vendor: { value: "not-documented", note: "Not mentioned on its home or pricing pages.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_C.brandVoice,
    },
    {
      dimension: "Inbox for comments",
      vendor: { value: "yes", note: "A community inbox and replies to comments on all plans. Direct messages are not documented.", source: S.pricing, observedAt: D },
      peakhour: pending("support.channel_inbox"),
    },
    {
      dimension: "Analytics",
      vendor: { value: "yes", note: "Basic and in-depth reporting; history length and branded reports vary by plan.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Team approvals",
      vendor: { value: "yes", note: "Approval workflows are listed on its Team plan only.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Newsletters",
      vendor: { value: "partial", note: "Substack is a supported channel. A newsletter-sending feature is not documented.", source: S.home, observedAt: D },
      peakhour: PEAKHOUR_C.beehiiv,
    },
    {
      dimension: "No-charge option",
      vendor: { value: "yes", note: "Free forever for up to 3 channels, with 10 scheduled posts per channel.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Free, up to 3 channels", price: "Free forever", currency: "USD ($)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Essentials, per channel", price: "$5 per month per channel, or $60 per year, 14-day free trial", currency: "USD ($)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Team, per channel", price: "$10 per month per channel, or $120 per year, 14-day free trial", currency: "USD ($)", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Buffer", bestFor: "Individuals and small teams that want a simple scheduler with a real no-charge option and a long list of networks, priced per channel." },
    { vendor: "Peakhour", bestFor: "Small teams that want posts to LinkedIn, X, Facebook Pages and Instagram drafted in their own voice and published only after approval, plus Beehiiv newsletters, alongside the rest of their growth work." },
  ],
  limitations: [
    "We read only Buffer's own public home and pricing pages. A feature a page does not document is marked Not documented, which is not the same as No.",
    "Its pricing page shows a bare $ with no currency code or region, and prices are per channel. Plans and limits change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there a Buffer alternative with AI in my own voice?", a: "Peakhour is one option if you want drafts that learn your brand voice, published to LinkedIn, X, Facebook Pages and Instagram after you approve. If you need more networks or a no-charge option, read Buffer's own pages first." },
    { q: "Where does this information come from?", a: "Only from Buffer's own public pages, each linked in the table with the date we read it." },
  ],
};
