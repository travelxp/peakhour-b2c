import type { FaqItem, IntegrationContent, LinkItem } from "@/components/marketing/seo/content-types";
import { closingFor, crumbsFor, evidenceOf, link, PRICING_LINK } from "./shared";

/*
 * The integration pages (SEO-9). Each states only what an approved claim in src/lib/seo/capabilities.ts says, plus
 * that capability's limits in merchant words. `claimIds` names the approved claims a page leans on; the tests check
 * each exists, belongs to a capability in the page's record, and is satisfied. A page held in `review` makes no claim.
 */

type Spec = {
  pageId: string;
  /** The crumb. */
  name: string;
  eyebrow: string;
  /** The capability whose status and verification date the page shows. */
  evidenceId: string;
  claimIds: string[];
  directAnswer: string;
  limitations: string[];
  does: string[];
  data: { name: string; why: string }[];
  steps: { title: string; body: string }[];
  faqs: FaqItem[];
  related: LinkItem[];
  closingSubject: string;
};

function build(s: Spec): { content: IntegrationContent; claimIds: string[] } {
  const ev = evidenceOf(s.evidenceId);
  return {
    claimIds: s.claimIds,
    content: {
      crumbs: crumbsFor("integrations.index", "Integrations", s.name, s.pageId),
      eyebrow: s.eyebrow,
      directAnswer: s.directAnswer,
      secondaryCta: { label: "See what it does", href: "#does" },
      status: ev.status,
      limitations: s.limitations,
      verifiedAt: ev.verifiedAt,
      does: s.does,
      data: s.data,
      steps: s.steps,
      faqs: s.faqs,
      related: [...s.related, PRICING_LINK()].slice(0, 6),
      closing: closingFor(s.closingSubject),
    },
  };
}

const HUB = (id: string, label: string, note: string) => link(id, label, note);
const ALL_INTEGRATIONS = link("integrations.index", "All Peakhour integrations", "Every connection, with its status.");

