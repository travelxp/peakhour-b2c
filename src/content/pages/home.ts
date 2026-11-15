import type { BaseContent, HubItem } from "@/components/marketing/seo/content-types";
import { pathFor } from "@/lib/seo/resolve";
import { liveItem, soonItem } from "./hub-helpers";

/** The home page: the five modules with the status each record gives it. Cards are built from approved claims. */
export type HomeModule = HubItem & { href: string };

export const HOME_MODULES: HomeModule[] = [
  { ...liveItem("commerce.ai_shopping_assistant.answers_from_catalogue", "shopify", "Commerce"), href: pathFor("commerce") },
  { ...liveItem("content.brand_voice.learns_your_voice", "web", "Content"), href: pathFor("content") },
  { ...liveItem("growth.campaign_planning.plan_for_approval", "web", "Growth"), href: pathFor("growth") },
  {
    ...soonItem(
      "support.channel_inbox",
      "web",
      "Support",
      "Answering shoppers on WhatsApp and handing the hard ones to your team is built and switching on soon. Today it shows what shoppers asked your assistant that it could not answer.",
    ),
    href: pathFor("support"),
  },
  { ...liveItem("presence.gbp_management.prepare_and_approve", "web", "Presence"), href: pathFor("presence") },
];

/** Everything on the home page except the closing sentence, which depends on the live signup mode. */
export function homeContent(closingBody: string): BaseContent {
  return {
    crumbs: [],
    eyebrow: "The AI business platform for growing brands",
    directAnswer:
      "Peakhour is an AI business platform for growing brands. It answers shoppers on your Shopify store and WhatsApp, drafts and posts content in your brand voice, plans and reviews your ads, and prepares your Google Business Profile changes. You approve what goes out.",
    secondaryCta: { label: "See how Peakhour works", href: pathFor("how.it.works") },
    faqs: [
      {
        q: "Who is Peakhour for?",
        a: "Growing brands that sell online and run their own marketing: ecommerce stores, small and local businesses, agencies and growing teams.",
      },
      {
        q: "What does it connect to today?",
        a: "Shopify, WhatsApp, LinkedIn, X, Facebook, Instagram and Beehiiv, plus Google Business Profile in beta. WordPress and WooCommerce are built and coming soon.",
      },
      {
        q: "Does it act without asking me?",
        a: "Only inside limits you set. Autopilot acts within them and can reverse what it did, and new channels and changes to your subscription always need your approval.",
      },
      {
        q: "What is not live yet?",
        a: "The support channels, Google Ads, LinkedIn Ads, WordPress and WooCommerce are built and not switched on. Peakhour Summit and Google Business Profile support are in beta.",
      },
    ],
    related: [
      { label: "How Peakhour works", href: pathFor("how.it.works"), note: "Connect, approve, then let it run." },
      { label: "Peakhour for Shopify", href: pathFor("shopify"), note: "Every Shopify feature, install and billing." },
      { label: "Peakhour pricing", href: pathFor("pricing"), note: "One plan for five modules, with Peaks included." },
      { label: "Commerce", href: pathFor("commerce"), note: "The shopping assistant for Shopify and WhatsApp." },
      { label: "Growth", href: pathFor("growth"), note: "Plans, ads and Peakhour Summit." },
      { label: "Peaks", href: pathFor("peaks"), note: "The AI credits behind every feature." },
    ],
    closing: { headline: "Stop being the glue between every part of your business.", body: closingBody },
  };
}
