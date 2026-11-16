import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShopifyFeaturePage, DirectoryPage } from "@/components/marketing/seo/templates";
import { ShopifyFeaturesSection } from "@/components/marketing/shopify/shopify-features-section";
import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { CAPABILITIES, getCapability } from "@/lib/seo/capabilities";
import { findPageByPath, getPage, PAGES } from "@/lib/seo/pages";
import { SF2_PAGES } from "@/lib/seo/pages-sf2";
import { isPublishable } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import { SHOPIFY_GROUPS } from "@/lib/shopify-features";
import * as directory from "./shopify.features";
import * as cartUpsells from "./shopify.features.cart.upsells";
import * as abTesting from "./shopify.features.merchandising.ab.testing";
import * as inventory from "./shopify.features.inventory.alerts";
import * as markdowns from "./shopify.features.automatic.markdowns";
import * as blog from "./shopify.features.ai.blog.generator";
import * as audit from "./shopify.features.seo.audit";
import * as insights from "./shopify.features.customer.conversation.insights";
import * as campaigns from "./shopify.features.ai.growth.campaigns";
import * as finder from "./shopify.features.product.finder";
import * as bundles from "./shopify.features.bundles";

/** SF-2: the remaining Shopify feature pages, and the directory that lists every Shopify app feature. */
const NEW_PAGES: { id: string; mod: { CONTENT: ShopifyFeatureContent; CLAIMS: readonly string[] } }[] = [
  { id: "shopify.features.cart.upsells", mod: cartUpsells },
  { id: "shopify.features.merchandising.ab.testing", mod: abTesting },
  { id: "shopify.features.inventory.alerts", mod: inventory },
  { id: "shopify.features.automatic.markdowns", mod: markdowns },
  { id: "shopify.features.ai.blog.generator", mod: blog },
  { id: "shopify.features.seo.audit", mod: audit },
  { id: "shopify.features.customer.conversation.insights", mod: insights },
  { id: "shopify.features.ai.growth.campaigns", mod: campaigns },
  { id: "shopify.features.product.finder", mod: finder },
  { id: "shopify.features.bundles", mod: bundles },
];

