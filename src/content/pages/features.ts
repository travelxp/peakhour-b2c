import type { FaqItem, FeatureContent, LinkItem, PlatformItem, StepItem } from "@/components/marketing/seo/content-types";
import { closingFor, crumbsFor, evidenceOf, link, PRICING_LINK, PRICING_NOTE, webPlatform } from "./shared";

/*
 * The global Presence and Content feature pages (SEO-9). Each states only what an approved claim in
 * src/lib/seo/capabilities.ts says on the web surface, plus that capability's limits in merchant words. `claimIds`
 * names the claims a page leans on; the tests check each exists and is satisfied. Pages in `review` make no public claim.
 */

type Spec = {
  pageId: string;
  name: string;
  eyebrow: string;
  evidenceId: string;
  evidenceSurface?: "web" | "shopify";
  claimIds: string[];
  directAnswer: string;
  limitations: string[];
  platforms: PlatformItem[];
  steps: StepItem[];
  prerequisites: string[];
  approvalBoundaries: string[];
  integrations: LinkItem[];
  faqs: FaqItem[];
  related: LinkItem[];
  closingSubject: string;
};

function build(s: Spec): { content: FeatureContent; claimIds: string[] } {
  const ev = evidenceOf(s.evidenceId, s.evidenceSurface ?? "web");
  return {
    claimIds: s.claimIds,
    content: {
      crumbs: crumbsFor("features.index", "Features", s.name, s.pageId),
      eyebrow: s.eyebrow,
      directAnswer: s.directAnswer,
      secondaryCta: { label: "See how it works", href: "#workflow" },
      status: ev.status,
      limitations: s.limitations,
      verifiedAt: ev.verifiedAt,
      platforms: s.platforms,
      steps: s.steps,
      prerequisites: s.prerequisites,
      approvalBoundaries: s.approvalBoundaries,
      integrations: s.integrations,
      pricingNote: PRICING_NOTE,
      faqs: s.faqs,
      related: [...s.related, PRICING_LINK()].slice(0, 6),
      closing: closingFor(s.closingSubject),
    },
  };
}

const PRESENCE = link("presence", "Peakhour Presence", "Own how you show up on Google.");
const CONTENT = link("content", "Peakhour Content", "AI writers that publish in your voice.");
const GBP_INTEGRATION = link("integrations.google.business.profile", "Google Business Profile integration", "The connection these features use. In beta.");
const ALL_FEATURES = link("features.index", "All Presence and Content features", "What else Peakhour does.");

