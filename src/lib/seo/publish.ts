import { PAGE_APPROVALS, type PageApproval } from "./approvals";
import CONTENT_HASHES from "./content-hashes.json";
import { isProductionDeployment } from "./indexable";
import { getCapability } from "./capabilities";
import { DEFAULT_LOCALE, PUBLISHED_LOCALES, type Capability, type Locale, type PageRecord, type ReleaseStatus } from "./types";

/*
 * The publish gate (named publish.ts: gate.ts is the coming-soon gate and stays as it is).
 *
 * A page is publishable, meaning it may be indexed, listed in the sitemap and shown on
 * production, only when every one of these holds. This module only ANSWERS: pageMeta turns a "no" into
 * noindex and the sitemap leaves the page out. A route that must 404 on production (the SEO-5 templates,
 * with isPreviewable for the dev draft ribbon) calls isPublishable itself.
 */

const RANK: Record<ReleaseStatus, number> = {
  idea: 0,
  planned: 1,
  development: 2,
  beta: 3,
  live: 4,
  // A paused or retired capability satisfies no claim.
  paused: -1,
  retired: -1,
};

/** Whether an implementation at `status` satisfies a claim that `requires` beta or live. */
export function statusSatisfies(status: ReleaseStatus, requires: "beta" | "live"): boolean {
  return RANK[status] >= RANK[requires];
}

/** The implementation a page's claims are judged on: its own surface, else "web", else "whatsapp" (a channel that serves every platform). */
export function implementationFor(page: Pick<PageRecord, "surface">, cap: Capability) {
  return (
    cap.implementations.find((i) => i.surface === page.surface) ??
    cap.implementations.find((i) => i.surface === "web") ??
    cap.implementations.find((i) => i.surface === "whatsapp")
  );
}

/**
 * Every capability the page leans on must have an implementation on the page's surface, else on
 * "web", else on "whatsapp" (WhatsApp is a channel that serves every platform, so its build counts
 * for a Shopify or WordPress page too), and that implementation's status must satisfy every approved
 * claim the capability carries (Bible T12: a "live" claim needs a live capability).
 */
export function capabilitiesSatisfied(page: PageRecord): boolean {
  return page.capabilityIds.every((id) => {
    const cap = getCapability(id);
    if (!cap) return false;
    const impl = implementationFor(page, cap);
    if (!impl) return false;
    return cap.approvedClaims.every((claim) => statusSatisfies(impl.status, claim.requires));
  });
}

/*
 * Approvals (AR-1). The content hash of every page is generated into content-hashes.json by
 * scripts/seo/review-manifest.ts, and review-manifest.test.ts fails when the file is stale, so this module can read the
 * "current hash" without importing the page copy (which would make a cycle with the registry).
 */
const HASHES: Record<string, string> = CONTENT_HASHES;

/** The page's current content hash: what a reader sees and every claim it makes. Undefined for a page the generator has not seen. */
export function currentContentHash(pageId: string): string | undefined {
  return HASHES[pageId];
}

/** The approval on file for a page: the LAST row for its id (the api replaces a row by removing the older line). */
export function approvalFor(pageId: string, approvals: readonly PageApproval[] = PAGE_APPROVALS): PageApproval | undefined {
  for (let i = approvals.length - 1; i >= 0; i--) if (approvals[i].pageId === pageId) return approvals[i];
  return undefined;
}

/**
 * The reviewer a page's byline names when it is live through an approval: the reviewer of a CURRENT `source: "cms"` row.
 * A placeholder row never counts (it records a page that was already published, not a review), nor does a stale one.
 */
export function cmsReviewer(pageId: string, approvals: readonly PageApproval[] = PAGE_APPROVALS): string | null {
  const a = approvalFor(pageId, approvals);
  return a && a.source === "cms" && a.contentHash === currentContentHash(pageId) && a.reviewer.trim() !== "" ? a.reviewer : null;
}

/** "current": an approval carries the page's present hash. "stale": an approval exists for older content. "none": no approval. */
export type ApprovalState = "current" | "stale" | "none";

export function approvalState(pageId: string, approvals: readonly PageApproval[] = PAGE_APPROVALS): ApprovalState {
  const a = approvalFor(pageId, approvals);
  if (!a) return "none";
  return a.contentHash === currentContentHash(pageId) ? "current" : "stale";
}

/**
 * Whether the page, as `published`, still has to be approved: it makes claims (names a capability). A page with no
 * claim (the legal pages, the contact page) needs no approval to stay published.
 */
export function needsApproval(page: Pick<PageRecord, "capabilityIds">): boolean {
  return page.capabilityIds.length > 0;
}

