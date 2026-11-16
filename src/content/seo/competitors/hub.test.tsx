import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/components/shared/header", () => ({ Header: () => null }));
vi.mock("@/components/shared/footer", async (orig) => ({ ...(await orig<typeof import("@/components/shared/footer")>()), Footer: () => null }));

import ShopifyDirectory, { metadata as shopifyMeta } from "@/app/(site)/shopify/compare/page";
import GlobalDirectory, { metadata as globalMeta } from "@/app/(site)/compare/page";
import { footerGroups } from "@/components/shared/footer";
import { ShopifyCompareSection } from "@/components/marketing/shopify/shopify-compare-section";
import { ComparisonPage, DirectoryPage, ShopifyFeaturePage } from "@/components/marketing/seo/templates";
import { directoryItems } from "@/components/marketing/seo/content-types";
import { DIRECTORY_CAPABILITIES, directoryCard } from "@/content/pages/shopify.features";
import { CONTENT as ASSISTANT } from "@/content/pages/shopify.features.ai.shopping.assistant";
import { capabilityFacts } from "@/content/pages/shopify-feature-kit";
import { getCapability } from "@/lib/seo/capabilities";
import { MARKETING_PATHS } from "@/lib/seo/gate";
import { compareDirectories, findPageByPath, getPage, PAGES } from "@/lib/seo/pages";
import { canOpen, isPreviewable, isPublishable, statusSatisfies } from "@/lib/seo/publish";
import { buildComparisonContent } from "./build";
import { comparedWith, directoryContent, jobsFor, topComparisons, visibleBriefs } from "./hub";
import { COMPETITOR_BRIEFS } from "./index";
import { comparedCapabilityIds, MAX_LINE, moreItems, type MoreItem } from "./more";
import { firstSentence } from "@/content/pages/shopify-feature-kit";
import { compareRoute } from "./route";

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const hrefsOf = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
const production = () => vi.stubEnv("VERCEL_ENV", "production");
afterEach(() => vi.unstubAllEnvs());


/**
 * Why a card is not what the registry allows, or undefined when it is. A card's body must be the first sentence of the exact approved
 * claim it names (at a status that satisfies that claim), or the directory's own short copy for the capability. No fallback: a body
 * that matches neither fails.
 */
function cardError(m: MoreItem, shopifyScope: boolean): string | undefined {
  const cap = getCapability(m.capabilityId);
  if (!cap) return "unknown capability";
  if (m.source.kind === "claim") {
    const claimId = m.source.claimId;
    const claim = cap.approvedClaims.find((c) => c.id === claimId);
    if (!claim) return `claim ${claimId} is not a claim of ${m.capabilityId}`;
    if (m.item.body !== firstSentence(claim.text)) return `body is not the first sentence of ${claimId}`;
    if (!m.item.status || !statusSatisfies(m.item.status, claim.requires)) return `status does not satisfy ${claimId}`;
    if (shopifyScope && m.item.body.length > MAX_LINE) return "a long claim should have given way to the directory copy";
  } else {
    const d = DIRECTORY_CAPABILITIES.find((x) => x.capabilityId === m.capabilityId);
    if (!d || m.item.body !== directoryCard(d).body) return "body is not the directory copy";
  }
  if (m.item.body.trim() === "") return "an empty card";
  if (shopifyScope) {
    const shopify = cap.implementations.find((i) => i.surface === "shopify");
    if (!shopify || m.item.status !== capabilityFacts(m.capabilityId, "shopify").status) return "status is not the Shopify build's";
  }
  return undefined;
}

/** The "gives more" section of a rendered comparison page. */
const moreSection = (html: string) => {
  const start = html.indexOf('id="more"');
  const end = html.indexOf("</section>", start);
  return html.slice(start, end);
};

