import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftRibbon, isDraftPage, ribbonKind } from "@/components/marketing/seo/draft-ribbon";
import type { PageApproval } from "./approvals";
import { PAGES, getPage } from "./pages";
import { buildComparisonContent } from "@/content/seo/competitors/build";
import { getBrief } from "@/content/seo/competitors";
import { overlayApprovals, type ReviewManifest } from "./review-manifest-data";
import { approvalFor, approvalState, cmsReviewer, canOpen, needsApproval, capabilitiesSatisfied, currentContentHash, isPreviewable, isPublishable } from "./publish";

const DEV = { VERCEL_ENV: "preview" };
const PROD = { VERCEL_ENV: "production" };

const approve = (pageId: string, over: Partial<PageApproval> = {}): PageApproval => ({
  pageId,
  contentHash: currentContentHash(pageId) as string,
  reviewer: "Asha Rao",
  approvedAt: "2026-11-16",
  source: "cms",
  ...over,
});
const STALE = `sha256:${"0".repeat(64)}`;

describe("the publish rule with approvals", () => {
  it("keeps today's published pages published: the count is 53 before the rule and 53 after", () => {
    const before = PAGES.filter((p) => p.editorialStatus === "published" && p.indexable && capabilitiesSatisfied(p));
    const after = PAGES.filter((p) => isPublishable(p));
    expect(before).toHaveLength(53);
    expect(after.map((p) => p.pageId)).toEqual(before.map((p) => p.pageId));
  });

  it("holds back a published page that makes claims and has no approval, and one whose approval is for older content", () => {
    const page = getPage("shopify.features.ai.seo");
    expect(isPublishable(page, "en", [])).toBe(false);
    expect(isPublishable(page, "en", [approve(page.pageId, { contentHash: STALE })])).toBe(false);
    expect(isPublishable(page, "en", [approve(page.pageId)])).toBe(true);
    expect(approvalState(page.pageId, [])).toBe("none");
    expect(approvalState(page.pageId, [approve(page.pageId, { contentHash: STALE })])).toBe("stale");
  });

  it("needs no approval for a published page that makes no claim", () => {
    const page = getPage("legal.terms");
    expect(page.capabilityIds).toHaveLength(0);
    expect(isPublishable(page, "en", [])).toBe(true);
  });

  it("approval alone publishes: a review page with a matching cms row is publishable, with no registry edit", () => {
    const page = getPage("shopify.compare.wati");
    expect(page.editorialStatus).toBe("review");
    expect(page.indexable).toBe(false);
    expect(isPublishable(page, "en", [])).toBe(false);
    expect(isPublishable(page, "en", [approve(page.pageId)])).toBe(true);
    // ...and only at its current content.
    expect(isPublishable(page, "en", [approve(page.pageId, { contentHash: STALE })])).toBe(false);
  });

  it("does not publish a review page on a placeholder row", () => {
    const page = getPage("shopify.compare.wati");
    expect(isPublishable(page, "en", [approve(page.pageId, { source: "placeholder" })])).toBe(false);
  });

  it("uses the last row for a page, and never publishes a draft, an idea or an archived page", () => {
    const page = getPage("shopify.compare.wati");
    expect(isPublishable(page, "en", [approve(page.pageId, { contentHash: STALE }), approve(page.pageId)])).toBe(true);
    expect(isPublishable(page, "en", [approve(page.pageId), approve(page.pageId, { contentHash: STALE })])).toBe(false);
    for (const status of ["draft", "idea", "briefed", "archived", "approved"] as const) {
      expect(isPublishable({ ...page, editorialStatus: status }, "en", [approve(page.pageId)]), status).toBe(false);
    }
  });

  it("still enforces the capability gate and the locale on an approved page", () => {
    const page = getPage("shopify.compare.wati");
    expect(isPublishable({ ...page, capabilityIds: ["no.such.capability"] }, "en", [approve(page.pageId)])).toBe(false);
    expect(isPublishable(page, "fr", [approve(page.pageId)])).toBe(false);
  });

  it("opens a held-back page on dev only, and a review page as before", () => {
    const wati = getPage("shopify.compare.wati");
    expect(canOpen(wati, DEV)).toBe(true);
    expect(canOpen(wati, PROD)).toBe(false);
    // A published page with claims and no approval on file: a preview on dev, a 404 on production.
    const held = { ...getPage("shopify.features.ai.seo"), pageId: "not.in.the.hashes" };
    expect(isPreviewable(held, DEV)).toBe(true);
    expect(isPreviewable(held, PROD)).toBe(false);
    // A published page with its approval is the real page, not a preview.
    expect(isPreviewable(getPage("shopify.features.ai.seo"), DEV)).toBe(false);
  });
});

