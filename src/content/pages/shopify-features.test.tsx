import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShopifyFeaturePage, DirectoryPage } from "@/components/marketing/seo/templates";
import type { BaseContent, ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { getCapability } from "@/lib/seo/capabilities";
import { getPage, PAGES } from "@/lib/seo/pages";
import { isPublishable, statusSatisfies } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import * as directory from "./shopify.features";
import * as assistant from "./shopify.features.ai.shopping.assistant";
import * as whatsapp from "./shopify.features.whatsapp.ai.shopping";
import * as rails from "./shopify.features.product.recommendations";
import * as fbt from "./shopify.features.frequently.bought.together";
import * as cod from "./shopify.features.whatsapp.cod.confirmation";
import * as seo from "./shopify.features.ai.seo";
import * as descriptions from "./shopify.features.ai.product.descriptions";

/** SEO-8: the wave-1 Shopify feature pages. */
const FEATURE_PAGES: { id: string; mod: { CONTENT: ShopifyFeatureContent; CLAIMS: readonly string[] }; published: boolean }[] = [
  { id: "shopify.features.ai.shopping.assistant", mod: assistant, published: true },
  { id: "shopify.features.whatsapp.ai.shopping", mod: whatsapp, published: false },
  { id: "shopify.features.product.recommendations", mod: rails, published: true },
  { id: "shopify.features.frequently.bought.together", mod: fbt, published: true },
  { id: "shopify.features.whatsapp.cod.confirmation", mod: cod, published: true },
  { id: "shopify.features.ai.seo", mod: seo, published: true },
  { id: "shopify.features.ai.product.descriptions", mod: descriptions, published: true },
];

const text = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const allCopy = (c: BaseContent & Partial<ShopifyFeatureContent>) => JSON.stringify(c);

describe("every claim a feature page leans on is an approved claim, on the page's surface", () => {
  for (const { id, mod } of FEATURE_PAGES) {
    it(`${id}: claim ids exist, belong to a capability the record lists, and the record lists only capabilities with claims`, () => {
      const page = getPage(id);
      expect(mod.CLAIMS.length).toBeGreaterThan(0);
      for (const claimId of mod.CLAIMS) {
        const cap = page.capabilityIds.map((c) => getCapability(c)!).find((c) => c.approvedClaims.some((a) => a.id === claimId));
        expect(cap, `${claimId} is not a claim of any capability on ${id}`).toBeDefined();
      }
      // Every capability the record lists is leaned on by at least one named claim.
      for (const capId of page.capabilityIds) expect(mod.CLAIMS.some((c) => c.startsWith(`${capId}.`)), capId).toBe(true);
    });

    it(`${id}: is published exactly when every claim is satisfied on its surface, and review otherwise`, () => {
      const page = getPage(id);
      const satisfied = page.capabilityIds.every((capId) => {
        const impl = getCapability(capId)!.implementations.find((i) => i.surface === page.surface);
        return !!impl && getCapability(capId)!.approvedClaims.every((a) => statusSatisfies(impl.status, a.requires));
      });
      expect(satisfied).toBe(FEATURE_PAGES.find((f) => f.id === id)!.published);
      expect(isPublishable(page)).toBe(satisfied);
      expect(page.editorialStatus).toBe(satisfied ? "published" : "review");
      expect(page.indexable).toBe(satisfied);
    });
  }
});

describe("registry records", () => {
  it("each has a title <= 60, a description <= 160, a unique H1, a query cluster, related ids and today's review date", () => {
    const ids = ["shopify.features", ...FEATURE_PAGES.map((f) => f.id)];
    const h1s = PAGES.map((p) => p.h1);
    for (const id of ids) {
      const p = getPage(id);
      expect(p.title.length, id).toBeLessThanOrEqual(60);
      expect(p.description.length, id).toBeLessThanOrEqual(160);
      expect(h1s.filter((h) => h === p.h1).length, `${id} H1 is not unique`).toBe(1);
      expect(p.queryClusterId, id).toBeTruthy();
      expect(p.relatedIds.length, id).toBeGreaterThan(0);
      for (const r of p.relatedIds) expect(() => getPage(r), `${id} -> ${r}`).not.toThrow();
      expect(p.lastReviewedAt, id).toBe("2026-11-15");
      expect(p.surface, id).toBe("shopify");
      expect(p.scope, id).toBe("shopify");
      expect(p.path.startsWith("/shopify/features"), id).toBe(true);
    }
  });

  it("the directory is published and lists exactly the published feature pages", () => {
    expect(isPublishable(getPage("shopify.features"))).toBe(true);
    const listed = directory.CONTENT.items.map((i) => i.href).sort();
    const expected = FEATURE_PAGES.filter((f) => f.published).map((f) => pathFor(f.id)).sort();
    expect(listed).toEqual(expected);
  });
});

describe("each page renders its H1 and direct answer, with its status, limitations, steps, permissions, FAQ and links", () => {
  for (const { id, mod } of FEATURE_PAGES) {
    const page = getPage(id);
    const html = renderToStaticMarkup(<ShopifyFeaturePage page={page} content={mod.CONTENT} />);
    const flat = text(html);

    it(`${id}: H1 and direct answer`, () => {
      expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
      expect(flat).toContain(page.h1);
      expect(flat).toContain(mod.CONTENT.directAnswer);
    });

    it(`${id}: limitations, steps, permissions and 3 to 5 questions`, () => {
      expect(mod.CONTENT.limitations.length).toBeGreaterThan(0);
      expect(mod.CONTENT.setupSteps.length).toBeGreaterThanOrEqual(3);
      expect(mod.CONTENT.permissions.length).toBeGreaterThan(0);
      expect(mod.CONTENT.faqs.length).toBeGreaterThanOrEqual(3);
      expect(mod.CONTENT.faqs.length).toBeLessThanOrEqual(5);
      expect(html).toContain("What it does not do");
      expect(html).toContain("Demo");
    });

    it(`${id}: every internal link resolves to a registry page, or a same-page anchor`, () => {
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      const known = new Set(PAGES.map((p) => p.path));
      const internal = hrefs.filter((h) => h.startsWith("/") && !h.startsWith("/_next") && !h.startsWith("//"));
      for (const h of internal) {
        const path = h.split("#")[0].split("?")[0];
        expect(known.has(path), `${id} links to ${h}, which is not a registry path`).toBe(true);
      }
      expect(internal).toContain("/shopify");
      expect(internal.filter((h) => h.startsWith("/shopify/features")).length).toBeGreaterThanOrEqual(1);
    });

    it(`${id}: a published page links only to published pages`, () => {
      if (!isPublishable(page)) return;
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].split("#")[0]);
      for (const h of hrefs) {
        const target = PAGES.find((p) => p.path === h);
        if (target) expect(isPublishable(target), `${id} links to ${h}, which production 404s`).toBe(true);
      }
    });
  }

  it("the directory renders its H1, direct answer and a card per published feature", () => {
    const page = getPage("shopify.features");
    const html = renderToStaticMarkup(<DirectoryPage page={page} content={directory.CONTENT} />);
    expect(html).toContain(page.h1);
    expect(text(html)).toContain(directory.CONTENT.directAnswer);
    for (const i of directory.CONTENT.items) expect(html).toContain(`href="${i.href}"`);
  });
});

