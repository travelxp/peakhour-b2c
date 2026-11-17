import type { BaseContent } from "@/components/marketing/seo/content-types";
import { capabilityStatus } from "@/lib/seo/status";
import { pathFor } from "@/lib/seo/resolve";
import type { ReleaseStatus } from "@/lib/seo/types";

/** /how-it-works. The platform loop, in words that match what the capability records say is built. */
export const HOW_IT_WORKS: BaseContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "How it works", href: pathFor("how.it.works") },
  ],
  eyebrow: "How it works",
  directAnswer:
    "Connect the tools you already use. Peakhour starts from your catalogue and past posts, drafts the work and shows you the decisions. You approve what goes out.",
  secondaryCta: { label: "See pricing", href: pathFor("pricing") },
  faqs: [
    {
      q: "Does Peakhour act without asking me?",
      a: "Only inside limits you set. Autopilot acts within those limits and can reverse what it did. New channels and changes to your subscription always need your approval.",
    },
    {
      q: "What does it connect to today?",
      a: "Shopify, WhatsApp, LinkedIn, X, Facebook, Instagram and Beehiiv, plus Google Business Profile in beta. WordPress and WooCommerce are coming soon.",
    },
    {
      q: "Is this all live?",
      a: "Most of it. Peakhour Summit and Google Business Profile support are in beta. The Support inbox, Google Ads and LinkedIn Ads are coming soon. Each page says which is which.",
    },
    {
      q: "Do the examples on this page show real results?",
      a: "No. They are examples of what the connected parts of Peakhour can show you. Your own data decides what you see.",
    },
  ],
  related: [
    { label: "Commerce", href: pathFor("commerce"), note: "The shopping assistant, shelves and COD confirmation." },
    { label: "Content", href: pathFor("content"), note: "Posts, newsletters and articles in your voice." },
    { label: "Growth", href: pathFor("growth"), note: "Plans, ads and Peakhour Summit." },
    { label: "Presence", href: pathFor("presence"), note: "Your Google Business Profile, in beta." },
    { label: "Peakhour pricing", href: pathFor("pricing"), note: "One plan, with Peaks for the AI work." },
  ],
  closing: {
    headline: "Connect one tool and see what it finds.",
    body: "You approve what changes, and you can set how much Peakhour does on its own.",
  },
};

/** What connects today, each status read from the capability record. */
export const CONNECTS: { label: string; status: ReleaseStatus }[] = [
  { label: "Shopify", status: capabilityStatus("commerce.ai_shopping_assistant", "shopify") },
  { label: "WhatsApp", status: capabilityStatus("integration.whatsapp", "web") },
  { label: "LinkedIn", status: capabilityStatus("integration.linkedin", "web") },
  { label: "X", status: capabilityStatus("integration.x", "web") },
  { label: "Facebook and Instagram", status: capabilityStatus("integration.facebook_pages", "web") },
  { label: "Beehiiv", status: capabilityStatus("integration.beehiiv", "web") },
  { label: "Google Business Profile", status: capabilityStatus("integration.google_business_profile", "web") },
  { label: "WordPress", status: capabilityStatus("integration.wordpress", "wordpress") },
  { label: "WooCommerce", status: capabilityStatus("integration.woocommerce", "woocommerce") },
];
