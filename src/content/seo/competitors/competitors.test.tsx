import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/components/shared/header", () => ({ Header: () => null }));
vi.mock("@/components/shared/footer", () => ({ Footer: () => null }));

import { CompareView } from "@/app/(site)/shopify/compare/_compare-view";
const ShopifyComparePage = ({ params }: { params: Promise<{ vendor: string }> }) => params.then((p) => CompareView({ slug: p.vendor }));
import { getCapability } from "@/lib/seo/capabilities";
import { getPage, PAGES } from "@/lib/seo/pages";
import { isPreviewable, isPublishable } from "@/lib/seo/publish";
import { statusSatisfies } from "@/lib/seo/publish";
import { buildComparisonContent } from "./build";
import { COMPETITOR_BRIEFS } from "./index";
import type { VendorClaim } from "./types";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const OWN_HOSTS: Record<string, string[]> = {
  aisensy: ["aisensy.com"],
  interakt: ["www.interakt.shop", "interakt.shop"],
  "rep-ai": ["hellorep.ai"],
};
const ENV_KEYS = ["VERCEL_ENV", "SITE_INDEXABLE"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const cells = (b: (typeof COMPETITOR_BRIEFS)[number]): { who: string; cell: VendorClaim }[] =>
  b.claims.flatMap((c) => [
    { who: `${b.slug}: ${c.dimension} (vendor)`, cell: c.vendor },
    { who: `${b.slug}: ${c.dimension} (peakhour)`, cell: c.peakhour },
  ]);

describe.each(COMPETITOR_BRIEFS.map((b) => [b.slug, b] as const))("%s brief (Bible T13)", (_slug, b) => {
  it("has 6 to 10 dimensions", () => {
    expect(b.claims.length).toBeGreaterThanOrEqual(6);
    expect(b.claims.length).toBeLessThanOrEqual(10);
  });

  it("gives every Yes, Partial or Not supported cell a source URL and an ISO date", () => {
    for (const { who, cell } of cells(b)) {
      if (cell.value === "yes" || cell.value === "partial" || cell.value === "not-supported") {
        expect(cell.source?.href, who).toBeTruthy();
        expect(cell.observedAt, who).toMatch(ISO);
      }
    }
  });

  it("never says No: values come from the vocabulary and no note starts with No", () => {
    for (const { who, cell } of cells(b)) {
      expect(["yes", "partial", "not-documented", "not-supported", "unknown"], who).toContain(cell.value);
      expect(cell.note ?? "", who).not.toMatch(/^\s*no[\s.,:;]/i);
    }
  });

  it("sources the vendor's cells only from the vendor's own public pages", () => {
    for (const c of b.claims) {
      if (c.vendor.source) expect(OWN_HOSTS[b.slug], c.dimension).toContain(new URL(c.vendor.source.href).host);
    }
    for (const r of b.pricing.rows) expect(OWN_HOSTS[b.slug]).toContain(new URL(r.source.href).host);
  });

  it("carries currency, region and date on every pricing row, and states no Peakhour price in money", () => {
    expect(b.pricing.rows.length).toBeGreaterThan(0);
    for (const r of b.pricing.rows) {
      expect(r.currency).toBeTruthy();
      expect(r.region).toBeTruthy();
      expect(r.observedAt).toMatch(ISO);
      expect(r.price).toBeTruthy();
    }
    const content = buildComparisonContent(b);
    const own = content.pricing.rows.find((r) => r.vendor === "Peakhour")!;
    expect(own.price).toMatch(/Peaks/);
    expect(own.price).not.toMatch(/[₹£$€]|\b(INR|USD|GBP)\b/);
    expect(content.pricing.asOf).toMatch(ISO);
  });

  it("claims for Peakhour only what an approved capability claim supports", () => {
    for (const c of b.claims) {
      const p = c.peakhour;
      if (p.value === "unknown") {
        // A pending cell claims nothing and names what SEO-3 still has to add.
        expect(p.capabilityId, c.dimension).toBeUndefined();
        expect(p.pendingCapability, c.dimension).toBeTruthy();
        continue;
      }
      const cap = getCapability(p.capabilityId ?? "");
      expect(cap, `${c.dimension}: capability ${p.capabilityId}`).toBeDefined();
      expect(cap!.approvedClaims.length, c.dimension).toBeGreaterThan(0);
      const impl = cap!.implementations.find((i) => i.surface === "shopify") ?? cap!.implementations.find((i) => i.surface === "web");
      expect(impl, c.dimension).toBeDefined();
      for (const claim of cap!.approvedClaims) expect(statusSatisfies(impl!.status, claim.requires), c.dimension).toBe(true);
    }
  });

  it("registers a review-status page whose capabilityIds are exactly what its Peakhour cells claim", () => {
    const page = getPage(b.pageId);
    expect(page.family).toBe("shopify-compare");
    expect(page.scope).toBe("shopify");
    expect(page.surface).toBe("shopify");
    expect(page.path).toBe(`/shopify/compare/${b.slug}`);
    expect(page.editorialStatus).toBe("review");
    expect(page.indexable).toBe(false);
    expect(page.title.length).toBeLessThanOrEqual(60);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(page.h1).toBe(b.h1);
    expect(page.primaryCta.kind).toBe("waitlist");
    const claimed = new Set(b.claims.map((c) => c.peakhour.capabilityId).filter(Boolean));
    expect(new Set(page.capabilityIds)).toEqual(claimed);
    for (const id of page.relatedIds) expect(PAGES.some((p) => p.pageId === id)).toBe(true);
  });

  it("is not publishable, is previewable off production, and is a 404 on production", async () => {
    const page = getPage(b.pageId);
    expect(isPublishable(page)).toBe(false);
    expect(isPreviewable(page, { VERCEL_ENV: "production" })).toBe(false);
    expect(isPreviewable(page, { VERCEL_ENV: "preview" })).toBe(true);

    process.env.VERCEL_ENV = "production";
    await expect(ShopifyComparePage({ params: Promise.resolve({ vendor: b.slug }) })).rejects.toThrow("NEXT_NOT_FOUND");

    process.env.VERCEL_ENV = "preview";
    const el = await ShopifyComparePage({ params: Promise.resolve({ vendor: b.slug }) });
    const html = renderToStaticMarkup(el);
    expect(html).toContain(b.h1);
    expect(html).toContain("Draft, not published");
    expect(html).toContain("Not documented");
  });
});

describe("the route", () => {
  it("404s an unknown vendor", async () => {
    process.env.VERCEL_ENV = "preview";
    await expect(ShopifyComparePage({ params: Promise.resolve({ vendor: "nope" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
