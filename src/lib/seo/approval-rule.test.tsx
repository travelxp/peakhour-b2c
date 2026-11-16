import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftRibbon, isDraftPage, ribbonKind } from "@/components/marketing/seo/draft-ribbon";
import type { PageApproval } from "./approvals";
import { PAGES, getPage } from "./pages";
import { approvalState, canOpen, capabilitiesSatisfied, currentContentHash, isPreviewable, isPublishable } from "./publish";

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
    expect(isDraftPage(seo)).toBe(false);
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
