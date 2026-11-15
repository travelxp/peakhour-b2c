import type { DirectoryContent } from "@/components/marketing/seo/content-types";
import { pathFor } from "@/lib/seo/resolve";

/*
 * /industries and /guides. Both are "review": a directory publishes only once it has a published child (audit, page 16;
 * Bible 7.6), and neither has one yet. They are not linked from public navigation.
 */
export const INDUSTRIES: DirectoryContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Industries", href: pathFor("industries") },
  ],
  eyebrow: "Industries",
  directAnswer: "How Peakhour fits different kinds of business, with the status of each page's capabilities.",
  items: [
    {
      title: "Fashion and apparel",
      body: "Shelves, Find my match, the shopping assistant and WhatsApp COD confirmation for Shopify fashion stores.",
      href: pathFor("industries.fashion.apparel"),
      status: "live",
      pillar: "Commerce",
    },
  ],
  faqs: [],
  related: [
    { label: "Peakhour for Shopify", href: pathFor("shopify"), note: "The app the industry pages are built on." },
    { label: "How Peakhour works", href: pathFor("how.it.works"), note: "Ask, approve and undo." },
  ],
  closing: { headline: "Not your industry yet?", body: "Join the waitlist and tell us what your business does." },
};

export const GUIDES: DirectoryContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Guides", href: pathFor("guides") },
  ],
  eyebrow: "Guides",
  directAnswer: "Original how-to guides for running a store with Peakhour, each with its sources and when it was last updated.",
  items: [
    {
      title: "Set up WhatsApp COD confirmation on Shopify",
      body: "What you need, the setup steps, what happens to unanswered orders and the limits.",
      href: pathFor("shopify.guides.whatsapp.cod.confirmation"),
      status: "live",
      pillar: "Commerce",
    },
  ],
  faqs: [],
  related: [
    { label: "Peakhour for Shopify", href: pathFor("shopify"), note: "The app the guides are written for." },
    { label: "How Peakhour works", href: pathFor("how.it.works"), note: "Ask, approve and undo." },
  ],
  closing: { headline: "Want a guide we have not written?", body: "Write to us and tell us what you are trying to do." },
};