export const FEATURE_CONTENT: Record<string, { content: FeatureContent; claimIds: string[] }> = {
  "features.google.business.profile.management": build({
    pageId: "features.google.business.profile.management",
    name: "Google Business Profile management",
    eyebrow: "Presence · Beta",
    evidenceId: "presence.gbp_management",
    claimIds: ["presence.gbp_management.prepare_and_approve"],
    directAnswer:
      "Peakhour lets you prepare changes to your Google Business Profile hours, details, photos and posts from one place. Nothing is sent to Google until an admin on your team approves it. This feature is in beta.",
    limitations: [
      "In beta: changes reach Google only once Peakhour has switched sending on for Google.",
      "Nothing is sent until an admin on your team approves it. To undo a change you make a new one, and it needs its own approval.",
      "Changing your name, address or main category can make Google ask you to verify the listing again.",
      "You make edits on the web. Shopify and WordPress show the listing read-only.",
    ],
    platforms: [webPlatform("presence.gbp_management", "Prepare, approve and undo changes to your listing from the Peakhour dashboard.")],
    steps: [
      { title: "Connect your listing", body: "Sign in with Google so Peakhour can read your Business Profile." },
      { title: "Prepare a change", body: "Edit your hours, details or photos, or write a post. It waits as a prepared change." },
      { title: "An admin approves it", body: "Only then is the change sent to Google." },
      { title: "Undo with a new change", body: "To reverse a change, prepare a new one. It needs its own approval." },
    ],
    prerequisites: ["A Google Business Profile for your business", "A Google sign-in that manages the listing", "An admin on your team to approve changes"],
    approvalBoundaries: [
      "Nothing is sent to Google until an admin approves it",
      "Undo is a new change with its own approval",
      "Name, address and main category changes may need Google to verify you again",
    ],
    integrations: [GBP_INTEGRATION],
    faqs: [
      { q: "Does Peakhour change my Google listing by itself?", a: "No. It prepares changes. Nothing is sent to Google until an admin on your team approves it." },
      { q: "Is it ready for everyone?", a: "It is in beta. Changes reach Google only once Peakhour has switched sending on for Google." },
      { q: "How do I undo a change?", a: "You prepare a new change that reverses it. It needs its own approval." },
    ],
    related: [PRESENCE, link("features.review.management", "Review management", "AI drafts, a person sends."), link("features.local.listing.health", "Listing health", "Your score and what to fix next."), ALL_FEATURES],
    closingSubject: "Google Business Profile management",
  }),

  "features.review.management": build({
    pageId: "features.review.management",
    name: "Review management",
    eyebrow: "Presence",
    evidenceId: "presence.review_management",
    claimIds: ["presence.review_management.draft_then_send"],
    directAnswer:
      "Google reviews appear in your Inbox, and Peakhour's AI drafts a reply that a person on your team edits and sends to Google. There is no automatic reply: nothing is posted until someone presses Send.",
    limitations: [
      "There is no automatic reply. A person reads the AI draft and presses Send.",
      "New reviews arrive on an hourly sync.",
      "Each AI draft uses Peaks.",
      "It covers Google reviews only.",
    ],
    platforms: [webPlatform("presence.review_management", "Read reviews in your Inbox, edit the AI draft and send it to Google.")],
    steps: [
      { title: "Connect your listing", body: "Sign in with Google so your reviews can be read." },
      { title: "Reviews arrive", body: "New Google reviews appear in your Inbox on an hourly sync." },
      { title: "AI drafts a reply", body: "Peakhour writes a draft for you to read." },
      { title: "A person sends it", body: "Edit the draft if you want, then press Send." },
    ],
    prerequisites: ["A connected Google Business Profile", "A person on your team to read and send each reply", "Peaks for each AI draft"],
    approvalBoundaries: ["AI never posts a reply by itself", "A person reads every draft and presses Send"],
    integrations: [GBP_INTEGRATION],
    faqs: [
      { q: "Does Peakhour reply to reviews automatically?", a: "No. A person reads the AI draft and presses Send." },
      { q: "Which reviews does it cover?", a: "Google reviews." },
      { q: "How quickly do new reviews show up?", a: "They arrive on an hourly sync." },
    ],
    related: [PRESENCE, link("features.google.business.profile.management", "Google Business Profile management", "Prepare listing changes for approval."), link("features.local.listing.health", "Listing health", "Your score and what to fix next."), ALL_FEATURES],
    closingSubject: "review management",
  }),

  "features.local.listing.health": build({
    pageId: "features.local.listing.health",
    name: "Listing health",
    eyebrow: "Presence",
    evidenceId: "presence.listing_health",
    claimIds: ["presence.listing_health.score_and_alerts"],
    directAnswer:
      "Peakhour scores how complete your Google listing is and lists the next fixes in order. It emails you at once if you lose control of the listing, and sends a daily email when Google changes a detail, flags a duplicate or your calls and visits drop.",
    limitations: [
      "The score says what a customer sees or cannot do. It says nothing about how Google ranks you.",
      "Alerts come by email and in the app, not WhatsApp.",
      "Only losing control of the listing is emailed at once. The rest arrive in a daily email.",
    ],
    platforms: [webPlatform("presence.listing_health", "See your score, the next fixes and your alerts in the Peakhour dashboard.")],
    steps: [
      { title: "Connect your listing", body: "Sign in with Google so Peakhour can read your Business Profile." },
      { title: "See your score", body: "Peakhour scores how complete the listing is." },
      { title: "Work through the fixes", body: "The next fixes are listed in order, most useful first." },
      { title: "Get alerts", body: "You are emailed if you lose control of the listing, and daily when something changes." },
    ],
    prerequisites: ["A connected Google Business Profile (the connection is in beta)", "An email address for alerts"],
    approvalBoundaries: [
      "It tells you what to fix. It does not rank you or promise a ranking",
      "Alerts reach you by email and in the app, not by WhatsApp",
    ],
    integrations: [GBP_INTEGRATION],
    faqs: [
      { q: "Does the score tell me how I rank on Google?", a: "No. It says what a customer sees or cannot do. It says nothing about how Google ranks you." },
      { q: "How will I hear about a problem?", a: "By email and in the app. Losing control of the listing is emailed at once. Other changes arrive in a daily email." },
      { q: "Do alerts come by WhatsApp?", a: "No. Alerts come by email and in the app." },
    ],
    related: [PRESENCE, link("features.google.business.profile.management", "Google Business Profile management", "Prepare listing changes for approval."), link("features.review.management", "Review management", "AI drafts, a person sends."), ALL_FEATURES],
    closingSubject: "listing health",
  }),

  "features.brand.voice": build({
    pageId: "features.brand.voice",
    name: "Brand voice",
    eyebrow: "Content",
    evidenceId: "content.brand_voice",
    claimIds: ["content.brand_voice.learns_your_voice"],
    directAnswer:
      "Peakhour learns how your brand writes from your existing posts, per channel, and uses that voice when drafting. It keeps adjusting from what you approve or reject. It cannot invent a voice from nothing: it needs real posts to learn from.",
    limitations: [
      "A voice card is learned from your real posts. One cannot be invented from nothing.",
      "The voice used for campaign headlines is separate from your brand voice card.",
      "On Shopify you can edit an existing card, but not create one.",
    ],
    platforms: [
      webPlatform("content.brand_voice", "Create and edit a voice card per channel, learned from your posts."),
      { surface: "shopify", label: "Shopify admin", status: evidenceOf("content.brand_voice", "shopify").status, body: "Edit the tone, phrases to avoid and sample lines of an existing card." , limitations: ["You cannot create a card there"] },
    ],
    steps: [
      { title: "Peakhour reads your posts", body: "It learns how you write on each channel from posts you have already published." },
      { title: "You get a voice card", body: "The card sums up your tone, the phrases you avoid and sample lines." },
      { title: "Drafts use it", body: "New drafts are written in that voice." },
      { title: "It keeps adjusting", body: "What you approve or reject teaches it more." },
    ],
    prerequisites: ["Posts you have already published, for Peakhour to learn from"],
    approvalBoundaries: ["You approve or reject every draft", "Peakhour adjusts the voice from what you approve or reject"],
    integrations: [link("integrations.linkedin", "LinkedIn integration", "Posts Peakhour can learn from."), link("integrations.beehiiv", "Beehiiv integration", "Past newsletters Peakhour can learn from.")],
    faqs: [
      { q: "Can Peakhour create a voice if I have not posted anything?", a: "No. A voice card is learned from your real posts. It cannot be invented from nothing." },
      { q: "Is there one voice, or one per channel?", a: "Peakhour learns your voice per channel." },
      { q: "Can I edit it?", a: "Yes. On Shopify you can edit the tone, phrases to avoid and sample lines of an existing card." },
    ],
    related: [CONTENT, link("features.social.media.content", "Social media publishing", "Where your voice is put to work."), link("integrations.beehiiv", "Beehiiv integration", "Newsletter drafts."), ALL_FEATURES],
    closingSubject: "your brand voice",
  }),

  "features.social.media.content": build({
    pageId: "features.social.media.content",
    name: "Social media publishing",
    eyebrow: "Content",
    evidenceId: "content.social_publishing",
    claimIds: ["content.social_publishing.four_networks"],
    directAnswer:
      "Peakhour posts approved content to LinkedIn (personal and company pages), X (including threads), Facebook Pages and Instagram (images and carousels) at the time you scheduled it. Nothing posts without an approved plan.",
    limitations: [
      "Instagram needs an image, or a carousel of 2 to 10 images. No video, reels or text-only posts.",
      "Threads is not available.",
      "Nothing posts without an approved plan.",
    ],
    platforms: [webPlatform("content.social_publishing", "Plan, approve and schedule posts for all four networks from the Peakhour dashboard.")],
    steps: [
      { title: "Connect your networks", body: "Connect LinkedIn, X, Facebook and Instagram from Integrations." },
      { title: "Draft in your voice", body: "Peakhour drafts posts for each network." },
      { title: "Approve a plan", body: "You approve the plan, with the time each post should go out." },
      { title: "Peakhour posts on schedule", body: "Each post is published at the time you set." },
    ],
    prerequisites: ["At least one network connected", "An image for Instagram posts"],
    approvalBoundaries: ["Nothing posts without an approved plan", "Each post goes out at the time you scheduled"],
    integrations: [
      link("integrations.linkedin", "LinkedIn", "Personal and company pages."),
      link("integrations.x", "X", "Posts and threads."),
      link("integrations.facebook", "Facebook Pages", "Publishing only."),
      link("integrations.instagram", "Instagram", "Images and carousels."),
    ],
    faqs: [
      { q: "Which networks can Peakhour post to?", a: "LinkedIn (personal and company pages), X, Facebook Pages and Instagram." },
      { q: "Can it post video to Instagram?", a: "No. An Instagram post needs an image, or a carousel of 2 to 10 images." },
      { q: "Does it post to Threads?", a: "No. Threads is not available." },
    ],
    related: [CONTENT, link("features.brand.voice", "Brand voice", "Make drafts sound like you."), ALL_FEATURES],
    closingSubject: "social publishing",
  }),

  // ---- held in review ----
  "features.newsletter.writer": build({
    pageId: "features.newsletter.writer",
    name: "Beehiiv newsletter drafts",
    eyebrow: "Content",
    evidenceId: "content.beehiiv_newsletter",
    claimIds: [],
    directAnswer:
      "Peakhour connects to Beehiiv, imports your past posts every hour, and sends approved newsletters to Beehiiv as drafts for you to send. It does not send them. Beehiiv is the only newsletter tool available.",
    limitations: ["It creates a draft in Beehiiv. You click Send in Beehiiv.", "Substack, Kit, Mailchimp and Ghost are not available."],
    platforms: [webPlatform("content.beehiiv_newsletter", "Approve a newsletter in Peakhour and find it as a draft in Beehiiv.")],
    steps: [
      { title: "Connect Beehiiv", body: "Add your Beehiiv API key under Integrations." },
      { title: "Approve a newsletter", body: "Peakhour drafts it in your voice for you to approve." },
      { title: "Send it from Beehiiv", body: "Open the draft in Beehiiv and press Send yourself." },
    ],
    prerequisites: ["A Beehiiv publication and an API key"],
    approvalBoundaries: ["Peakhour never sends the newsletter", "You send it from Beehiiv"],
    integrations: [link("integrations.beehiiv", "Beehiiv integration", "The connection this uses.")],
    faqs: [{ q: "Does Peakhour send my newsletter?", a: "No. It creates a draft in Beehiiv. You click Send there." }],
    related: [CONTENT, link("features.brand.voice", "Brand voice", "How drafts learn your voice."), link("integrations.beehiiv", "Beehiiv integration", "The connection this uses.")],
    closingSubject: "Beehiiv drafts",
  }),

  "features.ai.blog.writer": build({
    pageId: "features.ai.blog.writer",
    name: "AI blog writer",
    eyebrow: "Content",
    evidenceId: "content.ai_blog_writer",
    evidenceSurface: "shopify",
    claimIds: [],
    directAnswer:
      "On Shopify, Peakhour drafts blog articles and saves them to your Shopify blog as hidden drafts, which you publish when you are ready. The WordPress version is built but not live.",
    limitations: [
      "Articles land as hidden drafts unless you choose to publish.",
      "Repurposing a blog post is off by default for most stores.",
      "Articles go to one blog (News by default).",
      "WordPress is not live yet.",
    ],
    platforms: [
      { surface: "shopify", label: "Shopify blog", status: evidenceOf("content.ai_blog_writer", "shopify").status, body: "Drafts land in your Shopify blog, hidden until you publish." },
      { surface: "wordpress", label: "WordPress", status: evidenceOf("content.ai_blog_writer", "wordpress").status, body: "Built, but not available yet." },
    ],
    steps: [
      { title: "Pick a topic", body: "Choose what to write about, or accept a suggestion." },
      { title: "Peakhour drafts the article", body: "It writes in your brand voice." },
      { title: "A hidden draft appears", body: "The article waits in your Shopify blog until you publish it." },
    ],
    prerequisites: ["A Shopify store with a blog"],
    approvalBoundaries: ["Articles stay hidden until you choose to publish"],
    integrations: [link("shopify", "Peakhour for Shopify", "The app this runs in.")],
    faqs: [{ q: "Does it work with WordPress?", a: "Not yet. WordPress is built but not live." }],
    related: [CONTENT, link("features.brand.voice", "Brand voice", "How drafts learn your voice."), link("shopify", "Peakhour for Shopify", "The app this runs in.")],
    closingSubject: "the AI blog writer",
  }),
};