describe("copy rules", () => {
  const all = [...FEATURE_PAGES.map((f) => allCopy(f.mod.CONTENT)), allCopy(directory.CONTENT)].join("\n");

  it("quotes no price in a currency and uses none of the banned words", () => {
    expect(all).not.toMatch(/[₹£$€]\s?\d|\d\s?(?:rupees|dollars|pounds)\b/i);
    expect(all).not.toMatch(/\b(council|strategist|critic|chair)\b/i);
    expect(all).not.toMatch(/Peakhour Summit[™®]|™|®/);
  });

  it("makes no invented number, rating, customer count or testimonial", () => {
    expect(all).not.toMatch(/\b\d+\s?(?:x|×)\b/);
    expect(all).not.toMatch(/\b\d{2,}\s?%|\b\d+(?:,\d{3})+\b|trusted by|customers love|rated|★|stars?\b/i);
  });

  it("names no competitor", () => {
    expect(all).not.toMatch(/\b(klaviyo|nosto|rebuy|limespot|wiser|searchanise|gorgias|zendesk|intercom|tidio|yotpo|judge\.me|vitals|growave|boost commerce|recharge|aftersell|zipify)\b/i);
  });

  it("states no unapproved WhatsApp fee or cost promise", () => {
    expect(all).not.toMatch(/\bfree\b/i);
  });
});
