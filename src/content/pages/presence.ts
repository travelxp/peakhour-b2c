import type { HubContent } from "@/components/marketing/seo/content-types";
import { pathFor } from "@/lib/seo/resolve";
import { liveItem } from "./hub-helpers";

/** /presence. Google Business Profile is beta with sending held behind a switch, so the page says so. */
export const PRESENCE: HubContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Presence", href: pathFor("presence") },
  ],
  eyebrow: "Presence · Beta",
  directAnswer:
    "Prepare changes to your Google listing, and approve each one. Peakhour also drafts a reply to every review and scores how complete your listing is. Google Business Profile support is in beta.",
  items: [
    liveItem("presence.gbp_management.prepare_and_approve", "web", "Edits, photos and posts"),
    liveItem("presence.review_management.draft_then_send", "web", "Review replies", 0),
    liveItem("presence.listing_health.score_and_alerts", "web", "Listing health score", 0),
    liveItem("integration.google_business_profile.connect_google", "web", "Connect Google"),
  ],
  platforms: [],
  control: [
    "Nothing is sent to Google until an admin on your team approves it, and undo is a new change that needs its own approval.",
    "Review replies are drafts: a person reads one and presses Send. There is no automatic reply.",
  ],
  limits: [
    { title: "Verification", text: "Changing your name, address or main category can make Google ask you to verify again." },
    { title: "Where you edit", text: "Edits are made on the web; Shopify and WordPress show the listing read-only." },
  ],
  comingSoonNote: "",
  faqs: [
    {
      q: "Can I change my Google listing from Peakhour today?",
      a: "You can prepare the changes, and an admin on your team approves them. Google Business Profile support is in beta, so changes reach Google only once Peakhour has switched sending on for Google.",
    },
    {
      q: "Does it reply to reviews automatically?",
      a: "No. AI drafts a reply, and a person on your team edits and sends it. New reviews arrive on the hourly sync.",
    },
    {
      q: "Does the score show how Google ranks me?",
      a: "No. It says what a customer sees or cannot do on your listing, such as a missing phone number. It says nothing about how Google ranks you.",
    },
    {
      q: "How do I get alerts?",
      a: "By email and in the app, not WhatsApp. Losing control of the listing is emailed at once, and the rest arrive in a daily email.",
    },
  ],
  related: [
    { label: "Support", href: pathFor("support"), note: "What shoppers ask that your assistant cannot answer." },
    { label: "Content", href: pathFor("content"), note: "Posts for your other channels." },
    { label: "How Peakhour works", href: pathFor("how.it.works"), note: "How the approvals work across the platform." },
    { label: "Peakhour pricing", href: pathFor("pricing"), note: "Presence is part of the one Peakhour plan." },
  ],
  closing: {
    headline: "Show up correctly where people search.",
    body: "Connect your Google Business Profile and approve each change before it goes out.",
  },
};