describe("the ribbon", () => {
  const seo = getPage("shopify.features.ai.seo");
  const wati = getPage("shopify.compare.wati");

  it("says nothing on a published page with a current approval", () => {
    expect(ribbonKind(seo, [approve(seo.pageId)])).toBeNull();
    // ...but the committed approval for this page is a placeholder (AR-5), so the page itself still carries the dev-only ribbon.
    expect(isDraftPage(seo)).toBe(true);
    expect(isDraftPage(getPage("home"))).toBe(false);
  });

  it("says Draft, not published when there is no approval", () => {
    expect(ribbonKind(wati, [])).toBe("draft");
    expect(ribbonKind(seo, [])).toBe("draft");
    expect(ribbonKind({ ...seo, editorialStatus: "draft" }, [approve(seo.pageId)])).toBe("draft");
  });

  it("says Changed since approval when an approval exists for different content", () => {
    expect(ribbonKind(wati, [approve(wati.pageId, { contentHash: STALE })])).toBe("changed");
    expect(ribbonKind(seo, [approve(seo.pageId, { contentHash: STALE })])).toBe("changed");
  });

  it("says nothing on an approved review page", () => {
    expect(ribbonKind(wati, [approve(wati.pageId)])).toBeNull();
  });

  it("still says Draft on an approved review page whose capability gate fails (production would 404 it)", () => {
    const failing = { ...wati, capabilityIds: ["no.such.capability"] };
    expect(ribbonKind(failing, [approve(wati.pageId)])).toBe("draft");
  });

  it("renders the draft wording, and nothing for a published page", () => {
    // wati has no approval in the committed file, so the real ribbon is the draft one.
    expect(renderToStaticMarkup(<DraftRibbon page={wati} />)).toContain("Draft, not published");
    expect(renderToStaticMarkup(<DraftRibbon page={getPage("home")} />)).toBe("");
  });
});

describe("the reviewer a CMS approval names", () => {
  const wati = getPage("shopify.compare.wati");
  const brief = getBrief("wati")!;

  it("is the reviewer of a current cms approval, and never a placeholder or a stale one", () => {
    expect(cmsReviewer(wati.pageId, [approve(wati.pageId)])).toBe("Asha Rao");
    expect(cmsReviewer(wati.pageId, [approve(wati.pageId, { source: "placeholder" })])).toBeNull();
    expect(cmsReviewer(wati.pageId, [approve(wati.pageId, { contentHash: STALE })])).toBeNull();
    expect(cmsReviewer(wati.pageId, [])).toBeNull();
  });

  it("replaces the brief's reviewer (or Pending review) on the comparison, and meets the published-needs-a-reviewer rule", () => {
    expect(buildComparisonContent(brief, wati, []).reviewer).toBe("Pending review");
    expect(buildComparisonContent(brief, wati, [approve(wati.pageId)]).reviewer).toBe("Asha Rao");
    expect(buildComparisonContent({ ...brief, reviewer: "A. Reviewer" }, wati, [approve(wati.pageId)]).reviewer).toBe("Asha Rao");
    const published = { ...wati, editorialStatus: "published" as const };
    expect(() => buildComparisonContent(brief, published, [])).toThrow(/reviewer/);
    expect(() => buildComparisonContent(brief, published, [approve(wati.pageId, { source: "placeholder" })])).toThrow(/reviewer/);
    expect(buildComparisonContent(brief, published, [approve(wati.pageId)]).reviewer).toBe("Asha Rao");
  });

  it("is exposed in the manifest as reviewedBy, null for a placeholder", () => {
    const base = { version: 1, pages: [{ pageId: wati.pageId, contentHash: currentContentHash(wati.pageId), approval: null, reviewedBy: null }] } as unknown as ReviewManifest;
    expect(overlayApprovals(base, [approve(wati.pageId)]).pages[0].reviewedBy).toBe("Asha Rao");
    expect(overlayApprovals(base, [approve(wati.pageId, { source: "placeholder" })]).pages[0].reviewedBy).toBeNull();
    expect(overlayApprovals(base, [approve(wati.pageId, { contentHash: STALE })]).pages[0].reviewedBy).toBeNull();
  });
});

