import { createHash } from "node:crypto";
import { COMPETITOR_BRIEFS, type CompetitorBrief } from "@/content/seo/competitors";
import { PAGE_APPROVALS, type PageApproval } from "./approvals";
import { getCapability } from "./capabilities";
import { PAGES } from "./pages";
import { implementationFor } from "./publish";
import { PAGE_COPY } from "./review-copy";
import { DEV_ORIGIN, approvalFields, type ReviewManifest, type ReviewManifestPage } from "./review-manifest-data";
import type { PageRecord } from "./types";

export { DEV_ORIGIN, overlayApprovals, withoutApprovals, type ReviewManifest, type ReviewManifestPage } from "./review-manifest-data";

/*
 * The review manifest (AR-1): every registry page as the CMS approval screen needs it, with the content hash an
 * approval is pinned to. Server-side and build-time only (it imports every page's copy): the browser and the publish
 * gate read its generated outputs, never this module.
 *
 *   npx tsx scripts/seo/review-manifest.ts --write   rewrites docs/seo/review-manifest.json and src/lib/seo/content-hashes.json
 *
 * review-manifest.test.ts fails when either committed file is not what the registry produces now.
 */

/** JSON with every object's keys sorted and undefined dropped: the same data always gives the same text. Throws on a function, a symbol or a non-plain object. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value, "$"));
}

function sortValue(v: unknown, at: string): unknown {
  if (v === null || typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`canonicalJson: ${at} is not a finite number`);
    return v;
  }
  if (Array.isArray(v)) return v.map((x, i) => sortValue(x === undefined ? null : x, `${at}[${i}]`));
  if (typeof v === "object") {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) throw new Error(`canonicalJson: ${at} is not a plain object`);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined) out[k] = sortValue(x, `${at}.${k}`);
    }
    return out;
  }
  throw new Error(`canonicalJson: ${at} is a ${typeof v}, not data`);
}

const BRIEFS_BY_PAGE = new Map<string, CompetitorBrief>(COMPETITOR_BRIEFS.map((b) => [b.pageId, b]));

function claimsOf(page: PageRecord): ReviewManifestPage["claims"] {
  const out: ReviewManifestPage["claims"] = [];
  for (const id of page.capabilityIds) {
    const cap = getCapability(id);
    if (!cap) throw new Error(`${page.pageId} names the unknown capability "${id}"`);
    const status = implementationFor(page, cap)?.status ?? "none";
    for (const c of cap.approvedClaims) out.push({ id: c.id, text: c.text, status });
  }
  return out;
}

const cellText = (c: { value: string; note?: string }) => (c.note ? `${c.value}: ${c.note}` : c.value);

function comparisonOf(b: CompetitorBrief): NonNullable<ReviewManifestPage["comparison"]> {
  return {
    vendor: b.name,
    rows: b.claims.map((r) => ({
      dimension: r.dimension,
      peakhour: cellText(r.peakhour),
      vendor: cellText(r.vendor),
      ...(r.vendor.source ? { sourceUrl: r.vendor.source.href } : {}),
      ...(r.vendor.observedAt ? { observedAt: r.vendor.observedAt } : {}),
    })),
    pricing: b.pricing.rows.map((p) => ({
      plan: p.plan,
      price: p.price,
      currency: p.currency,
      region: p.region,
      sourceUrl: p.source.href,
      observedAt: p.observedAt,
    })),
  };
}

/**
 * The content hash of a page. It covers everything a reader sees and every claim: the registry's title, description, H1,
 * call to action and related links; the claims (ids and texts) of the capabilities it names; the page's copy where it
 * lives in a data module (review-copy.ts); and for a comparison the whole brief (every cell with its source and date,
 * every pricing row, the answers and the limits).
 *
 * It deliberately leaves out the approval and the editorialStatus (approving or publishing would change the hash it
 * is pinned to), and the owner and lastReviewedAt (bookkeeping, not what a reader sees).
 */
export function contentHashOf(page: PageRecord): string {
  const brief = BRIEFS_BY_PAGE.get(page.pageId);
  const input = {
    pageId: page.pageId,
    path: page.path,
    family: page.family,
    title: page.title,
    description: page.description,
    h1: page.h1,
    primaryCta: page.primaryCta,
    relatedIds: page.relatedIds,
    claims: claimsOf(page).map(({ id, text }) => ({ id, text })),
    copy: PAGE_COPY[page.pageId] ?? null,
    brief: brief ?? null,
  };
  return `sha256:${createHash("sha256").update(canonicalJson(input)).digest("hex")}`;
}

/** The manifest for the registry (published and review pages; a draft, idea or archived page is not up for review), sorted by pageId. */
export function buildReviewManifest(
  pages: readonly PageRecord[] = PAGES,
  approvals: readonly PageApproval[] = PAGE_APPROVALS,
): ReviewManifest {
  const rows: ReviewManifestPage[] = [];
  for (const p of pages) {
    if (p.editorialStatus !== "published" && p.editorialStatus !== "review") continue;
    const brief = BRIEFS_BY_PAGE.get(p.pageId);
    const hash = contentHashOf(p);
    rows.push({
      pageId: p.pageId,
      path: p.path,
      family: p.family,
      title: p.title,
      editorialStatus: p.editorialStatus,
      devUrl: `${DEV_ORIGIN}${p.path}`,
      claims: claimsOf(p),
      ...(brief ? { comparison: comparisonOf(brief) } : {}),
      contentHash: hash,
      ...approvalFields(p.pageId, hash, approvals),
    });
  }
  rows.sort((a, b) => (a.pageId < b.pageId ? -1 : a.pageId > b.pageId ? 1 : 0));
  return { version: 1, pages: rows };
}

/** pageId to content hash, sorted: the small file the publish gate reads (src/lib/seo/content-hashes.json). */
export function contentHashMap(manifest: ReviewManifest): Record<string, string> {
  return Object.fromEntries(manifest.pages.map((p) => [p.pageId, p.contentHash]));
}
