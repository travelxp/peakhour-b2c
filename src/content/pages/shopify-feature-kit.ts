import type { Crumb, LinkItem, ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { getCapability } from "@/lib/seo/capabilities";
import { getPage } from "@/lib/seo/pages";
import { isPublishable } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import type { ReleaseStatus, Surface } from "@/lib/seo/types";

/*
 * What the wave-1 Shopify feature pages (SEO-8) share. Status, limitations and the verified date are READ from the
 * capability record, never retyped, so a page cannot say more than the registry does, and a status change in
 * capabilities.ts changes the page.
 */

/** The page's ids of the approved claims it leans on, for the PR body and the claim tests. */
export type PageClaims = readonly string[];

export function capabilityFacts(capabilityId: string, surface: Surface = "shopify"): { status: ReleaseStatus; limitations: string[]; verifiedAt: string } {
  const cap = getCapability(capabilityId);
  if (!cap) throw new Error(`Unknown capability "${capabilityId}"`);
  const impl = cap.implementations.find((i) => i.surface === surface);
  if (!impl) throw new Error(`Capability "${capabilityId}" has no ${surface} implementation`);
  return { status: impl.status, limitations: impl.limitations ?? [], verifiedAt: impl.verifiedAt };
}

/** The crumbs of a feature page: Home, Shopify, Features, the page. */
export function featureCrumbs(label: string, pageId: string): Crumb[] {
  return [
    { label: "Home", href: pathFor("home") },
    { label: "Shopify", href: pathFor("shopify") },
    { label: "Features", href: pathFor("shopify.features") },
    { label, href: pathFor(pageId) },
  ];
}

/**
 * A link to a sibling page. A page that is published never links to one that is not (production 404s it), so the
 * link is left out until the sibling publishes; a page still in review links to everything.
 */
export function siblingLink(selfId: string, targetId: string, label: string, note: string): LinkItem[] {
  if (isPublishable(getPage(selfId)) && !isPublishable(getPage(targetId))) return [];
  return [{ label, href: pathFor(targetId), note }];
}

/**
 * A one-card `items` for a short section that hands the reader on to a sibling page (the assistant's Find my match, the
 * shelf page's Buy together and save). Spread it into the section; it is `{}` until the sibling publishes.
 */
export function siblingItem(selfId: string, targetId: string, title: string, label: string, note: string): { items?: { title: string; body: string; href: string; linkLabel: string }[] } {
  const [link] = siblingLink(selfId, targetId, label, note);
  return link ? { items: [{ title, body: note, href: link.href, linkLabel: link.label }] } : {};
}

export const SHOPIFY_HOME_LINK: LinkItem = {
  label: "Peakhour for Shopify",
  href: "/shopify",
  note: "Everything the Shopify app does, on one page.",
};

export const PRICING_LINK: LinkItem = {
  label: "Peakhour pricing in Peaks",
  href: "/pricing",
  note: "What the plan includes and how Peaks are used.",
};

export const ADD_STORE_CLOSING: ShopifyFeatureContent["closing"] = {
  headline: "See it on your own store.",
  body: "Install Peakhour from the Shopify App Store, or open the Shopify page to see where it stands today.",
};

/** Proof tiles are product art, never a store: every feature page labels its picture as a demo. */
export const DEMO = "demo" as const;

/** The first sentence of a claim or a feature's copy: shorter than the whole, never different from it. */
export const firstSentence = (s: string): string => s.split(/(?<=[.!?])\s/)[0] ?? s;