export const INTEGRATION_CONTENT: Record<string, { content: IntegrationContent; claimIds: string[] }> = {
  "integrations.whatsapp": build({
    pageId: "integrations.whatsapp",
    name: "WhatsApp",
    eyebrow: "Integration · Commerce",
    evidenceId: "integration.whatsapp",
    claimIds: ["integration.whatsapp.connect_number"],
    directAnswer:
      "Peakhour connects to your own WhatsApp Business number through Meta's sign-up screens, so your AI assistant and your team can chat with your customers on it. You connect it once on the Peakhour web dashboard. You need a number your business owns, and template messages need Meta's approval.",
    limitations: [
      "It needs a WhatsApp Business number that your business owns.",
      "Template messages need Meta's approval before they can be sent.",
      "You connect it on the web dashboard, not inside the Shopify admin.",
    ],
    does: [
      "Connects a WhatsApp Business number your business owns, using Meta's own sign-up screens.",
      "Lets your AI assistant and your team chat with customers on that number.",
      "Is set up once, on the Peakhour web dashboard.",
    ],
    data: [
      { name: "Your WhatsApp Business number and its connection", why: "To send and receive messages on your behalf, through Meta." },
      { name: "The conversations on that number", why: "So your assistant and your team answer in the same thread." },
    ],
    steps: [
      { title: "Open Integrations", body: "In the Peakhour dashboard, go to Integrations and choose WhatsApp." },
      { title: "Sign in with Meta", body: "Follow Meta's sign-up screens to add or pick the business number." },
      { title: "Get templates approved", body: "Any template message you want to send has to be approved by Meta first." },
    ],
    faqs: [
      { q: "Which WhatsApp number can I connect?", a: "A WhatsApp Business number that your business owns. Meta's sign-up screens walk you through adding or choosing it." },
      { q: "Can I connect WhatsApp from inside Shopify?", a: "No. Connecting happens on the Peakhour web dashboard, not in the Shopify admin." },
      { q: "Do template messages need approval?", a: "Yes. Meta has to approve a template before it can be sent." },
    ],
    related: [
      HUB("commerce", "Peakhour Commerce", "The AI assistant that sells on WhatsApp and your storefront."),
      link("shopify", "Peakhour for Shopify", "The Shopify app, and how WhatsApp fits it."),
      ALL_INTEGRATIONS,
    ],
    closingSubject: "WhatsApp",
  }),

  "integrations.linkedin": build({
    pageId: "integrations.linkedin",
    name: "LinkedIn",
    eyebrow: "Integration · Growth",
    evidenceId: "integration.linkedin",
    claimIds: ["integration.linkedin.connect_linkedin", "growth.linkedin_growth.publish_and_boost"],
    directAnswer:
      "Connect LinkedIn and Peakhour can publish, manage and track your posts, and suggest replies and opening hooks. This page covers organic content only. Boosting a post into an ad is a separate paid step, and delivery of leads from LinkedIn forms is not switched on.",
    limitations: [
      "Organic content only: this page does not cover paid LinkedIn ads.",
      "Lead delivery from LinkedIn forms is not switched on.",
      "Replies, comments and reactions are sent only when you or your team trigger them.",
    ],
    does: [
      "Publishes and manages your LinkedIn posts from Peakhour.",
      "Suggests replies and opening hooks with AI.",
      "Tracks engagement on your posts.",
    ],
    data: [
      { name: "Your LinkedIn connection", why: "To publish and manage posts on the account you choose." },
      { name: "Your posts and how they perform", why: "To track engagement and to suggest replies." },
    ],
    steps: [
      { title: "Open Integrations", body: "In the Peakhour dashboard, go to Integrations and choose LinkedIn." },
      { title: "Allow access", body: "Sign in with LinkedIn and allow Peakhour to publish and read your posts." },
      { title: "Draft and approve a post", body: "Write or generate a post, approve it, and it goes out at the time you set." },
    ],
    faqs: [
      { q: "Will it deliver my LinkedIn lead-form leads?", a: "No. Lead delivery from LinkedIn forms is not switched on." },
      { q: "Does this page cover LinkedIn ads?", a: "No. It covers organic content. Boosting a post into an ad is a separate, paid step." },
      { q: "Does it reply for me?", a: "It suggests replies. Replies, comments and reactions are sent only when you or your team trigger them." },
    ],
    related: [
      link("features.social.media.content", "Social media publishing", "Plan and publish posts across four networks."),
      link("features.brand.voice", "Brand voice", "Make drafts sound like you."),
      HUB("growth", "Peakhour Growth", "Where LinkedIn sits among your growth work."),
      link("integrations.x", "X integration", "Publish posts and threads on X."),
    ],
    closingSubject: "LinkedIn",
  }),

  "integrations.x": build({
    pageId: "integrations.x",
    name: "X",
    eyebrow: "Integration · Content",
    evidenceId: "integration.x",
    claimIds: ["integration.x.connect_x", "content.social_publishing.four_networks"],
    directAnswer:
      "Connect X and Peakhour can publish posts and threads at the time you scheduled them. Nothing goes out without an approved plan. It publishes only: X direct messages are switched off.",
    limitations: [
      "Nothing posts without an approved plan.",
      "Publishing only: X direct messages are switched off for every merchant.",
    ],
    does: ["Publishes posts and threads from Peakhour.", "Posts at the time you scheduled, after you approve the plan."],
    data: [
      { name: "Your X connection", why: "To publish to the account you choose." },
      { name: "The posts you approve", why: "So Peakhour can post them at the time you set." },
    ],
    steps: [
      { title: "Open Integrations", body: "In the Peakhour dashboard, go to Integrations and choose X." },
      { title: "Allow access", body: "Sign in to X and allow Peakhour to post for you." },
      { title: "Approve a plan", body: "Peakhour posts only what is in a plan you approved." },
    ],
    faqs: [
      { q: "Can Peakhour post threads?", a: "Yes. It publishes posts and threads." },
      { q: "Will it post without asking me?", a: "No. Nothing posts without an approved plan." },
      { q: "Does it read or send X direct messages?", a: "No. X direct messages are switched off." },
    ],
    related: [
      link("features.social.media.content", "Social media publishing", "Plan and publish across four networks."),
      HUB("content", "Peakhour Content", "AI writers that publish in your voice."),
      link("integrations.x.ads", "X Ads integration", "Create and pause X ad campaigns."),
      link("integrations.linkedin", "LinkedIn integration", "Publish and track LinkedIn posts."),
    ],
    closingSubject: "X publishing",
  }),

  "integrations.beehiiv": build({
    pageId: "integrations.beehiiv",
    name: "Beehiiv",
    eyebrow: "Integration · Content",
    evidenceId: "integration.beehiiv",
    claimIds: ["integration.beehiiv.connect_beehiiv", "content.beehiiv_newsletter.draft_to_beehiiv"],
    directAnswer:
      "Connect Beehiiv with your API key and Peakhour imports your past posts every hour and sends approved newsletters to Beehiiv as drafts. It never sends a newsletter: you open the draft in Beehiiv and click Send.",
    limitations: [
      "It creates drafts in Beehiiv. You send them from Beehiiv.",
      "Substack, Kit, Mailchimp and Ghost are not available.",
    ],
    does: [
      "Connects to Beehiiv with your API key.",
      "Imports your past posts every hour, so drafts can follow how you already write.",
      "Sends each approved newsletter to Beehiiv as a draft.",
    ],
    data: [
      { name: "Your Beehiiv API key", why: "To connect to your publication." },
      { name: "Your past Beehiiv posts", why: "To learn from what you have already published." },
    ],
    steps: [
      { title: "Copy your API key", body: "Create or copy an API key in your Beehiiv settings." },
      { title: "Connect it", body: "In the Peakhour dashboard, go to Integrations, choose Beehiiv and paste the key." },
      { title: "Approve a newsletter", body: "Approve the newsletter, then open the draft in Beehiiv and press Send yourself." },
    ],
    faqs: [
      { q: "Does Peakhour send my newsletter?", a: "No. It creates a draft in Beehiiv. You press Send in Beehiiv." },
      { q: "Does it work with Substack, Kit, Mailchimp or Ghost?", a: "No. Beehiiv is the only newsletter tool available." },
      { q: "How often does it read my past posts?", a: "It imports them every hour." },
    ],
    related: [
      HUB("content", "Peakhour Content", "AI writers that publish in your voice."),
      link("features.brand.voice", "Brand voice", "How drafts learn to sound like you."),
      link("features.index", "All Presence and Content features", "What else Peakhour does."),
      ALL_INTEGRATIONS,
    ],
    closingSubject: "Beehiiv drafts",
  }),

  "integrations.meta.ads": build({
    pageId: "integrations.meta.ads",
    name: "Meta Ads",
    eyebrow: "Integration · Growth",
    evidenceId: "growth.meta_ads",
    claimIds: ["growth.meta_ads.list_and_pause", "growth.campaign_planning.plan_for_approval"],
    directAnswer:
      "Connect Meta and Peakhour lists your campaigns, ad sets and ads with their results, and lets you pause or resume them. It cannot create a campaign from the dashboard panel. New campaigns are planned in Growth, and nothing is created or spent without your approval.",
    limitations: [
      "The dashboard panel lists, expands, pauses and resumes. It does not create campaigns.",
      "Meta write paths have not yet been used against a live ad account.",
      "It runs through your single Facebook (Meta) connection.",
    ],
    does: [
      "Lists your Meta campaigns, ad sets and ads with their results.",
      "Pauses or resumes any of them.",
      "Leaves new campaigns to Growth planning, where nothing is created or spent without your approval.",
    ],
    data: [
      { name: "Your Meta campaigns, ad sets and ads", why: "To show them to you and let you pause or resume." },
      { name: "Their results", why: "So you can see what each one is doing before you change it." },
    ],
    steps: [
      { title: "Connect Facebook", body: "In the Peakhour dashboard, go to Integrations and connect your Facebook (Meta) account." },
      { title: "Open Ads", body: "Choose Ads to see your campaigns, ad sets and ads." },
      { title: "Pause or resume", body: "Pause or resume any campaign, ad set or ad from the list." },
    ],
    faqs: [
      { q: "Can I create a Meta campaign in Peakhour?", a: "Not from the dashboard panel. It lists, expands, pauses and resumes. New campaigns go through Growth planning, with your approval." },
      { q: "Will Peakhour spend my budget on its own?", a: "No. Nothing is created or spent without your approval." },
      { q: "Is the pause button tested on a live account?", a: "Meta write paths have not yet been used against a live ad account, so treat pausing as new." },
    ],
    related: [
      HUB("growth", "Peakhour Growth", "How campaigns are planned for your approval."),
      link("integrations.facebook", "Facebook Pages integration", "The same Meta connection."),
      link("integrations.instagram", "Instagram integration", "Publishing through the same connection."),
      link("integrations.x.ads", "X Ads integration", "Create and pause X campaigns."),
    ],
    closingSubject: "Meta Ads",
  }),

  "integrations.instagram": build({
    pageId: "integrations.instagram",
    name: "Instagram",
    eyebrow: "Integration · Content",
    evidenceId: "integration.instagram",
    claimIds: ["integration.instagram.publish_images"],
    directAnswer:
      "Peakhour publishes approved images and carousels to Instagram through your Meta connection. It is publishing only: no video, reels or text-only posts, and never direct messages.",
    limitations: [
      "Publishing only. It never reads or sends direct messages.",
      "A post needs an image, or a carousel of 2 to 10 images.",
      "No video, reels or text-only posts.",
      "It connects through your Facebook (Meta) connection.",
    ],
    does: ["Publishes approved single images to Instagram.", "Publishes approved carousels of 2 to 10 images.", "Uses the Meta connection you already have for Facebook."],
    data: [
      { name: "Your Meta connection", why: "To publish to the Instagram account linked to it." },
      { name: "The images in each approved post", why: "So Peakhour can post them at the time you set." },
    ],
    steps: [
      { title: "Connect Facebook", body: "In the Peakhour dashboard, go to Integrations and connect your Facebook (Meta) account." },
      { title: "Choose your Instagram account", body: "Pick the Instagram account that is linked through Meta." },
      { title: "Approve a post", body: "Add an image or carousel, approve the plan, and it posts at the time you set." },
    ],
    faqs: [
      { q: "Does Peakhour handle Instagram direct messages?", a: "No. It publishes only. Direct messages are switched off." },
      { q: "Can it post a video or a reel?", a: "No. A post needs an image, or a carousel of 2 to 10 images." },
      { q: "Do I connect Instagram separately?", a: "It connects through your Facebook (Meta) connection." },
    ],
    related: [
      link("features.social.media.content", "Social media publishing", "Plan and publish across four networks."),
      link("integrations.facebook", "Facebook Pages integration", "Publish to your Page through the same connection."),
      HUB("content", "Peakhour Content", "AI writers that publish in your voice."),
      ALL_INTEGRATIONS,
    ],
    closingSubject: "Instagram publishing",
  }),

  "integrations.facebook": build({
    pageId: "integrations.facebook",
    name: "Facebook Pages",
    eyebrow: "Integration · Content",
    evidenceId: "integration.facebook_pages",
    claimIds: ["integration.facebook_pages.post_to_pages"],
    directAnswer:
      "Connect your Facebook Page and Peakhour publishes approved posts to it. It is publishing only: Messenger is not available. One Meta connection covers your Pages, Instagram and Meta Ads.",
    limitations: ["Publishing only. Messenger is not available.", "Nothing posts without an approved plan."],
    does: ["Connects your Facebook Page.", "Publishes approved posts to the Page.", "Gives you one Meta connection for Pages, Instagram and Meta Ads."],
    data: [
      { name: "Your Facebook Page connection", why: "To publish to the Page you choose." },
      { name: "The posts you approve", why: "So Peakhour can post them at the time you set." },
    ],
    steps: [
      { title: "Open Integrations", body: "In the Peakhour dashboard, go to Integrations and choose Facebook." },
      { title: "Sign in with Meta", body: "Allow Peakhour access, and pick the Page you want to publish to." },
      { title: "Approve a post", body: "Approve a plan and Peakhour posts at the time you set." },
    ],
    faqs: [
      { q: "Does it answer Messenger messages?", a: "No. Messenger is not available. Peakhour publishes to Pages only." },
      { q: "Will it post without my approval?", a: "No. Nothing posts without an approved plan." },
      { q: "Does the same connection cover Instagram?", a: "Yes. One Meta connection covers Pages, Instagram and Meta Ads." },
    ],
    related: [
      link("features.social.media.content", "Social media publishing", "Plan and publish across four networks."),
      link("integrations.instagram", "Instagram integration", "Publish images and carousels."),
      link("integrations.meta.ads", "Meta Ads integration", "List and pause campaigns."),
      HUB("content", "Peakhour Content", "AI writers that publish in your voice."),
    ],
    closingSubject: "Facebook Pages publishing",
  }),

  "integrations.google.business.profile": build({
    pageId: "integrations.google.business.profile",
    name: "Google Business Profile",
    eyebrow: "Integration · Presence",
    evidenceId: "integration.google_business_profile",
    claimIds: ["integration.google_business_profile.connect_google"],
    directAnswer:
      "Connect your Google Business Profile with Google sign-in and Peakhour can read your listing, your reviews and your customer-action figures: calls, directions and website clicks. This connection is in beta, so it may change and may not be open to every account yet.",
    limitations: [
      "In beta: it may change, and may not be open to every account yet.",
      "This connection reads. Changes to your listing are a separate feature and need an admin's approval.",
    ],
    does: [
      "Connects your Google Business Profile through Google sign-in.",
      "Reads your listing, so the score and fixes can be worked out.",
      "Reads your reviews, so they can arrive in your Inbox.",
      "Reads your customer-action figures: calls, directions and website clicks.",
    ],
    data: [
      { name: "Your listing details", why: "To show what a customer sees, and to prepare changes for your approval." },
      { name: "Your reviews", why: "So they appear in your Inbox for a person to answer." },
      { name: "Calls, directions and website clicks", why: "So you can see how people use your listing." },
    ],
    steps: [
      { title: "Open Integrations", body: "In the Peakhour dashboard, go to Integrations and choose Google Business Profile." },
      { title: "Sign in with Google", body: "Use the Google account that manages the listing and allow access." },
      { title: "Check your listing", body: "Peakhour reads the listing, and the features that use it switch on." },
    ],
    faqs: [
      { q: "Is this connection ready for everyone?", a: "It is in beta. It may change, and it may not be open to every account yet." },
      { q: "Can Peakhour change my listing once it is connected?", a: "Only as a prepared change that an admin on your team approves. Nothing is sent to Google without that." },
      { q: "What does it read?", a: "Your listing, your reviews, and your calls, directions and website-click figures." },
    ],
    related: [
      HUB("presence", "Peakhour Presence", "Own how you show up on Google."),
      link("features.google.business.profile.management", "Google Business Profile management", "Prepare changes for approval."),
      link("features.review.management", "Review management", "AI drafts, a person sends."),
      link("features.local.listing.health", "Listing health", "Your score and what to fix next."),
    ],
    closingSubject: "Google Business Profile",
  }),

  "integrations.x.ads": build({
    pageId: "integrations.x.ads",
    name: "X Ads",
    eyebrow: "Integration · Growth",
    evidenceId: "growth.x_ads",
    claimIds: ["growth.x_ads.create_and_pause"],
    directAnswer:
      "Connect X Ads and Peakhour can create and pause X campaigns and show you their results. Creating a campaign needs a funding instrument on your X Ads account.",
    limitations: ["Creating a campaign needs a funding instrument on your X Ads account."],
    does: ["Connects your X Ads account.", "Creates X campaigns.", "Pauses X campaigns.", "Shows the results of each campaign."],
    data: [
      { name: "Your X Ads account and its campaigns", why: "To create, pause and report on them." },
      { name: "Campaign results", why: "So you can see what is working before you change anything." },
    ],
    steps: [
      { title: "Make sure the account is funded", body: "Add a funding instrument in your X Ads account." },
      { title: "Connect X Ads", body: "In the Peakhour dashboard, go to Integrations and connect X Ads." },
      { title: "Create or pause", body: "Create a campaign, or pause one, and watch its results." },
    ],
    faqs: [
      { q: "What do I need before I can create a campaign?", a: "A funding instrument on your X Ads account." },
      { q: "Is this the same as the X publishing connection?", a: "No. Publishing posts and running ads are separate connections." },
      { q: "Can I see results?", a: "Yes. Peakhour shows the results of your X campaigns." },
    ],
    related: [
      HUB("growth", "Peakhour Growth", "How ads fit your growth plan."),
      link("integrations.x", "X integration", "Publish posts and threads."),
      link("integrations.meta.ads", "Meta Ads integration", "List and pause Meta campaigns."),
      ALL_INTEGRATIONS,
    ],
    closingSubject: "X Ads",
  }),

  // ---- held in review: the page makes no claim ----
  "integrations.google.ads": build({
    pageId: "integrations.google.ads",
    name: "Google Ads",
    eyebrow: "Integration · Growth",
    evidenceId: "growth.google_ads",
    claimIds: [],
    directAnswer:
      "Peakhour's Google Ads connection is built, but it is not switched on for merchants yet, so there is nothing to connect today. This page stays in review until it is.",
    limitations: ["Not available to connect yet.", "It has not been tested against a live Google Ads account."],
    does: ["Nothing is available to connect yet."],
    data: [{ name: "Nothing yet", why: "No data is read until the connection is switched on." }],
    steps: [{ title: "Watch for the switch", body: "Join the waitlist and we will tell you when Google Ads can be connected." }],
    faqs: [{ q: "Can I connect Google Ads today?", a: "No. It is built but not switched on for merchants yet." }],
    related: [HUB("growth", "Peakhour Growth", "What Growth does today."), link("integrations.meta.ads", "Meta Ads integration", "List and pause Meta campaigns.")],
    closingSubject: "Google Ads",
  }),

  "integrations.google.search.console": build({
    pageId: "integrations.google.search.console",
    name: "Google Search Console",
    eyebrow: "Integration · Content",
    evidenceId: "integration.google_search_console",
    claimIds: [],
    directAnswer:
      "Peakhour's Google Search Console connection is built and read-only, but it is not switched on for merchants yet. This page stays in review until it is.",
    limitations: ["Not available to connect yet.", "It will be read-only."],
    does: ["Nothing is available to connect yet."],
    data: [{ name: "Nothing yet", why: "No data is read until the connection is switched on." }],
    steps: [{ title: "Watch for the switch", body: "Join the waitlist and we will tell you when Search Console can be connected." }],
    faqs: [{ q: "Can I connect Search Console today?", a: "No. It is built but not switched on for merchants yet." }],
    related: [HUB("content", "Peakhour Content", "What Content does today."), ALL_INTEGRATIONS],
    closingSubject: "Search Console",
  }),

  "integrations.linkedin.ads": build({
    pageId: "integrations.linkedin.ads",
    name: "LinkedIn Ads",
    eyebrow: "Integration · Growth",
    evidenceId: "growth.linkedin_ads",
    claimIds: [],
    directAnswer:
      "Peakhour's LinkedIn Ads connection boosts a post you already published and manages the campaign, but it is not switched on for production merchants yet. This page stays in review until it is.",
    limitations: ["Not available to connect yet.", "It boosts an existing post. It does not create a blank campaign."],
    does: ["Nothing is available to connect yet."],
    data: [{ name: "Nothing yet", why: "No data is read until the connection is switched on." }],
    steps: [{ title: "Watch for the switch", body: "Join the waitlist and we will tell you when LinkedIn Ads can be connected." }],
    faqs: [{ q: "Can I run LinkedIn ads today?", a: "Not yet. It is built, but not switched on for merchants." }],
    related: [HUB("growth", "Peakhour Growth", "What Growth does today."), link("integrations.linkedin", "LinkedIn integration", "Publish and track organic posts.")],
    closingSubject: "LinkedIn Ads",
  }),
};
