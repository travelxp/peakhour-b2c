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

// The real route files, not a wrapper.
import AisensyPage, { metadata as aisensyMeta } from "@/app/(site)/shopify/compare/aisensy/page";
import InteraktPage, { metadata as interaktMeta } from "@/app/(site)/shopify/compare/interakt/page";
import RepAiPage, { metadata as repMeta } from "@/app/(site)/shopify/compare/rep-ai/page";
import RebuyPage, { metadata as rebuyMeta } from "@/app/(site)/shopify/compare/rebuy/page";
import LimespotPage, { metadata as limespotMeta } from "@/app/(site)/shopify/compare/limespot/page";
import NostoPage, { metadata as nostoMeta } from "@/app/(site)/shopify/compare/nosto/page";
import TinyimgPage, { metadata as tinyimgMeta } from "@/app/(site)/shopify/compare/tinyimg/page";
import SearchpiePage, { metadata as searchpieMeta } from "@/app/(site)/shopify/compare/searchpie/page";
import SeowillPage, { metadata as seowillMeta } from "@/app/(site)/shopify/compare/seowill/page";
import HootsuitePage, { metadata as hootsuiteMeta } from "@/app/(site)/compare/hootsuite/page";
import BufferPage, { metadata as bufferMeta } from "@/app/(site)/compare/buffer/page";
import JasperPage, { metadata as jasperMeta } from "@/app/(site)/compare/jasper/page";
import BirdeyePage, { metadata as birdeyeMeta } from "@/app/(site)/compare/birdeye/page";
import { getCapability } from "@/lib/seo/capabilities";
import { findPageByPath, getPage, LAUNCH_PARTNER_CTA, PAGES } from "@/lib/seo/pages";
import { isPreviewable, isPublishable, statusSatisfies } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import { buildComparisonContent } from "./build";
import { COMPETITOR_BRIEFS } from "./index";
import type { CompetitorBrief, VendorClaim } from "./types";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const OWN_HOSTS: Record<string, string[]> = {
  aisensy: ["aisensy.com"],
  interakt: ["www.interakt.shop", "interakt.shop"],
  "rep-ai": ["hellorep.ai"],
  // CMP-C. apps.shopify.com is allowed only at the vendor's own listing path (OWN_LISTINGS).
  rebuy: ["www.rebuyengine.com"],
  limespot: ["limespot.com", "apps.shopify.com"],
  nosto: ["www.nosto.com", "apps.shopify.com"],
  tinyimg: ["tinyseo.com", "apps.shopify.com"],
  searchpie: ["searchpie.io", "apps.shopify.com"],
  seowill: ["seowill.com", "apps.shopify.com"],
  hootsuite: ["www.hootsuite.com"],
  buffer: ["buffer.com"],
  jasper: ["www.jasper.ai"],
  birdeye: ["birdeye.com", "www.birdeye.com"],
};
const OWN_LISTINGS: Record<string, string> = {
  limespot: "/limespot",
  nosto: "/nosto-personalization-for-shopify",
  tinyimg: "/smart-image-optimizer",
  searchpie: "/seo-booster",
  seowill: "/seo-master",
};
const hostOk = (slug: string, href: string) => {
  const u = new URL(href);
  return OWN_HOSTS[slug].includes(u.host) && (u.host !== "apps.shopify.com" || u.pathname === OWN_LISTINGS[slug]);
};
const ROUTES: Record<string, { Page: () => Promise<React.ReactElement>; meta: unknown }> = {
  aisensy: { Page: AisensyPage, meta: aisensyMeta },
  interakt: { Page: InteraktPage, meta: interaktMeta },
  "rep-ai": { Page: RepAiPage, meta: repMeta },
  rebuy: { Page: RebuyPage, meta: rebuyMeta },
  limespot: { Page: LimespotPage, meta: limespotMeta },
  nosto: { Page: NostoPage, meta: nostoMeta },
  tinyimg: { Page: TinyimgPage, meta: tinyimgMeta },
  searchpie: { Page: SearchpiePage, meta: searchpieMeta },
  seowill: { Page: SeowillPage, meta: seowillMeta },
  hootsuite: { Page: HootsuitePage, meta: hootsuiteMeta },
  buffer: { Page: BufferPage, meta: bufferMeta },
  jasper: { Page: JasperPage, meta: jasperMeta },
  birdeye: { Page: BirdeyePage, meta: birdeyeMeta },
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

const cells = (b: CompetitorBrief): { who: string; cell: VendorClaim }[] =>
  b.claims.flatMap((c) => [
    { who: `${b.slug}: ${c.dimension} (vendor)`, cell: c.vendor },
    { who: `${b.slug}: ${c.dimension} (peakhour)`, cell: c.peakhour },
  ]);

/**
 * Prose rule: a sentence about Peakhour may name a product behaviour only if the page's capabilityIds carry a
 * capability whose approved claim covers it. Each keyword maps to the capabilities that cover it; a sentence that
 * names Peakhour and a keyword with none of its capabilities in capabilityIds fails. Sentences about a competitor
 * (no "Peakhour") are not judged here: they are the vendor's cells, sourced one by one.
 */
const PROSE_RULES: { keyword: RegExp; anyOf: string[] }[] = [
  { keyword: /whatsapp/i, anyOf: ["commerce.whatsapp_shopping", "commerce.cod_confirmation"] },
  { keyword: /cash.on.delivery|\bCOD\b/i, anyOf: ["commerce.cod_confirmation"] },
  { keyword: /shel(?:f|ves)|recommend/i, anyOf: ["commerce.product_recommendations"] },
  { keyword: /shopping assistant|\bassistant\b|catalogue/i, anyOf: ["commerce.ai_shopping_assistant"] },
  { keyword: /\bSEO\b|alt text|meta description/i, anyOf: ["content.ai_seo_fixes", "content.seo_audit"] },
  { keyword: /\bblog\b/i, anyOf: ["content.ai_blog_writer"] },
  { keyword: /brand voice|your own voice/i, anyOf: ["content.brand_voice"] },
  { keyword: /\b(?:LinkedIn|Instagram|Facebook)\b/i, anyOf: ["content.social_publishing", "growth.linkedin_growth"] },
  { keyword: /newsletter|beehiiv/i, anyOf: ["content.beehiiv_newsletter"] },
  { keyword: /\breviews?\b/i, anyOf: ["presence.review_management"] },
  { keyword: /google (?:listing|business profile)|profile changes/i, anyOf: ["presence.listing_health", "presence.gbp_management"] },
  { keyword: /bundle/i, anyOf: ["commerce.buy_together_bundles", "commerce.frequently_bought_together"] },
  { keyword: /cart suggestions/i, anyOf: ["commerce.cart_upsells"] },
  { keyword: /shelf tests?/i, anyOf: ["commerce.rail_ab_testing"] },
  { keyword: /\binbox\b|handover|hand over/i, anyOf: ["support.channel_inbox", "support.whatsapp_support"] },
];
const sentences = (t: string) => t.split(/(?<=[.!?])\s+/);
function proseViolations(text: string, capabilityIds: string[]): string[] {
  return sentences(text)
    .filter((s) => /peakhour/i.test(s))
    .flatMap((s) => PROSE_RULES.filter((r) => r.keyword.test(s) && !r.anyOf.some((id) => capabilityIds.includes(id))).map((r) => `${r.keyword}: ${s}`));
}

describe("the prose rule itself", () => {
  it("flags a Peakhour sentence that names WhatsApp with no WhatsApp capability", () => {
    expect(proseViolations("Peakhour works on WhatsApp too.", ["commerce.ai_shopping_assistant"]).length).toBe(1);
    expect(proseViolations("Peakhour works on WhatsApp too.", ["commerce.whatsapp_shopping"])).toEqual([]);
    expect(proseViolations("AiSensy is built around WhatsApp.", [])).toEqual([]);
  });
});

describe.each(COMPETITOR_BRIEFS.map((b) => [b.slug, b] as const))("%s brief (Bible T13)", (slug, b) => {
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
      if (c.vendor.source) expect(hostOk(b.slug, c.vendor.source.href), c.dimension).toBe(true);
    }
    for (const r of b.pricing.rows) expect(hostOk(b.slug, r.source.href), r.plan).toBe(true);
  });

  it("points Peakhour's own sources at registered site pages", () => {
    for (const c of b.claims) {
      const href = c.peakhour.source?.href;
      if (href) expect(findPageByPath(href), `${c.dimension}: ${href}`).toBeDefined();
    }
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
    // One currency is never stated for the whole table: each row's label carries its own, without nested brackets.
    for (const r of content.pricing.rows.filter((x) => x.vendor !== "Peakhour")) {
      expect(r.plan, r.plan).toMatch(/ · (?:[A-Z]{3}|Not stated).* · /);
      expect(r.plan, r.plan).not.toMatch(/\([^)]*\([^)]*\)/);
    }
  });

  it("claims for Peakhour only what an approved capability claim supports", () => {
    for (const c of b.claims) {
      const p = c.peakhour;
      if (p.value === "unknown") {
        expect(p.capabilityId, c.dimension).toBeUndefined();
        continue;
      }
      expect(p.pendingCapability, c.dimension).toBeUndefined();
      const cap = getCapability(p.capabilityId ?? "");
      expect(cap, `${c.dimension}: capability ${p.capabilityId}`).toBeDefined();
      expect(cap!.approvedClaims.length, c.dimension).toBeGreaterThan(0);
      const impl =
        cap!.implementations.find((i) => i.surface === getPage(b.pageId).surface) ??
        cap!.implementations.find((i) => i.surface === "shopify") ??
        cap!.implementations.find((i) => i.surface === "web") ??
        cap!.implementations.find((i) => i.surface === "whatsapp");
      expect(impl, c.dimension).toBeDefined();
      for (const claim of cap!.approvedClaims) expect(statusSatisfies(impl!.status, claim.requires), c.dimension).toBe(true);
    }
  });

  it("names a pendingCapability only when that capability exists and has no approved claim yet", () => {
    for (const c of b.claims) {
      const id = c.peakhour.pendingCapability;
      if (!id) continue;
      const cap = getCapability(id);
      expect(cap, `${c.dimension}: ${id}`).toBeDefined();
      expect(cap!.approvedClaims.length, `${c.dimension}: ${id}`).toBe(0);
    }
  });

  it("keeps Peakhour prose to approved claims (directAnswer, FAQ answers, Peakhour's best-for)", () => {
    const ids = getPage(b.pageId).capabilityIds;
    const text = [b.directAnswer, ...b.faqs.map((f) => f.a), ...b.bestFor.filter((x) => x.vendor === "Peakhour").map((x) => x.bestFor)].join(" ");
    expect(proseViolations(text, ids)).toEqual([]);
  });

  it("registers a review-status page whose capabilityIds are exactly what its Peakhour cells claim", () => {
    const page = getPage(b.pageId);
    const global = b.scope === "global";
    expect(page.family).toBe(global ? "compare" : "shopify-compare");
    expect(page.scope).toBe(global ? "global" : "shopify");
    expect(page.surface).toBe(global ? "web" : "shopify");
    expect(page.path).toBe(global ? `/compare/${b.slug}` : `/shopify/compare/${b.slug}`);
    expect(page.editorialStatus).toBe("review");
    expect(page.indexable).toBe(false);
    expect(page.title.length).toBeLessThanOrEqual(60);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(page.h1).toBe(b.h1);
    expect(page.primaryCta).toEqual(LAUNCH_PARTNER_CTA);
    const claimed = new Set(b.claims.map((c) => c.peakhour.capabilityId).filter(Boolean));
    expect(new Set(page.capabilityIds)).toEqual(claimed);
    for (const id of page.relatedIds) expect(PAGES.some((p) => p.pageId === id)).toBe(true);
  });

  it("builds related links and crumbs from the registry, and shows a reviewer only as pending until published", () => {
    const page = getPage(b.pageId);
    const content = buildComparisonContent(b);
    expect(content.related).toEqual(page.relatedIds.map((id) => ({ label: getPage(id).title, href: pathFor(id) })));
    expect(content.crumbs.at(-1)!.href).toBe(page.path);
    expect(content.reviewer).toBe("Pending review");
    expect(buildComparisonContent({ ...b, reviewer: "A. Reviewer" }).reviewer).toBe("A. Reviewer");
    expect(() => buildComparisonContent(b, { ...page, editorialStatus: "published" })).toThrow(/reviewer/);
    expect(buildComparisonContent({ ...b, reviewer: "A. Reviewer" }, { ...page, editorialStatus: "published" }).reviewer).toBe("A. Reviewer");
  });

  it("is not publishable, is previewable off production, and the real route file is a 404 on production", async () => {
    const page = getPage(b.pageId);
    expect(isPublishable(page)).toBe(false);
    expect(isPreviewable(page, { VERCEL_ENV: "production" })).toBe(false);
    expect(isPreviewable(page, { VERCEL_ENV: "preview" })).toBe(true);
    expect(ROUTES[slug].meta).toMatchObject({ alternates: { canonical: expect.stringContaining(page.path) } });

    process.env.VERCEL_ENV = "production";
    await expect(ROUTES[slug].Page()).rejects.toThrow("NEXT_NOT_FOUND");

    process.env.VERCEL_ENV = "preview";
    const html = renderToStaticMarkup(await ROUTES[slug].Page());
    expect(html).toContain(b.h1);
    expect(html).toContain("Draft, not published");
    if (b.claims.some((c) => c.vendor.value === "not-documented")) expect(html).toContain("Not documented");
    expect(html).toMatch(new RegExp(`Pricing as listed on each vendor(?:'|&#x27;|&apos;)s page, seen ${b.observedAt}`));
    // Internal sources are normal links; only external ones open a new tab.
    expect(html).toMatch(/<a href="\/pricing"(?![^>]*target)/);
    expect(html).toMatch(/<a href="https:\/\/[^"]+" target="_blank" rel="noopener noreferrer nofollow"/);
    expect(html).not.toMatch(/<a href="\/[^"]*"[^>]*target="_blank"/);
  });
});