describe("AR-5: on production only a CMS approval publishes a page that makes claims", () => {
  const seo = getPage("shopify.features.ai.seo");
  const placeholder = (id: string) => approve(id, { source: "placeholder" });

  it("a placeholder claim page is unpublishable on production and a cms-approved one is publishable", () => {
    expect(isPublishable(seo, "en", [placeholder(seo.pageId)], PROD)).toBe(false);
    expect(isPublishable(seo, "en", [approve(seo.pageId)], PROD)).toBe(true);
    // a stale cms row still does not publish
    expect(isPublishable(seo, "en", [approve(seo.pageId, { contentHash: STALE })], PROD)).toBe(false);
  });

  it("dev and previews are unchanged: a placeholder still counts", () => {
    expect(isPublishable(seo, "en", [placeholder(seo.pageId)], DEV)).toBe(true);
    expect(isPublishable(seo, "en", [placeholder(seo.pageId)], {})).toBe(true);
    expect(isPublishable(seo, "en", [approve(seo.pageId)], DEV)).toBe(true);
  });

  it("SITE_INDEXABLE=false only controls noindex: production still hides a placeholder claim page", () => {
    expect(isPublishable(seo, "en", [placeholder(seo.pageId)], { VERCEL_ENV: "production", SITE_INDEXABLE: "false" })).toBe(false);
    expect(isPublishable(seo, "en", [approve(seo.pageId)], { VERCEL_ENV: "production", SITE_INDEXABLE: "false" })).toBe(true);
  });

  it("production with SITE_INDEXABLE=false never renders a draft: 404 and no ribbon", () => {
    const noindexProd = { VERCEL_ENV: "production", SITE_INDEXABLE: "false" };
    const draft = getPage("shopify.compare.wati");
    expect(isPreviewable(draft, DEV)).toBe(true);
    expect(isPreviewable(draft, noindexProd)).toBe(false);
    expect(canOpen(draft, noindexProd)).toBe(false);
    // a claim page held back by the approval rule is no preview either
    const held = { ...seo, editorialStatus: "published" as const };
    expect(isPreviewable(held, noindexProd)).toBe(false);
  });

  it("a page with no claim is unaffected", () => {
    for (const id of ["home", "pricing", "legal.terms", "contact"]) {
      const page = getPage(id);
      expect(page.capabilityIds, id).toHaveLength(0);
      expect(isPublishable(page, "en", [], PROD), id).toBe(true);
    }
  });

  it("canOpen follows the injected environment: a placeholder claim page does not open on production", () => {
    // canOpen reads the committed approvals: pick a page that is on a placeholder there.
    const onPlaceholder = PAGES.find((p) => p.capabilityIds.length > 0 && isPublishable(p, "en", undefined, {}) && approvalFor(p.pageId)?.source !== "cms");
    expect(onPlaceholder).toBeDefined();
    expect(canOpen(onPlaceholder!, DEV)).toBe(true);
    expect(canOpen(onPlaceholder!, PROD)).toBe(false);
  });

  it("the ribbon says the page is live on dev only when it rests on a placeholder, and nothing once a CMS row exists", () => {
    expect(ribbonKind(seo, [placeholder(seo.pageId)])).toBe("devOnly");
    expect(ribbonKind(seo, [approve(seo.pageId)])).toBeNull();
    expect(renderToStaticMarkup(<DraftRibbon page={seo} />)).toContain("Live on dev only: needs a CMS approval before it shows on production.");
    expect(renderToStaticMarkup(<DraftRibbon page={getPage("home")} />)).toBe("");
  });

  it("pins today's numbers: 53 published on dev, 16 on production", () => {
    expect(PAGES.filter((p) => isPublishable(p, "en", undefined, {}))).toHaveLength(53);
    const onProd = PAGES.filter((p) => isPublishable(p, "en", undefined, PROD));
    expect(onProd).toHaveLength(16);
    // every production page either needs no approval or carries a cms one
    for (const p of onProd) expect(!needsApproval(p) || approvalFor(p.pageId)?.source === "cms", p.pageId).toBe(true);
  });

  it("the sitemap, the footer and the directory agree with isPublishable on production", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    vi.doMock("@/lib/marketing-pages", () => ({ getMarketingSitemapEntries: async () => [] }));
    try {
      const { sitemapEntries, SITEMAP_NAMES } = await import("./sitemap");
      const listed = new Set<string>();
      for (const n of SITEMAP_NAMES.filter((x) => x !== "cms")) for (const e of await sitemapEntries(n, PROD)) listed.add(new URL(e.url).pathname);
      const expected = PAGES.filter((p) => isPublishable(p, "en", undefined, PROD)).map((p) => p.path);
      expect([...listed].sort()).toEqual([...expected].sort());
    } finally {
      vi.doUnmock("@/lib/marketing-pages");
      vi.resetModules();
    }
  });
});