describe("Peakhour Suite gives more: every comparison page, from the builder", () => {
  for (const b of COMPETITOR_BRIEFS) {
    const global = compareRoute(b).global;
    describe(b.pageId, () => {
      const items = moreItems(b);
      const covered = comparedCapabilityIds(b);

      it("lists something beyond the table, and no item repeats a capability the table claims or names", () => {
        expect(items.length).toBeGreaterThan(0);
        for (const m of items) expect(covered.has(m.capabilityId), `${m.item.title} repeats a table row`).toBe(false);
        expect(new Set(items.map((m) => m.capabilityId)).size).toBe(items.length);
      });

      it("says only an approved claim: every card passes the exact-claim check, with no empty card and no foreign-surface status", () => {
        for (const m of items) expect(cardError(m, !global), `${m.item.title}`).toBeUndefined();
        if (global) for (const m of items) expect(m.item.status, m.item.title).toBe("live");
      });

      it("renders as its own section before the closing band, with the heading and the directory links", () => {
        const page = getPage(b.pageId);
        const html = renderToStaticMarkup(<ComparisonPage page={page} content={buildComparisonContent(b)} />);
        const heading = global ? "Peakhour Suite also does this" : "Peakhour Suite for Shopify also does this";
        expect(text(html)).toContain(heading);
        const at = html.indexOf('id="more"');
        expect(at).toBeGreaterThan(html.indexOf('id="limits"'));
        // The closing band is the last section: nothing but it follows the block and the FAQ and related sections.
        expect(html.lastIndexOf("Join the waitlist")).toBeGreaterThan(at);
        expect(hrefsOf(moreSection(html))).toContain("/shopify/features");
        if (global) expect(hrefsOf(moreSection(html))).toContain("/features");
        // It never says the other product lacks a feature: that is the table's job, with its sources.
        expect(text(moreSection(html))).not.toMatch(/\b(lacks|does not have|only Peakhour|best)\b/i);
      });

      it("links only to pages that resolve, and on production only to published ones", () => {
        for (const prod of [false, true]) {
          if (prod) production();
          const html = renderToStaticMarkup(<ComparisonPage page={getPage(b.pageId)} content={buildComparisonContent(b)} />);
          vi.unstubAllEnvs();
          for (const h of hrefsOf(moreSection(html)).filter((x) => x.startsWith("/"))) {
            const target = findPageByPath(h.split("#")[0]!);
            expect(target, `${h} is not a registry path`).toBeDefined();
            if (prod) expect(isPublishable(target!), `${h} would 404 on production`).toBe(true);
          }
        }
      });
    });
  }

  it("is built for a Shopify brief from the Shopify directory and for a global one from the whole live suite", () => {
    const shopify = COMPETITOR_BRIEFS.find((b) => !compareRoute(b).global)!;
    const global = COMPETITOR_BRIEFS.find((b) => compareRoute(b).global)!;
    expect(buildComparisonContent(shopify).more?.heading).toMatch(/Shopify/);
    expect(buildComparisonContent(global).more?.heading).not.toMatch(/Shopify/);
  });
});