/** The scopes peakhour-api/shopify.app.toml asks for (`[access_scopes]`, read 2026-11-16). A page may name no other permission. */
const APP_SCOPES = new Set([
  "read_all_orders", "read_customers", "write_discounts", "read_inventory", "write_online_store_pages", "read_orders", "read_products",
  "write_products", "read_content", "read_themes", "read_legal_policies", "write_orders", "write_merchant_managed_fulfillment_orders",
  "write_order_edits", "write_legal_policies", "write_pixels", "read_customer_events",
]);

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("every Shopify feature page SF-2 adds is registered, published and backed by approved claims", () => {
  it("registers ten pages, each a child of the directory with a unique id, path, H1 and query cluster", () => {
    expect(SF2_PAGES).toHaveLength(10);
    expect(NEW_PAGES.map((p) => p.id).sort()).toEqual(SF2_PAGES.map((p) => p.pageId).sort());
    const h1s = PAGES.map((p) => p.h1);
    const clusters = PAGES.map((p) => p.queryClusterId).filter(Boolean);
    for (const p of SF2_PAGES) {
      expect(getPage(p.pageId)).toBe(p);
      expect(p.parentId).toBe("shopify.features");
      expect(p.family).toBe("shopify-feature");
      expect(p.surface).toBe("shopify");
      expect(p.title.length, p.pageId).toBeLessThanOrEqual(60);
      expect(p.description.length, p.pageId).toBeLessThanOrEqual(160);
      expect(h1s.filter((h) => h === p.h1).length, `${p.pageId} H1 is not unique`).toBe(1);
      expect(clusters.filter((c) => c === p.queryClusterId).length, `${p.pageId} cluster`).toBe(1);
      expect(p.relatedIds.length).toBeGreaterThan(0);
      for (const r of p.relatedIds) expect(() => getPage(r), `${p.pageId} -> ${r}`).not.toThrow();
      expect(p.lastReviewedAt).toBe("2026-11-16");
      expect(p.path).toBe(`/shopify/features/${p.path.split("/").pop()}`);
    }
  });

  for (const { id, mod } of NEW_PAGES) {
    it(`${id}: claim ids exist on a capability the record lists, every listed capability is leaned on, and the gate passes`, () => {
      const page = getPage(id);
      expect(mod.CLAIMS.length).toBeGreaterThan(0);
      for (const claimId of mod.CLAIMS) {
        const cap = page.capabilityIds.map((c) => getCapability(c)!).find((c) => c.approvedClaims.some((a) => a.id === claimId));
        expect(cap, `${claimId} is not a claim of any capability on ${id}`).toBeDefined();
      }
      for (const capId of page.capabilityIds) expect(mod.CLAIMS.some((c) => c.startsWith(`${capId}.`)), capId).toBe(true);
      expect(isPublishable(page)).toBe(true);
      expect(page.editorialStatus).toBe("published");
      // Its status, limitations and date are the record's.
      const impl = getCapability(page.capabilityIds[0]!)!.implementations.find((i) => i.surface === "shopify")!;
      expect(mod.CONTENT.status).toBe(impl.status);
      expect(mod.CONTENT.limitations).toEqual(impl.limitations ?? []);
      expect(mod.CONTENT.verifiedAt).toBe(impl.verifiedAt);
    });

    it(`${id}: names only permissions the app really asks for`, () => {
      const names = mod.CONTENT.permissions.map((p) => p.name);
      for (const n of names) expect(APP_SCOPES.has(n), `${id} names ${n}, which shopify.app.toml does not request`).toBe(true);
      expect(new Set(names).size).toBe(names.length);
      for (const p of mod.CONTENT.permissions) expect(p.why.length).toBeGreaterThan(20);
      if (names.length === 0) expect(mod.CONTENT.permissionsNote?.length ?? 0).toBeGreaterThan(20);
    });
  }
});

describe("each new page renders its H1, direct answer, status, limits, steps, permissions, FAQ and links", () => {
  for (const { id, mod } of NEW_PAGES) {
    const page = getPage(id);
    const html = renderToStaticMarkup(<ShopifyFeaturePage page={page} content={mod.CONTENT} />);
    const flat = text(html);

    it(`${id}: one H1, the direct answer first, and 3 to 5 questions`, () => {
      expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
      expect(flat).toContain(page.h1);
      expect(flat).toContain(mod.CONTENT.directAnswer);
      expect(mod.CONTENT.setupSteps.length).toBeGreaterThanOrEqual(3);
      expect(mod.CONTENT.faqs.length).toBeGreaterThanOrEqual(3);
      expect(mod.CONTENT.faqs.length).toBeLessThanOrEqual(5);
      expect(mod.CONTENT.limitations.length).toBeGreaterThan(0);
      expect(html).toContain("Limits");
      // A picture is always labelled as a demo; a page with none has no picture to label.
      if (mod.CONTENT.proof) expect(html).toContain("Demo");
    });

    it(`${id}: every internal link resolves to a registry page, and a published page links only to published pages`, () => {
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      const internal = hrefs.filter((h) => h.startsWith("/") && !h.startsWith("/_next") && !h.startsWith("//"));
      for (const h of internal) {
        const target = findPageByPath(h.split("#")[0]!.split("?")[0]!);
        expect(target, `${id} links to ${h}, which is not a registry path`).toBeDefined();
        expect(isPublishable(target!), `${id} links to ${h}, which production 404s`).toBe(true);
      }
      expect(internal).toContain("/shopify");
      expect(internal).toContain("/pricing");
      expect(internal.filter((h) => h.startsWith("/shopify/features/")).length).toBeGreaterThanOrEqual(1);
      expect(mod.CONTENT.related.length).toBeGreaterThanOrEqual(2);
      expect(mod.CONTENT.related.length).toBeLessThanOrEqual(6);
    });
  }

  it("a feature that asks for no permission of its own says so instead of showing an empty list", () => {
    const html = renderToStaticMarkup(<ShopifyFeaturePage page={getPage("shopify.features.customer.conversation.insights")} content={insights.CONTENT} />);
    expect(insights.CONTENT.permissions).toHaveLength(0);
    expect(text(html)).toContain("no permission of its own");
    expect(html).not.toContain("<dl");
  });
});

