import type { DirectoryItem, LinkItem, MoreContent } from "@/components/marketing/seo/content-types";
import { DIRECTORY_CAPABILITIES } from "@/content/pages/shopify.features";
import { CAPABILITIES, getCapability } from "@/lib/seo/capabilities";
import { cardLabel } from "@/lib/seo/labels";
import { PAGES, getPage } from "@/lib/seo/pages";
import { isPreviewable, isPublishable, statusSatisfies } from "@/lib/seo/publish";
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

// A comparison is not a feature page, and a hub (family core) covers a whole pillar, so neither is the page ABOUT one capability.
const NOT_FEATURE_PAGES: readonly PageFamily[] = ["compare", "shopify-compare", "core"];

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

/** The first sentence of a claim: shorter than the claim, never different from it. */
export function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s/)[0] ?? text;
}

/** The shortest approved claim the status satisfies, as its first sentence; undefined when none is satisfied. */
function claimFor(capabilityId: string, status: ReleaseStatus): string | undefined {
  const cap = getCapability(capabilityId);
  const ok = cap?.approvedClaims.filter((c) => statusSatisfies(status, c.requires)) ?? [];
  if (ok.length === 0) return undefined;
  return firstSentence([...ok].sort((a, b) => a.text.length - b.text.length)[0]!.text);
}

/** Whether a visitor can open `target` from the comparison page: a published page links only to published pages, a draft to any previewable one. */
function openable(selfPublic: boolean, target: PageRecord): boolean {
  return selfPublic ? isPublishable(target) : isPublishable(target) || isPreviewable(target);
}

const FAMILY_RANK: Partial<Record<PageFamily, number>> = { feature: 0, "shopify-feature": 1, integration: 2 };

/**
 * The page that is ABOUT a capability, so the card's label and link say what its claim says: the directory's own page for it, else
 * a page that lists it alone, else one that lists it first. A page that merely mentions it among several is not its page.
 */
function ownerPage(capabilityId: string, selfPublic: boolean): PageRecord | undefined {
  const designated = DIRECTORY_CAPABILITIES.find((d) => d.capabilityId === capabilityId)?.pageId;
  if (designated && openable(selfPublic, getPage(designated))) return getPage(designated);
  const candidates = [
    ...PAGES.filter((p) => p.capabilityIds.length === 1 && p.capabilityIds[0] === capabilityId),
    ...PAGES.filter((p) => p.capabilityIds[0] === capabilityId),
  ].filter((p) => !NOT_FEATURE_PAGES.includes(p.family) && openable(selfPublic, p));
  return candidates.sort((a, z) => (FAMILY_RANK[a.family] ?? 9) - (FAMILY_RANK[z.family] ?? 9))[0];
}

/** The cards, with the capability each stands for. */
export function moreItems(b: CompetitorBrief, page: PageRecord = getPage(b.pageId)): MoreItem[] {
  const covered = comparedCapabilityIds(b);
  const selfPublic = isPublishable(page);
  const out: MoreItem[] = [];

  if (!compareRoute(b).global) {
    const directory = getPage("shopify.features");
    for (const d of DIRECTORY_CAPABILITIES) {
      if (covered.has(d.capabilityId)) continue;
      const cap = getCapability(d.capabilityId);
      const impl = cap?.implementations.find((i) => i.surface === d.surface);
      if (!cap || !impl || (impl.status !== "live" && impl.status !== "beta")) continue;
      const body = claimFor(d.capabilityId, impl.status);
      if (!body) continue;
      const own = d.pageId ? getPage(d.pageId) : undefined;
      const href =
        own && openable(selfPublic, own)
          ? pathFor(own.pageId)
          : openable(selfPublic, directory)
            ? `${pathFor(directory.pageId)}#${d.groupId}`
            : undefined;
      out.push({
        capabilityId: d.capabilityId,
        item: { title: own ? cardLabel(own) : cap.label, body, status: impl.status, ...(href ? { href } : {}) },
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
    const body = claimFor(cap.id, impl.status);
    if (!body) continue;
    const own = ownerPage(cap.id, selfPublic);
    out.push({ capabilityId: cap.id, item: { title: own ? cardLabel(own) : cap.label, body, status: impl.status, ...(own ? { href: pathFor(own.pageId) } : {}) } });
  }
  return out;
}

const directoryLink = (selfPublic: boolean, pageId: string, label: string): LinkItem[] =>
  openable(selfPublic, getPage(pageId)) ? [{ label, href: pathFor(pageId) }] : [];

/** The block for a comparison page, or undefined when there is nothing beyond the table to say. */
export function buildMore(b: CompetitorBrief, page: PageRecord = getPage(b.pageId)): MoreContent | undefined {
  const items = moreItems(b, page).map((m) => m.item);
  if (items.length === 0) return undefined;
  const selfPublic = isPublishable(page);
  return compareRoute(b).global
    ? {
        heading: "Beyond this comparison, Peakhour Suite also does this",
        intro: "None of these is a row in the table above. Each is live today. Shopify stores have more, in the Shopify list.",
        items,
        links: [...directoryLink(selfPublic, "features.index", "See every feature"), ...directoryLink(selfPublic, "shopify.features", "See every Shopify feature")],
      }
    : {
        heading: "Beyond this comparison, Peakhour Suite for Shopify also does this",
        intro: "None of these is a row in the table above. Each is live or in beta on Shopify today, and its status is on the card.",
        items,
        links: directoryLink(selfPublic, "shopify.features", "See every Shopify feature"),
      };
}