/**
 * ★ THE APPROVAL RULE. A page that makes claims is publishable only while an approval carries its current content hash.
 * ★ APPROVAL ALONE PUBLISHES: an `editorialStatus: "review"` page with a matching approval (a `source: "cms"` row) is
 *   publishable with no edit to the registry, and its `indexable: false` (the registry's "held" marker for a draft) does
 *   not hold it back. The CMS approval screen therefore only ever edits src/lib/seo/approvals.ts. The capability gate
 *   still applies on top: an approved page whose claim is not satisfied stays unpublished.
 * ★ ON PRODUCTION (isProductionDeployment(env): VERCEL_ENV, never the SITE_INDEXABLE switch) the approval must be `source: "cms"` for a published page too: a placeholder
 *   row publishes on dev and previews only. `env` is injectable like isPreviewable's, so a test can set the deployment.
 * Draft, idea, briefed and archived pages are never publishable, approved or not.
 */
export function isPublishable(
  page: PageRecord,
  locale: Locale = DEFAULT_LOCALE,
  approvals: readonly PageApproval[] = PAGE_APPROVALS,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const approved = approvalState(page.pageId, approvals) === "current";
  if (page.editorialStatus === "published") {
    if (!page.indexable) return false;
    if (needsApproval(page) && !approved) return false;
    // ★ AR-5: on production only a CMS approval publishes a page that makes claims. A placeholder row records a page that
    //   was already live before approvals existed; dev and previews honour it, production does not.
    if (needsApproval(page) && isProductionDeployment(env) && approvalFor(page.pageId, approvals)?.source !== "cms") return false;
  } else if (page.editorialStatus === "review") {
    // Only a CMS approval publishes a review page; a placeholder row records a page that was already published.
    if (!approved || approvalFor(page.pageId, approvals)?.source !== "cms") return false;
  } else {
    return false;
  }
  if (!PUBLISHED_LOCALES.includes(locale)) return false;
  if (locale !== DEFAULT_LOCALE) {
    if (page.locales?.[locale as Exclude<Locale, "en">]?.status !== "published") return false;
  }
  return capabilitiesSatisfied(page);
}

/**
 * ★ AUTHORED MODE, for the content hash only. A page's copy leaves out a link to a page that is not open (siblingLink,
 * the brand-voice link), so what a reader sees depends on whether ANOTHER page is approved. An approval must not move
 * the hash of every page that links to the newly approved one, so the hash is computed with every link present: the
 * review manifest script and its tests set REVIEW_HASH_MODE=authored before they import the copy. Content modules ask
 * `isLinkable`, never `isPublishable`, when they decide whether to show a link; everywhere else it is `isPublishable`.
 */
export const AUTHORED_MODE_ENV = "REVIEW_HASH_MODE";

export function isAuthoredMode(env: Record<string, string | undefined> = process.env): boolean {
  return env[AUTHORED_MODE_ENV] === "authored";
}

/** Whether a page's copy may link to this page: it is open, or the hash is being computed over the authored copy. */
export function isLinkable(page: PageRecord): boolean {
  return isAuthoredMode() || isPublishable(page);
}

/**
 * Draft, review and approved pages render with a "Draft, not published" ribbon on dev and on
 * previews, so the team can read them in place; a published page held back by the approval rule shows the same way
 * ("Draft, not published" with no approval, "Changed since approval" with an older one). Production 404s them.
 */
export function isPreviewable(page: PageRecord, env: Record<string, string | undefined> = process.env): boolean {
  if (isProductionDeployment(env)) return false;
  if (page.editorialStatus === "draft" || page.editorialStatus === "review" || page.editorialStatus === "approved") return true;
  // A published page the approval rule holds back (no approval, or content changed since) shows on dev under its ribbon.
  return page.editorialStatus === "published" && page.indexable && needsApproval(page) && approvalState(page.pageId) !== "current";
}

/** Live on dev only: publishable here on a placeholder approval, but production needs a CMS approval before it shows. */
export function isDevOnly(page: PageRecord, approvals: readonly PageApproval[] = PAGE_APPROVALS): boolean {
  return isPublishable(page, DEFAULT_LOCALE, approvals, {}) && !isPublishable(page, DEFAULT_LOCALE, approvals, { VERCEL_ENV: "production" });
}

/** Whether a visitor can open the page: published (production) or a draft, review or approved page off production. The one test every route and link uses. */
export function canOpen(page: PageRecord, env: Record<string, string | undefined> = process.env): boolean {
  return isPublishable(page, DEFAULT_LOCALE, PAGE_APPROVALS, env) || isPreviewable(page, env);
}
