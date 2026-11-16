import type { DirectoryItem, LinkItem, MoreContent } from "@/components/marketing/seo/content-types";
import { DIRECTORY_CAPABILITIES } from "@/content/pages/shopify.features";
import { CAPABILITIES, getCapability } from "@/lib/seo/capabilities";
import { capabilityFacts, firstSentence } from "@/content/pages/shopify-feature-kit";
import { cardLabel } from "@/lib/seo/labels";
import { PAGES, getPage } from "@/lib/seo/pages";
import { canOpen, statusSatisfies } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import type { PageFamily, PageRecord, ReleaseStatus } from "@/lib/seo/types";
import { compareRoute } from "./route";
import type { CompetitorBrief } from "./types";

/*
 * "Peakhour Suite gives more": the end of every comparison page. It lists what Peakhour does beyond the rows of that page's
 * table, so a reader sees the whole suite and not only the slice that was compared.
 *
 * It is built from the capability registry and the page registry, never from a typed list: a capability appears when it is
 * live (or beta, on a Shopify page) on its surface, carries an approved claim that status satisfies, and is not one the
 * table already claims or names as pending. Each card says one approved claim, cut to its first sentence and never
 * widened (the test holds every card's words inside an approved claim), and shows the status the registry gives it.
 * Nothing here says a competitor lacks a feature: that is the table's job, with its sources.
 */

/** A card and the capability it stands for, so a test can prove no card repeats a table row. */
export type MoreItem = { capabilityId: string; item: DirectoryItem };


/** A claim about how data is held, not something a merchant switches on, so it is not a feature to list beside a comparison. */
const NOT_A_FEATURE = "platform.security";

/** The capabilities the brief's table already covers (claimed or pending). */
export function comparedCapabilityIds(b: CompetitorBrief): Set<string> {
  const ids = new Set<string>();
  for (const c of b.claims) {
    if (c.peakhour.capabilityId) ids.add(c.peakhour.capabilityId);
    if (c.peakhour.pendingCapability) ids.add(c.peakhour.pendingCapability);
  }
  return ids;
}

/** The shortest approved claim the status satisfies, as its first sentence; undefined when none is satisfied. */
function claimFor(capabilityId: string, status: ReleaseStatus): string | undefined {
  const cap = getCapability(capabilityId);
  const ok = cap?.approvedClaims.filter((c) => statusSatisfies(status, c.requires)) ?? [];
  if (ok.length === 0) return undefined;
  return firstSentence([...ok].sort((a, b) => a.text.length - b.text.length)[0]!.text);
}

const FAMILY_RANK: Partial<Record<PageFamily, number>> = { feature: 0, integration: 1 };

/** A card shows its claim only when the first sentence is short enough for a compact card; a long one is left out whole, never cut. */
const MAX_LINE = 120;

/**
 * The cross-platform page that is ABOUT a capability, for a global comparison: a /features or /integrations page that lists it
 * alone, else first. A Shopify feature page is never it: a global reader is not sent to a Shopify-only page.
 */
function globalOwnerPage(capabilityId: string): PageRecord | undefined {
  return [
    ...PAGES.filter((p) => p.capabilityIds.length === 1 && p.capabilityIds[0] === capabilityId),
    ...PAGES.filter((p) => p.capabilityIds[0] === capabilityId),
  ]
    .filter((p) => FAMILY_RANK[p.family] !== undefined && canOpen(p))
    .sort((a, z) => (FAMILY_RANK[a.family] ?? 9) - (FAMILY_RANK[z.family] ?? 9))[0];
}

/** The cards, with the capability each stands for. */
export function moreItems(b: CompetitorBrief): MoreItem[] {
  const covered = comparedCapabilityIds(b);
  const out: MoreItem[] = [];

  if (!compareRoute(b).global) {
    const directory = getPage("shopify.features");
    for (const d of DIRECTORY_CAPABILITIES) {
      if (covered.has(d.capabilityId)) continue;
      const cap = getCapability(d.capabilityId);
      if (!cap) continue;
      const { status } = capabilityFacts(d.capabilityId, d.surface);
      if (status !== "live" && status !== "beta") continue;
      const claim = claimFor(d.capabilityId, status);
      if (!claim) continue;
      const own = d.pageId ? getPage(d.pageId) : undefined;
      const href = own && canOpen(own) ? pathFor(own.pageId) : canOpen(directory) ? `${pathFor(directory.pageId)}#${d.groupId}` : undefined;
      out.push({
        capabilityId: d.capabilityId,
        item: { title: own ? cardLabel(own) : cap.label, body: claim.length <= MAX_LINE ? claim : "", status, ...(href ? { href } : {}) },
      });
    }
    return out;
  }

  // Global: what is live in production across the suite, off the Shopify-only builds (those are the Shopify directory's, and the
  // block links to it). A beta capability is left out, and so is a connector: an integration is a way to connect, and the
  // feature it serves is listed on its own.
  for (const cap of CAPABILITIES) {
    if (covered.has(cap.id) || cap.id.startsWith("integration.") || cap.id === NOT_A_FEATURE) continue;
    const impl = cap.implementations.find((i) => i.status === "live" && i.surface !== "shopify");
    if (!impl) continue;
    const { status } = capabilityFacts(cap.id, impl.surface);
    const claim = claimFor(cap.id, status);
    if (!claim) continue;
    const own = globalOwnerPage(cap.id);
    out.push({
      capabilityId: cap.id,
      item: { title: own ? cardLabel(own) : cap.label, body: claim.length <= MAX_LINE ? claim : "", status, ...(own ? { href: pathFor(own.pageId) } : {}) },
    });
  }
  return out;
}

const directoryLink = (pageId: string, label: string): LinkItem[] => (canOpen(getPage(pageId)) ? [{ label, href: pathFor(pageId) }] : []);

/** The block for a comparison page, or undefined when there is nothing beyond the table to say. */
export function buildMore(b: CompetitorBrief): MoreContent | undefined {
  const items = moreItems(b).map((m) => m.item);
  if (items.length === 0) return undefined;
  const shopifyLink = directoryLink("shopify.features", "See every Shopify feature");
  if (!compareRoute(b).global) {
    return {
      heading: "Beyond this comparison, Peakhour Suite for Shopify also does this",
      intro: "None of these is a row in the table above. Each is live or in beta on Shopify today, and its status is on the card.",
      items,
      links: shopifyLink,
    };
  }
  return {
    heading: "Beyond this comparison, Peakhour Suite also does this",
    // The sentence about Shopify stores stands only while its link is on the page.
    intro: `None of these is a row in the table above. Each is live today.${shopifyLink.length > 0 ? " Shopify stores have more, in the Shopify list." : ""}`,
    items,
    links: [...directoryLink("features.index", "See every feature"), ...shopifyLink],
  };
}
