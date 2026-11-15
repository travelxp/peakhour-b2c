import type { HubContent } from "@/components/marketing/seo/content-types";
import { pathFor } from "@/lib/seo/resolve";
import { liveItem, soonItem } from "./hub-helpers";

/**
 * /support. The live support channels are switched off pending the owner's decision (plan Q3), so only
 * conversation insights is a claim; the rest is "coming soon", read from the records.
 */
export const SUPPORT: HubContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Support", href: pathFor("support") },
  ],
  eyebrow: "Support",
  directAnswer:
    "Peakhour Support is built to answer shoppers on WhatsApp and hand the hard ones to your team, and that part is switching on soon. Today it shows you what shoppers asked your assistant that it could not answer, so you can fix the gap.",
  items: [
    liveItem("support.conversation_insights.unmet_asks", "web", "Conversation insights", 0),
    soonItem("support.channel_inbox", "web", "Shared inbox", "One view of your shopper conversations, with a thread for each customer. Built, and not switched on yet."),
    soonItem("support.ai_replies", "web", "AI reply drafts", "AI drafts a reply for a person on your team to edit and send. It never sends by itself. Built, and not switched on yet."),
    soonItem("support.whatsapp_support", "whatsapp", "WhatsApp support assistant", "Answers shoppers on your WhatsApp number and hands over to your team when asked or stuck. Built, and not switched on yet."),
  ],
  platforms: [],
  control: [
    "Replies are drafts for a person to edit and send; nothing is sent by itself.",
    "After 24 hours, WhatsApp only allows an approved template message.",
    "Instagram, Messenger and X messages and email are not in the inbox.",
  ],
  comingSoonNote: "These are built. We switch them on once the support channels are ready for every store.",
  faqs: [
    {
      q: "Can Peakhour answer my customers on WhatsApp today?",
      a: "Not yet. The WhatsApp support assistant is built and not switched on. Peakhour's shopping assistant on WhatsApp, which answers product questions, is part of Commerce.",
    },
    {
      q: "Is there a shared inbox for every channel?",
      a: "No. A shared inbox is built and not switched on, and Instagram, Messenger, X and email are not in it.",
    },
    {
      q: "What does it show me today?",
      a: "What several shoppers asked your assistant that it could not answer, including products they wanted that you do not sell, how often, whether it is rising, and what to do next. It shows nothing while the assistant is off, and your own test chats are excluded.",
    },
  ],
  related: [
    { label: "Commerce", href: pathFor("commerce"), note: "The shopping assistant whose gaps Support shows." },
    { label: "Content", href: pathFor("content"), note: "Turn a repeated question into a post." },
    { label: "Peakhour pricing", href: pathFor("pricing"), note: "What the plan includes." },
  ],
  closing: {
    headline: "Know what your shoppers could not get answered.",
    body: "Join the waitlist and we will tell you when the support channels switch on.",
  },
};
