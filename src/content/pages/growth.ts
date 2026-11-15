import type { HubContent } from "@/components/marketing/seo/content-types";
import { pathFor } from "@/lib/seo/resolve";
import { liveItem, soonItem } from "./hub-helpers";

/** /growth. Every card is built from an approved claim in src/lib/seo/capabilities.ts (see hub-helpers). */
export const GROWTH: HubContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Growth", href: pathFor("growth") },
  ],
  eyebrow: "Growth",
  directAnswer:
    "Peakhour Growth drafts a growth strategy and a channel recommendation for you to approve, shows and pauses your Meta ads, creates and pauses X ads, manages your LinkedIn posts, and has Peakhour Summit review growth decisions before you make them. Google Ads and LinkedIn Ads are coming soon.",
  items: [
    liveItem("growth.peakhour_summit.reviews_proposals", "web", "Peakhour Summit", 0),
    liveItem("growth.campaign_planning.plan_for_approval", "web", "Growth strategy", 0),
    liveItem("growth.meta_ads.list_and_pause", "web", "Meta Ads", 0),
    liveItem("growth.x_ads.create_and_pause", "web", "X Ads", 0),
    liveItem("growth.linkedin_growth.publish_and_boost", "web", "LinkedIn", 0),
    liveItem("growth.ad_audiences.targeting", "web", "Audiences", 0),
    soonItem("growth.google_ads", "web", "Google Ads", "Google Ads campaigns are built and not switched on for stores yet."),
    soonItem("growth.linkedin_ads", "web", "LinkedIn Ads", "Managing LinkedIn Ads campaigns is built and not switched on yet."),
  ],
  platforms: [],
  control: [
    "Peakhour Summit advises and never applies a change; you approve any change.",
    "Nothing is created or spent until you approve a plan.",
    "Applying an audience leaves a campaign as a draft; it never starts spend.",
    "Replies, comments and reactions on LinkedIn are sent when you or your team trigger them.",
  ],
  comingSoonNote: "Both are built. They stay off until the connections are ready for stores.",
  faqs: [
    {
      q: "What is Peakhour Summit?",
      a: "It is Peakhour's review of your growth decisions. It makes a case for and a case against, runs safety checks and gives a final call. It is in beta, and it only recommends: you approve any change.",
    },
    {
      q: "Can I run Google Ads or LinkedIn Ads from Peakhour?",
      a: "Not yet. Both are built and not switched on. Meta Ads and X Ads work today, and you can boost a LinkedIn post you already published.",
    },
    {
      q: "Can it create Meta campaigns?",
      a: "Not from the dashboard panel today. It lists your Meta campaigns, ad sets and ads with results, and lets you pause or resume them.",
    },
    {
      q: "Does it spend my budget on its own?",
      a: "No. Nothing is created or spent without your approval, and Autopilot acts only inside the limits you set.",
    },
  ],
  related: [
    { label: "Content", href: pathFor("content"), note: "The posts you can put budget behind." },
    { label: "Commerce", href: pathFor("commerce"), note: "The store the ads send shoppers to." },
    { label: "How Peakhour works", href: pathFor("how.it.works"), note: "Where the approvals sit." },
    { label: "Peakhour pricing", href: pathFor("pricing"), note: "One plan, with Peaks for the AI work." },
  ],
  closing: {
    headline: "Review the plan, then spend.",
    body: "Peakhour drafts and reviews. You approve what is created and what is spent.",
  },
};