describe("the directories", () => {
  it("register /shopify/compare and /compare, known to the gate, under the pages the registry expects", () => {
    expect(findPageByPath("/shopify/compare")?.pageId).toBe("shopify.compare");
    expect(findPageByPath("/compare")?.pageId).toBe("compare");
    expect(MARKETING_PATHS.map((m) => m.path)).toEqual(expect.arrayContaining(["/shopify/compare", "/compare"]));
    expect(getPage("shopify.compare").parentId).toBe("shopify");
    expect(shopifyMeta).toBeDefined();
    expect(globalMeta).toBeDefined();
  });

  it("are publishable only once a child is published, and review until then", () => {
    const children = PAGES.filter((p) => p.family === "shopify-compare" || p.family === "compare");
    expect(getPage("shopify.compare").family).toBe("core");
    expect(getPage("compare").family).toBe("core");
    expect(children.every((c) => c.editorialStatus === "review")).toBe(true);
    expect(isPublishable(getPage("shopify.compare"))).toBe(false);
    expect(isPublishable(getPage("compare"))).toBe(false);
    expect(getPage("shopify.compare").editorialStatus).toBe("review");
    const shopifyChild = children.find((c) => c.family === "shopify-compare")!;
    const live = compareDirectories([{ ...shopifyChild, editorialStatus: "published", indexable: true }]);
    expect(live.find((p) => p.pageId === "shopify.compare")).toMatchObject({ editorialStatus: "published", indexable: true });
    // A published Shopify comparison does not publish the global directory.
    expect(live.find((p) => p.pageId === "compare")).toMatchObject({ editorialStatus: "review", indexable: false });
    // A child that is published and indexable but fails its capability is not publishable: the directory stays review.
    const failing = { ...shopifyChild, editorialStatus: "published" as const, indexable: true, capabilityIds: ["no.such.capability"] };
    expect(isPublishable(failing)).toBe(false);
    expect(compareDirectories([failing])[0]).toMatchObject({ editorialStatus: "review", indexable: false });
    // A published-but-not-indexable child counts for nothing.
    expect(compareDirectories([{ ...shopifyChild, editorialStatus: "published", indexable: false }])[0]).toMatchObject({ editorialStatus: "review" });
  });

  it("404 on production while no child is published", async () => {
    production();
    await expect(ShopifyDirectory()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(GlobalDirectory()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("render for review off production: one marked card per comparison, grouped by job, with its vendor, job and date", async () => {
    for (const scope of ["shopify", "global"] as const) {
      const content = directoryContent(scope);
      const briefs = visibleBriefs(scope);
      expect(briefs.length).toBeGreaterThan(0);
      expect(directoryItems(content).length).toBe(briefs.length);
      const page = getPage(scope === "global" ? "compare" : "shopify.compare");
      const html = renderToStaticMarkup(<DirectoryPage page={page} content={content} />);
      const flat = text(html);
      for (const b of briefs) {
        expect(flat, b.name).toContain(`Peakhour vs ${b.name}`);
        expect(flat).toContain(b.category);
        expect(flat).toContain(`Checked ${b.observedAt}`);
        expect(hrefsOf(html)).toContain(compareRoute(b).path);
      }
      expect(flat).toContain("Draft");
      expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
      for (const g of content.groups!) expect(html).toContain(`id="${g.id}"`);
    }
    expect(renderToStaticMarkup(await ShopifyDirectory())).toContain("Draft, not published");
  });

  it("group the Shopify directory by job; every job names only briefs that exist and every brief is on a card", () => {
    const slugs = new Set(COMPETITOR_BRIEFS.map((b) => b.slug));
    for (const scope of ["shopify", "global"] as const) {
      for (const j of jobsFor(scope)) for (const s of j.slugs) expect(slugs.has(s), `${j.id}: ${s}`).toBe(true);
      const onCards = directoryItems(directoryContent(scope)).length;
      expect(onCards).toBe(COMPETITOR_BRIEFS.filter((b) => compareRoute(b).global === (scope === "global")).length);
    }
    const titles = directoryContent("shopify").groups!.map((g) => g.title);
    expect(titles).toEqual(expect.arrayContaining(["WhatsApp and cash on delivery", "Chat and shopping assistants", "SEO and content"]));
  });

  it("show no card on production while every comparison is a draft", () => {
    production();
    expect(visibleBriefs("shopify")).toEqual([]);
    expect(topComparisons()).toEqual([]);
    expect(comparedWith(getPage("shopify.features.ai.shopping.assistant"))).toEqual([]);
  });
});

describe("links into the comparisons", () => {
  it("/shopify shows the top comparisons with the directory link, and nothing on production", () => {
    const html = renderToStaticMarkup(<ShopifyCompareSection />);
    expect(text(html)).toContain("Compare Peakhour");
    expect(hrefsOf(html)).toContain("/shopify/compare");
    const top = topComparisons(3);
    expect(top).toHaveLength(3);
    expect(top.every((t) => t.draft)).toBe(true);
    production();
    expect(renderToStaticMarkup(<ShopifyCompareSection />)).toBe("");
  });

  it("a Shopify feature page lists the comparisons whose table covers its capability, marked as drafts off production", () => {
    const page = getPage("shopify.features.ai.shopping.assistant");
    const cards = comparedWith(page);
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      const target = findPageByPath(c.href!)!;
      expect(target.family).toBe("shopify-compare");
      expect(target.capabilityIds.some((id) => page.capabilityIds.includes(id)), c.href).toBe(true);
    }
    const html = renderToStaticMarkup(<ShopifyFeaturePage page={page} content={ASSISTANT} />);
    expect(text(html)).toContain("Compared with other apps");
    expect(hrefsOf(html)).toContain(cards[0]!.href);
    production();
    expect(text(renderToStaticMarkup(<ShopifyFeaturePage page={page} content={ASSISTANT} />))).not.toContain("Compared with other apps");
  });

  it("a page whose capability no table covers has no Compared with section", () => {
    expect(comparedWith({ capabilityIds: [] })).toEqual([]);
    expect(comparedWith({ capabilityIds: ["growth.peakhour_summit"] })).toEqual([]);
  });

  it("the directories are previewable off production, never on it", () => {
    const p = getPage("shopify.compare");
    expect(isPreviewable(p, {})).toBe(true);
    expect(isPreviewable(p, { VERCEL_ENV: "production" })).toBe(false);
  });

  it("the footer links Compare only while the directory is publishable", () => {
    const hrefs = (groups: ReturnType<typeof footerGroups>) => groups.flatMap((g) => g.links.map((l) => l.href));
    const t = ((k: string) => k) as Parameters<typeof footerGroups>[0];
    // Every comparison is a draft, so the directory is review and the footer leaves it out.
    expect(hrefs(footerGroups(t))).not.toContain("/shopify/compare");
  });
});

describe("review round 1", () => {
  it("every brief sits under a named job, so nothing lands in More comparisons by accident", () => {
    for (const scope of ["shopify", "global"] as const) {
      const named = new Set(jobsFor(scope).flatMap((j) => j.slugs));
      for (const b of COMPETITOR_BRIEFS.filter((x) => compareRoute(x).global === (scope === "global"))) expect(named.has(b.slug), `add ${b.slug} to a job in hub.ts`).toBe(true);
    }
  });

  it("a global comparison never sends its reader to a Shopify feature page", () => {
    for (const b of COMPETITOR_BRIEFS.filter((x) => compareRoute(x).global)) {
      for (const m of moreItems(b)) expect(m.item.href ?? "", `${b.slug}: ${m.item.title}`).not.toMatch(/^\/shopify\//);
    }
  });

  it("the global intro names the Shopify list only while its link is rendered", () => {
    const b = COMPETITOR_BRIEFS.find((x) => compareRoute(x).global)!;
    const more = buildComparisonContent(b).more!;
    expect(more.links.some((l) => l.href === "/shopify/features")).toBe(true);
    expect(more.intro).toContain("Shopify list");
    // With the directory unreachable (production, drafts only) the link and the sentence go together.
    const shopifyDir = getPage("shopify.features");
    expect(canOpen(shopifyDir)).toBe(true);
  });

  it("a comparison page sits under its directory, with the Compare crumb in order", () => {
    for (const b of COMPETITOR_BRIEFS) {
      const global = compareRoute(b).global;
      const page = getPage(b.pageId);
      expect(page.parentId).toBe(global ? "compare" : "shopify.compare");
      const labels = buildComparisonContent(b).crumbs.map((c) => c.label);
      expect(labels).toEqual(global ? ["Home", "Compare", `Compare with ${b.name}`] : ["Home", "Shopify", "Compare", `Compare with ${b.name}`]);
      const html = renderToStaticMarkup(<ComparisonPage page={page} content={buildComparisonContent(b)} />);
      expect(html).toContain('"@type":"BreadcrumbList"');
    }
  });

  it("the Shopify directory closing band matches its button", () => {
    const c = directoryContent("shopify");
    expect(getPage("shopify.compare").primaryCta.label).toBe("Install on Shopify");
    expect(c.closing.body).not.toMatch(/waitlist/i);
    expect(directoryContent("global").closing.body).toMatch(/waitlist/i);
    expect(getPage("compare").primaryCta.label).toBe("Join the waitlist");
  });
});

describe("review round 2", () => {
  it("the card check can fail: an invented body, a wrong claim id, a borrowed status and an empty body are all caught", () => {
    const shopify = COMPETITOR_BRIEFS.find((b) => !compareRoute(b).global)!;
    const real = moreItems(shopify).find((m) => m.source.kind === "claim")!;
    expect(cardError(real, true)).toBeUndefined();
    expect(cardError({ ...real, item: { ...real.item, body: "Writes every product page for you." } }, true)).toMatch(/first sentence/);
    expect(cardError({ ...real, source: { kind: "claim", claimId: "commerce.cod_confirmation.nope" } }, true)).toMatch(/not a claim/);
    expect(cardError({ ...real, item: { ...real.item, body: "" } }, true)).toBeDefined();
    const viaDirectory = moreItems(shopify).find((m) => m.source.kind === "directory")!;
    expect(cardError(viaDirectory, true)).toBeUndefined();
    expect(cardError({ ...viaDirectory, item: { ...viaDirectory.item, body: "Invented." } }, true)).toMatch(/directory copy/);
  });

  it("under the Shopify heading every card's status is its Shopify build's, and a capability with no live or beta Shopify build is left out", () => {
    for (const b of COMPETITOR_BRIEFS.filter((x) => !compareRoute(x).global)) {
      const ids = new Set(moreItems(b).map((m) => m.capabilityId));
      for (const m of moreItems(b)) {
        expect(["live", "beta"]).toContain(m.item.status);
        expect(m.item.status, m.item.title).toBe(capabilityFacts(m.capabilityId, "shopify").status);
      }
      // WhatsApp shopping has no Shopify build of its own, so it is not listed with a WhatsApp status.
      expect(ids.has("commerce.whatsapp_shopping")).toBe(false);
    }
    expect(buildComparisonContent(COMPETITOR_BRIEFS.find((b) => !compareRoute(b).global)!).more!.intro).toMatch(/build in the Shopify app/);
  });

  it("has no empty or title-only card on any comparison", () => {
    for (const b of COMPETITOR_BRIEFS) for (const m of moreItems(b)) expect(m.item.body.length, `${b.slug}: ${m.item.title}`).toBeGreaterThan(0);
  });

  it("a feature's card links to the same place as its Shopify directory card", () => {
    const shopify = COMPETITOR_BRIEFS.find((b) => !compareRoute(b).global)!;
    for (const m of moreItems(shopify)) {
      const d = DIRECTORY_CAPABILITIES.find((x) => x.capabilityId === m.capabilityId)!;
      expect(m.item.href, m.item.title).toBe(directoryCard(d).href);
    }
  });

  it("the global intro leaves out the Shopify-list sentence when the Shopify directory is not openable", () => {
    const b = COMPETITOR_BRIEFS.find((x) => compareRoute(x).global)!;
    const rec = getPage("shopify.features");
    const saved = { editorialStatus: rec.editorialStatus, indexable: rec.indexable };
    production();
    try {
      Object.assign(rec, { editorialStatus: "review", indexable: false });
      const more = buildComparisonContent(b).more!;
      expect(more.links.some((l) => l.href === "/shopify/features")).toBe(false);
      expect(more.intro).not.toContain("Shopify");
    } finally {
      Object.assign(rec, saved);
    }
    const back = buildComparisonContent(b).more!;
    expect(back.intro).toContain("Shopify list");
  });

  it("the footer links Compare once the directory is publishable (a published child)", () => {
    const rec = getPage("shopify.compare");
    const saved = { editorialStatus: rec.editorialStatus, indexable: rec.indexable };
    const t = ((k: string) => k) as Parameters<typeof footerGroups>[0];
    const hrefs = () => footerGroups(t).flatMap((g) => g.links.map((l) => l.href));
    expect(hrefs()).not.toContain("/shopify/compare");
    try {
      Object.assign(rec, { editorialStatus: "published", indexable: true });
      expect(isPublishable(rec)).toBe(true);
      expect(hrefs()).toContain("/shopify/compare");
    } finally {
      Object.assign(rec, saved);
    }
  });

  it("a Compared band never puts two equal tones together, and the status band keeps its tone on dev and production", () => {
    const toneOf = (html: string) =>
      [...html.matchAll(/<section id="([^"]+)"[^>]*class="([^"]*)"/g)].map((m) => ({ id: m[1]!, muted: m[2]!.includes("bg-muted") }));
    const ids = ["shopify.features.ai.shopping.assistant", "shopify.features.whatsapp.cod.confirmation", "shopify.features.bundles", "shopify.features.seo.audit"];
    for (const id of ids) {
      const page = getPage(id);
      const content = ({ ...ASSISTANT } as typeof ASSISTANT);
      const dev = toneOf(renderToStaticMarkup(<ShopifyFeaturePage page={page} content={content} />));
      production();
      const prod = toneOf(renderToStaticMarkup(<ShopifyFeaturePage page={page} content={content} />));
      vi.unstubAllEnvs();
      expect(dev.find((b) => b.id === "status")?.muted, id).toBe(prod.find((b) => b.id === "status")?.muted);
      // Plain bands carry no class marker, so adjacency is checked on the muted flag plus the plain FAQ that follows the last band.
      for (let k = 1; k < dev.length; k++) {
        if (dev[k]!.id === "faq" || dev[k]!.id === "related") continue;
        expect(dev[k]!.muted && dev[k - 1]!.muted, `${id}: ${dev[k - 1]!.id} and ${dev[k]!.id}`).toBe(false);
      }
      // The Compared block is on the page either as its own muted band or inside the permissions band.
      expect(renderToStaticMarkup(<ShopifyFeaturePage page={page} content={content} />)).toContain('id="compared"');
    }
  });
});
