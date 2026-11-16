import type { PageFamily, PageRecord, Pillar } from "./types";

/*
 * SEO-9: the integration pages, the global Presence and Content feature pages, and the two directories that list them.
 *
 * Source of truth for scope: docs/seo/EVIDENCE.md and capabilities.ts. A page is `published` + `indexable` only when
 * the audit verdict is keep/change AND every claim it makes is approved on its surface. The rest are `review`: they
 * render with the draft ribbon on dev and 404 on production, and the page says why in its copy.
 *
 * capabilityIds lists only the capabilities whose approved claim the page states; the publish gate checks each.
 */

const REVIEWED = "2026-11-15";
const OWNER = "growth";
const CTA = { label: "Join the waitlist", href: "/launch-partner", kind: "launch-partner" } as const;

type Seed = {
  pageId: string;
  family: PageFamily;
  path: string;
  parentId: string;
  pillar?: Pillar;
  capabilityIds?: string[];
  cluster: string;
  title: string;
  description: string;
  h1: string;
  status?: "published" | "review";
  relatedIds: string[];
};

function rec(s: Seed): PageRecord {
  const published = (s.status ?? "published") === "published";
  return {
    pageId: s.pageId,
    family: s.family,
    scope: "global",
    path: s.path,
    parentId: s.parentId,
    ...(s.pillar ? { primaryPillar: s.pillar } : {}),
    capabilityIds: s.capabilityIds ?? [],
    surface: "web",
    queryClusterId: s.cluster,
    editorialStatus: published ? "published" : "review",
    indexable: published,
    title: s.title,
    description: s.description,
    h1: s.h1,
    primaryCta: { ...CTA },
    owner: OWNER,
    lastReviewedAt: REVIEWED,
    relatedIds: s.relatedIds,
  };
}

const integration = (s: Omit<Seed, "family" | "parentId">): PageRecord => rec({ ...s, family: "integration", parentId: "integrations.index" });
const feature = (s: Omit<Seed, "family" | "parentId">): PageRecord => rec({ ...s, family: "feature", parentId: "features.index" });