describe("copy rules", () => {
  const all = NEW_PAGES.map((p) => JSON.stringify(p.mod.CONTENT)).join("\n") + JSON.stringify(SF2_PAGES) + JSON.stringify(directory.CONTENT);

  it("quotes no price in a currency, uses none of the banned words, and types no trade mark", () => {
    expect(all).not.toMatch(/[₹£$€]\s?\d|\d\s?(?:rupees|dollars|pounds)\b/i);
    expect(all).not.toMatch(/\b(council|strategist|critic|chair)\b/i);
    expect(all).not.toMatch(/™|®/);
    expect(all).not.toMatch(/five modules|one brain/i);
  });

  it("makes no invented number, rating, customer count or testimonial, and names no competitor", () => {
    expect(all).not.toMatch(/\b\d+\s?(?:x|×)\b/);
    expect(all).not.toMatch(/\b\d{2,}\s?%|\b\d+(?:,\d{3})+\b|trusted by|customers love|rated|★|stars?\b/i);
    expect(all).not.toMatch(/\b(klaviyo|nosto|rebuy|limespot|wiser|searchanise|gorgias|zendesk|intercom|tidio|yotpo|judge\.me|vitals|growave|boost commerce|recharge|aftersell|zipify|manifest)\b/i);
  });

  it("the markdown page never calls itself automatic, because each apply is a click", () => {
    const p = getPage("shopify.features.automatic.markdowns");
    for (const s of [p.title, p.h1, p.description, markdowns.CONTENT.directAnswer, ...markdowns.CONTENT.crumbs.map((c) => c.label)]) expect(s).not.toMatch(/automatic/i);
    expect(p.title).toMatch(/markdown suggestions/i);
  });

  it("the audit page does not promise the Search Console section, which is not live in production", () => {
    const copy = JSON.stringify({ ...audit.CONTENT, limitations: [] });
    expect(copy).not.toMatch(/search console/i);
  });
});

