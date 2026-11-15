import { isIndexableDeployment } from "./indexable";
import { getCapability } from "./capabilities";
import { DEFAULT_LOCALE, PUBLISHED_LOCALES, type Locale, type PageRecord, type ReleaseStatus } from "./types";

/*
 * The publish gate (named publish.ts: gate.ts is the coming-soon gate and stays as it is).
 *
 * A page is publishable, meaning it may be indexed, listed in the sitemap and shown on
 * production, only when every one of these holds. A page that fails renders 404 on
 * production (and, with isPreviewable, a draft ribbon on dev).
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

/**
 * Every capability the page leans on must have an implementation on the page's surface (or on
 * "web" when it has none there), and that implementation's status must satisfy every approved
 * claim the capability carries (Bible T12: a "live" claim needs a live capability).
 */
export function capabilitiesSatisfied(page: PageRecord): boolean {
  return page.capabilityIds.every((id) => {
    const cap = getCapability(id);
    if (!cap) return false;
    const impl =
      cap.implementations.find((i) => i.surface === page.surface) ??
      cap.implementations.find((i) => i.surface === "web");
    if (!impl) return false;
    return cap.approvedClaims.every((claim) => statusSatisfies(impl.status, claim.requires));
  });
}

export function isPublishable(page: PageRecord, locale: Locale = DEFAULT_LOCALE): boolean {
  if (page.editorialStatus !== "published") return false;
  if (!page.indexable) return false;
  if (!PUBLISHED_LOCALES.includes(locale)) return false;
  if (locale !== DEFAULT_LOCALE) {
    if (page.locales?.[locale as Exclude<Locale, "en">]?.status !== "published") return false;
  }
  return capabilitiesSatisfied(page);
}

/**
 * Draft, review and approved pages render with a "Draft, not published" ribbon on dev and on
 * previews, so the team can read them in place. Production 404s them.
 */
export function isPreviewable(page: PageRecord, env: Record<string, string | undefined> = process.env): boolean {
  if (isIndexableDeployment(env)) return false;
  return page.editorialStatus === "draft" || page.editorialStatus === "review" || page.editorialStatus === "approved";
}