export const SEO9_PAGES: readonly PageRecord[] = [
  // ---- directories ----
  rec({
    pageId: "integrations.index",
    family: "integration",
    path: "/integrations",
    parentId: "home",
    cluster: "integrations-directory",
    title: "Peakhour integrations: what connects today",
    description:
      "Every channel and connector Peakhour works with, grouped by what it is for, each with its status and its limits: WhatsApp, LinkedIn, X, Beehiiv and more.",
    h1: "What Peakhour connects to, and how far each one goes",
    relatedIds: ["features.index", "presence", "content", "growth", "commerce", "pricing"],
  }),
  rec({
    pageId: "features.index",
    family: "feature",
    path: "/features",
    parentId: "home",
    cluster: "features-directory",
    title: "Peakhour features for Presence and Content",
    description:
      "Google Business Profile, reviews, listing health, brand voice and social publishing: what each Peakhour feature does today, with its status and its limits.",
    h1: "Features for your Google listing and your content",
    relatedIds: ["integrations.index", "presence", "content", "pricing"],
  }),

  // ---- integrations: published ----
  integration({
    pageId: "integrations.whatsapp",
    path: "/integrations/whatsapp",
    pillar: "commerce",
    capabilityIds: ["integration.whatsapp"],
    cluster: "whatsapp-business-integration",
    title: "WhatsApp Business integration for your store | Peakhour",
    description:
      "Connect your own WhatsApp Business number to Peakhour so your assistant and team can chat with customers. Needs your own number and Meta-approved templates.",
    h1: "Connect your WhatsApp Business number to Peakhour",
    relatedIds: ["integrations.index", "commerce", "shopify", "pricing"],
  }),
  integration({
    pageId: "integrations.linkedin",
    path: "/integrations/linkedin",
    pillar: "growth",
    capabilityIds: ["integration.linkedin", "growth.linkedin_growth"],
    cluster: "linkedin-publishing-integration",
    title: "LinkedIn integration for publishing and tracking | Peakhour",
    description:
      "Connect LinkedIn to publish, manage and track posts from Peakhour. Organic content only: lead delivery from LinkedIn forms is not switched on.",
    h1: "Connect LinkedIn to Peakhour to publish and track posts",
    relatedIds: ["integrations.index", "features.social.media.content", "growth", "integrations.x"],
  }),
  integration({
    pageId: "integrations.x",
    path: "/integrations/x",
    pillar: "content",
    capabilityIds: ["integration.x", "content.social_publishing"],
    cluster: "x-twitter-publishing-integration",
    title: "X integration for posts and threads | Peakhour",
    description: "Connect X to Peakhour to publish approved posts and threads. Nothing goes out until you approve it. Included in Peakhour Suite.",
    h1: "Connect X to Peakhour to publish posts and threads",
    relatedIds: ["integrations.index", "features.social.media.content", "content", "integrations.x.ads"],
  }),
  integration({
    pageId: "integrations.beehiiv",
    path: "/integrations/beehiiv",
    pillar: "content",
    capabilityIds: ["integration.beehiiv", "content.beehiiv_newsletter"],
    cluster: "beehiiv-integration",
    title: "Beehiiv integration: newsletter drafts | Peakhour",
    description:
      "Connect Beehiiv with your API key. Peakhour imports your past posts and creates approved newsletters as Beehiiv drafts. It does not send them: you click Send.",
    h1: "Connect Beehiiv to Peakhour and get newsletter drafts",
    relatedIds: ["integrations.index", "content", "features.brand.voice", "features.index"],
  }),
  integration({
    pageId: "integrations.meta.ads",
    path: "/integrations/meta-ads",
    pillar: "growth",
    capabilityIds: ["growth.meta_ads", "growth.campaign_planning"],
    cluster: "meta-ads-integration",
    title: "Meta Ads integration: list and pause campaigns | Peakhour",
    description:
      "See your Meta campaigns, ad sets and ads with results, and pause or resume them from Peakhour. New campaigns are launched through Growth, with your approval.",
    h1: "See and pause your Meta ads from Peakhour",
    relatedIds: ["integrations.index", "growth", "integrations.facebook", "integrations.instagram"],
  }),
  integration({
    pageId: "integrations.instagram",
    path: "/integrations/instagram",
    pillar: "content",
    capabilityIds: ["integration.instagram"],
    cluster: "instagram-publishing-integration",
    title: "Instagram integration for publishing | Peakhour",
    description:
      "Publish approved images and carousels to Instagram through your Meta connection. Publishing only: no video, reels or direct messages.",
    h1: "Publish to Instagram from Peakhour",
    relatedIds: ["integrations.index", "features.social.media.content", "integrations.facebook", "content"],
  }),
  integration({
    pageId: "integrations.facebook",
    path: "/integrations/facebook-pages",
    pillar: "content",
    capabilityIds: ["integration.facebook_pages"],
    cluster: "facebook-pages-publishing-integration",
    title: "Facebook Pages integration for publishing | Peakhour",
    description: "Connect your Facebook Page and publish approved posts to it from Peakhour. Publishing only: Messenger is not available.",
    h1: "Publish to your Facebook Page from Peakhour",
    relatedIds: ["integrations.index", "features.social.media.content", "integrations.instagram", "content"],
  }),
  integration({
    pageId: "integrations.google.business.profile",
    path: "/integrations/google-business-profile",
    pillar: "presence",
    capabilityIds: ["integration.google_business_profile"],
    cluster: "google-business-profile-integration",
    title: "Google Business Profile integration (beta) | Peakhour",
    description:
      "Connect your Google Business Profile with Google sign-in so Peakhour can read your listing, reviews and customer-action figures. In beta.",
    h1: "Connect your Google Business Profile to Peakhour",
    relatedIds: [
      "integrations.index",
      "presence",
      "features.google.business.profile.management",
      "features.review.management",
      "features.local.listing.health",
    ],
  }),
  integration({
    pageId: "integrations.x.ads",
    path: "/integrations/x-ads",
    pillar: "growth",
    capabilityIds: ["growth.x_ads"],
    cluster: "x-ads-integration",
    title: "X Ads integration: create and pause campaigns | Peakhour",
    description:
      "Connect X Ads to create and pause X campaigns and see their results from Peakhour. Creating a campaign needs a funding instrument on your X Ads account.",
    h1: "Run your X Ads campaigns from Peakhour",
    relatedIds: ["integrations.index", "growth", "integrations.x", "integrations.meta.ads"],
  }),

  // ---- integrations: review (not live in production, or no approved claim) ----
  integration({
    pageId: "integrations.google.ads",
    path: "/integrations/google-ads",
    pillar: "growth",
    status: "review",
    cluster: "google-ads-integration",
    title: "Google Ads integration | Peakhour",
    description: "Peakhour's Google Ads connection: built, not yet available to production merchants. Held in review until it is switched on.",
    h1: "Connect Google Ads to Peakhour",
    relatedIds: ["integrations.index", "growth", "integrations.meta.ads"],
  }),
  integration({
    pageId: "integrations.google.search.console",
    path: "/integrations/google-search-console",
    pillar: "content",
    status: "review",
    cluster: "google-search-console-integration",
    title: "Google Search Console integration | Peakhour",
    description: "Peakhour's read-only Google Search Console connection: built, not yet available to production merchants. Held in review.",
    h1: "Connect Google Search Console to Peakhour",
    relatedIds: ["integrations.index", "content"],
  }),
  integration({
    pageId: "integrations.linkedin.ads",
    path: "/integrations/linkedin-ads",
    pillar: "growth",
    status: "review",
    cluster: "linkedin-ads-integration",
    title: "LinkedIn Ads integration | Peakhour",
    description: "Peakhour's LinkedIn Ads connection boosts a post you already published. Not yet listed for production merchants, so held in review.",
    h1: "Boost LinkedIn posts with LinkedIn Ads from Peakhour",
    relatedIds: ["integrations.index", "growth", "integrations.linkedin"],
  }),

  // ---- features: published ----
  feature({
    pageId: "features.google.business.profile.management",
    path: "/features/google-business-profile-management",
    pillar: "presence",
    capabilityIds: ["presence.gbp_management"],
    cluster: "manage-google-business-profile",
    title: "Google Business Profile management (beta) | Peakhour",
    description:
      "Prepare changes to your Google Business Profile hours, details, photos and posts. Nothing is sent to Google until an admin on your team approves it. In beta.",
    h1: "Manage your Google Business Profile from Peakhour",
    relatedIds: [
      "features.index",
      "presence",
      "integrations.google.business.profile",
      "features.review.management",
      "features.local.listing.health",
    ],
  }),
  feature({
    pageId: "features.review.management",
    path: "/features/review-management",
    pillar: "presence",
    capabilityIds: ["presence.review_management"],
    cluster: "google-review-management",
    title: "Google review management with AI drafts | Peakhour",
    description:
      "Google reviews arrive in your Inbox and AI drafts a reply that a person on your team edits and sends. There is no automatic reply.",
    h1: "Answer Google reviews faster, with a person in control",
    relatedIds: [
      "features.index",
      "presence",
      "integrations.google.business.profile",
      "features.google.business.profile.management",
      "features.local.listing.health",
    ],
  }),
  feature({
    pageId: "features.local.listing.health",
    path: "/features/local-listing-health",
    pillar: "presence",
    capabilityIds: ["presence.listing_health"],
    cluster: "local-listing-audit",
    title: "Google listing health score and alerts | Peakhour",
    description:
      "A score for how complete your Google listing is, the next fixes in order, and email alerts when you lose control of it or Google changes a detail.",
    h1: "Check how healthy your Google listing is, and what to fix next",
    relatedIds: [
      "features.index",
      "presence",
      "integrations.google.business.profile",
      "features.google.business.profile.management",
      "features.review.management",
    ],
  }),
  feature({
    pageId: "features.brand.voice",
    path: "/features/brand-voice",
    pillar: "content",
    capabilityIds: ["content.brand_voice"],
    cluster: "brand-voice-for-content",
    title: "Brand voice for AI content, learned from your posts",
    description:
      "Peakhour learns how your brand writes from your existing posts, per channel, and uses that voice when drafting. It cannot invent a voice from nothing.",
    h1: "Make every AI draft sound like your brand",
    relatedIds: ["features.index", "content", "features.social.media.content", "integrations.beehiiv", "integrations.linkedin"],
  }),
  feature({
    pageId: "features.social.media.content",
    path: "/features/social-media-content",
    pillar: "content",
    capabilityIds: ["content.social_publishing"],
    cluster: "social-media-content-creation",
    title: "Social media publishing: LinkedIn, X, Facebook, Instagram",
    description:
      "Post approved content to LinkedIn, X, Facebook Pages and Instagram at the time you scheduled it. Nothing posts without an approved plan.",
    h1: "Plan, approve and publish social posts from one place",
    relatedIds: [
      "features.index",
      "content",
      "features.brand.voice",
      "integrations.linkedin",
      "integrations.x",
      "integrations.facebook",
    ],
  }),

  // ---- features: review ----
  feature({
    pageId: "features.newsletter.writer",
    path: "/features/beehiiv-newsletter",
    pillar: "content",
    status: "review",
    cluster: "newsletter-content-generation",
    title: "Beehiiv newsletter drafts written by AI | Peakhour",
    description: "Peakhour creates a newsletter draft in Beehiiv for you to send. It does not send it. Held in review until the narrow claim is approved.",
    h1: "Get Beehiiv newsletter drafts written in your voice",
    relatedIds: ["features.index", "content", "integrations.beehiiv", "features.brand.voice"],
  }),
  feature({
    pageId: "features.ai.blog.writer",
    path: "/features/ai-blog-writer",
    pillar: "content",
    status: "review",
    cluster: "ai-blog-writer",
    title: "AI blog writer for your Shopify blog | Peakhour",
    description:
      "Peakhour drafts blog articles for your Shopify blog as hidden drafts. WordPress is not live. Held in review: it overlaps the Shopify blog page.",
    h1: "Have AI draft blog articles for your Shopify blog",
    relatedIds: ["features.index", "content", "features.brand.voice"],
  }),
];