describe("the directory lists every Shopify app feature, grouped like the app", () => {
  const items = directory.CONTENT.items;
  const hrefs = items.flatMap((i) => (i.href ? [i.href] : []));

  it("has the groups of SHOPIFY_GROUPS, in order, each with at least as many cards as the app lists", () => {
    expect(directory.CONTENT.groups!.map((g) => g.id)).toEqual(SHOPIFY_GROUPS.map((g) => g.id));
    for (const g of SHOPIFY_GROUPS) {
      const dg = directory.CONTENT.groups!.find((x) => x.id === g.id)!;
      expect(dg.title).toBe(g.name);
      expect(dg.items.length, g.id).toBeGreaterThanOrEqual(g.features.length);
    }
    expect(items).toHaveLength(directory.CONTENT.groups!.reduce((n, g) => n + g.items.length, 0));
  });

  it("carries every feature of SHOPIFY_GROUPS (a renamed card is named here), with no invented card", () => {
    const renamed: Record<string, string> = { markdowns: "Markdown suggestions" };
    const titles = new Set(items.map((i) => i.title));
    for (const g of SHOPIFY_GROUPS) for (const f of g.features) expect(titles.has(renamed[f.id] ?? f.title), f.title).toBe(true);
    // The four cards SHOPIFY_GROUPS does not name each come from a capability record.
    const extras = items.filter((i) => !SHOPIFY_GROUPS.some((g) => g.features.some((f) => (renamed[f.id] ?? f.title) === i.title))).map((i) => i.title).sort();
    expect(extras).toEqual(["AI product descriptions", "Find my match", "Frequently bought together", "Peakhour Summit"]);
    for (const i of items) {
      expect(i.title.length).toBeGreaterThan(0);
      expect(i.body.length).toBeGreaterThan(20);
    }
  });

  it("links every live or beta Shopify capability to a feature page, or to the global page that covers it", () => {
    const GLOBAL_PAGE: Record<string, string> = { "content.brand_voice": "/features/brand-voice", "growth.peakhour_summit": "/features/peakhour-summit" };
    const shipped = CAPABILITIES.filter((c) => c.implementations.some((i) => i.surface === "shopify" && (i.status === "live" || i.status === "beta")));
    expect(shipped.length).toBeGreaterThanOrEqual(18);
    for (const cap of shipped) {
      const own = PAGES.filter((p) => p.family === "shopify-feature" && p.capabilityIds.includes(cap.id)).map((p) => p.path);
      const covered = [...own, ...(GLOBAL_PAGE[cap.id] ? [GLOBAL_PAGE[cap.id]!] : [])];
      expect(covered.length, `${cap.id} has no page to link`).toBeGreaterThan(0);
      expect(covered.some((p) => hrefs.includes(p)), `${cap.id} is not in the directory`).toBe(true);
    }
    // WhatsApp shopping has a WhatsApp record only, and its Shopify page is listed too.
    expect(hrefs).toContain(pathFor("shopify.features.whatsapp.ai.shopping"));
  });

  it("links every published Shopify feature page", () => {
    for (const p of PAGES.filter((x) => x.family === "shopify-feature" && x.pageId !== "shopify.features" && isPublishable(x))) {
      expect(hrefs, p.pageId).toContain(p.path);
    }
  });

  it("resolves every link: a publishable page, a section that exists, or a place on /shopify", () => {
    const shopifyAnchors = new Set(SHOPIFY_GROUPS.flatMap((g) => g.features.map((f) => f.id)));
    const sectionIds = (pageId: string, mod: { CONTENT: ShopifyFeatureContent }) => {
      const html = renderToStaticMarkup(<ShopifyFeaturePage page={getPage(pageId)} content={mod.CONTENT} />);
      return new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    };
    const audited = sectionIds("shopify.features.seo.audit", audit);
    for (const h of hrefs) {
      const [path, anchor] = h.split("#") as [string, string | undefined];
      const page = findPageByPath(path);
      expect(page, `${h} is not a registry path`).toBeDefined();
      expect(isPublishable(page!), `${h} is not publishable`).toBe(true);
      if (!anchor) continue;
      if (path === "/shopify") expect(shopifyAnchors.has(anchor), `${h}: /shopify has no #${anchor}`).toBe(true);
      else if (path === "/shopify/features/seo-audit") expect(audited.has(anchor), `${h}: no #${anchor} on the page`).toBe(true);
      else throw new Error(`${h}: an anchor on a page this test does not know`);
    }
  });

  it("shows a status chip from the record, and gives a feature that is not shipped no link", () => {
    for (const i of items) {
      if (i.status && i.status !== "live" && i.status !== "beta") {
        expect(i.href, `${i.title} is ${i.status} and must not link`).toBeUndefined();
      }
    }
    const soon = items.filter((i) => i.status && i.status !== "live" && i.status !== "beta").map((i) => i.title).sort();
    expect(soon).toEqual(["Google search visibility", "Ranking and AI assistant tracking"]);
    const page = getPage("shopify.features");
    const html = renderToStaticMarkup(<DirectoryPage page={page} content={directory.CONTENT} />);
    expect(text(html)).toContain(directory.CONTENT.directAnswer);
    expect(html).toContain("Coming soon");
    expect(html).toContain("Live");
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    for (const g of directory.CONTENT.groups!) expect(html).toContain(`id="${g.id}"`);
    for (const h of hrefs) expect(html).toContain(`href="${h}"`);
  });

  it("lets /shopify's Shopify features section pick up every new page through the registry", () => {
    const html = renderToStaticMarkup(<ShopifyFeaturesSection />);
    for (const p of SF2_PAGES) expect(html).toContain(`href="${p.path}"`);
  });
});
