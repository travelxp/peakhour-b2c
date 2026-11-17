import type { DirectoryContent, DirectoryItem } from "@/components/marketing/seo/content-types";
import { getPage } from "@/lib/seo/pages";
import { pathFor } from "@/lib/seo/resolve";
import { isPublishable } from "@/lib/seo/publish";
import { closingFor, evidenceOf, link, PRICING_LINK } from "./shared";

/*
 * The /integrations and /features directories. They list only pages that are publishable, so a page held in review
 * (or one whose claim stops being satisfied) never appears in a public list, and the list cannot drift from the registry.
 */

type Entry = { pageId: string; title: string; body: string; pillar: string; evidenceId: string };

const PILLAR_ORDER = ["Presence", "Commerce", "Content", "Growth"];

const INTEGRATIONS: Entry[] = [
  { pageId: "integrations.google.business.profile", title: "Google Business Profile", body: "Read your listing, reviews and customer-action figures.", pillar: "Presence", evidenceId: "integration.google_business_profile" },
  { pageId: "integrations.whatsapp", title: "WhatsApp", body: "Your own WhatsApp Business number, for your assistant and your team.", pillar: "Commerce", evidenceId: "integration.whatsapp" },
  { pageId: "integrations.x", title: "X", body: "Publish posts and threads at the time you scheduled.", pillar: "Content", evidenceId: "integration.x" },
  { pageId: "integrations.beehiiv", title: "Beehiiv", body: "Newsletter drafts sent to Beehiiv. You press Send.", pillar: "Content", evidenceId: "integration.beehiiv" },
  { pageId: "integrations.facebook", title: "Facebook Pages", body: "Publish approved posts to your Page. Publishing only.", pillar: "Content", evidenceId: "integration.facebook_pages" },
  { pageId: "integrations.instagram", title: "Instagram", body: "Publish images and carousels. Never direct messages.", pillar: "Content", evidenceId: "integration.instagram" },
  { pageId: "integrations.linkedin", title: "LinkedIn", body: "Publish, manage and track organic posts.", pillar: "Growth", evidenceId: "integration.linkedin" },
  { pageId: "integrations.meta.ads", title: "Meta Ads", body: "List your campaigns and pause or resume them.", pillar: "Growth", evidenceId: "growth.meta_ads" },
  { pageId: "integrations.x.ads", title: "X Ads", body: "Create and pause X campaigns and see results.", pillar: "Growth", evidenceId: "growth.x_ads" },
];

const FEATURES: Entry[] = [
  { pageId: "features.google.business.profile.management", title: "Google Business Profile management", body: "Prepare listing changes. Nothing is sent until an admin approves.", pillar: "Presence", evidenceId: "presence.gbp_management" },
  { pageId: "features.review.management", title: "Review management", body: "AI drafts a reply to a Google review. A person sends it.", pillar: "Presence", evidenceId: "presence.review_management" },
  { pageId: "features.local.listing.health", title: "Listing health", body: "A score for your Google listing, the next fixes, and alerts.", pillar: "Presence", evidenceId: "presence.listing_health" },
  { pageId: "features.brand.voice", title: "Brand voice", body: "Drafts written in the voice Peakhour learned from your posts.", pillar: "Content", evidenceId: "content.brand_voice" },
  { pageId: "features.social.media.content", title: "Social media publishing", body: "LinkedIn, X, Facebook Pages and Instagram, on your schedule.", pillar: "Content", evidenceId: "content.social_publishing" },
];

function items(entries: Entry[]): DirectoryItem[] {
  return entries
    .filter((e) => isPublishable(getPage(e.pageId)))
    .map((e) => ({ title: e.title, body: e.body, href: pathFor(e.pageId), status: evidenceOf(e.evidenceId).status, pillar: e.pillar }))
    .sort((a, b) => PILLAR_ORDER.indexOf(a.pillar!) - PILLAR_ORDER.indexOf(b.pillar!));
}

export function integrationsDirectory(): DirectoryContent {
  return {
    crumbs: [{ label: "Home", href: "/" }, { label: "Integrations", href: pathFor("integrations.index") }],
    eyebrow: "Integrations",
    directAnswer:
      "Each page says what a connection does and does not do. Beta means still being finished.",
    secondaryCta: { label: "See the features they power", href: pathFor("features.index") },
    items: items(INTEGRATIONS),
    listTitle: "The connections",
    faqs: [
      { q: "What is the difference between a feature and an integration?", a: "An integration is a connection to another service, such as WhatsApp or LinkedIn. A feature is something Peakhour does with it, such as publishing posts or answering reviews." },
      { q: "Why is a connection I use not listed?", a: "A connection is listed only once it is switched on for merchants and we can say exactly what it does." },
    ],
    related: [
      link("features.index", "Presence and Content features", "What Peakhour does with these connections."),
      link("presence", "Peakhour Presence", "Prepare Google listing changes and approve each one."),
      link("content", "Peakhour Content", "AI writers that publish in your voice."),
      link("growth", "Peakhour Growth", "Ads and LinkedIn, with your approval."),
      link("commerce", "Peakhour Commerce", "The AI assistant that sells on WhatsApp."),
      PRICING_LINK(),
    ],
    closing: closingFor("Peakhour"),
  };
}

export function featuresDirectory(): DirectoryContent {
  return {
    crumbs: [{ label: "Home", href: "/" }, { label: "Features", href: pathFor("features.index") }],
    eyebrow: "Features",
    directAnswer:
      "Peakhour features for your Google listing and your content, each with its status. Peakhour drafts and prepares; a person on your team approves or sends.",
    secondaryCta: { label: "See the integrations", href: pathFor("integrations.index") },
    items: items(FEATURES),
    listTitle: "The features",
    faqs: [
      { q: "Does Peakhour act without my approval?", a: "No. Listing changes need an admin's approval, review replies are sent by a person, and nothing posts without an approved plan." },
      { q: "Where are the other features?", a: "This list covers Presence and Content. Commerce features are on the Commerce page and in the Shopify features list, and Growth features are on the Growth page." },
    ],
    related: [
      link("integrations.index", "Integrations", "The connections these features use."),
      link("commerce", "Commerce features", "The shopping assistant, shelves and COD confirmation."),
      link("growth", "Growth features", "Strategy, Meta and X ads, and Peakhour Summit."),
      link("shopify.features", "Shopify features", "Every feature of the Peakhour Shopify app."),
      link("presence", "Peakhour Presence", "Prepare Google listing changes and approve each one."),
      link("content", "Peakhour Content", "AI writers that publish in your voice."),
    ],
    closing: closingFor("Peakhour"),
  };
}
