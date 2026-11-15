import {
  anchorHrefs, canonicalOf, directAnswer, h1s, hasFabricatedField, internalPaths, jsonLd, ogUrlOf, textOf, typesOf,
} from "./html";

/*
 * The registry crawl of the SEO smoke suite (SEO-12). It reads the pages to expect from the registry (passed
 * in by smoke.ts) and fetches each from the target. Bible checks covered here: T03, T04, T05, T06, T07, T09
 * (every crawled response), T14, T15, and the draft ribbon.
 */

type PageRef = { pageId: string; path: string; h1: string; /** The coming-soon gate hides this path (gate on only). */ gated?: boolean };
type Check = (name: string, ok: boolean, detail?: string) => void;

export type CrawlOptions = {
  base: string;
  indexable: boolean;
  canonicalOrigin: string;
  publishable: PageRef[];
  drafts: PageRef[];
  /** Publishable pages the coming-soon gate hides: each must answer the teaser under noindex (empty when the gate is off). */
  gatedOut: PageRef[];
  teaserTitle: string;
  /** Lowercase URL prefixes of the locales that are declared but not published. */
  unpublishedLocales: string[];
  check: Check;
};

type Res = { status: number; robots: string | null; location: string | null; body: string };

/** One request. A network error or a 20 s stall becomes status 0, which fails that URL's check and lets the run go on. */
async function get(base: string, path: string): Promise<Res> {
  try {
    const res = await fetch(`${base}${path}`, {
      redirect: "manual",
      headers: { "user-agent": "peakhour-seo-smoke" },
      signal: AbortSignal.timeout(20_000),
    });
    const body = res.status >= 300 && res.status < 400 ? "" : await res.text();
    return { status: res.status, robots: res.headers.get("x-robots-tag"), location: res.headers.get("location"), body };
  } catch (e) {
    return { status: 0, robots: null, location: null, body: `request failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Run `fn` over `items`, `size` at a time, keeping order. */
async function pool<T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const noindexAll = (r: string | null) => !!r && /noindex/i.test(r) && /nofollow/i.test(r);

/**
 * Pages that carry no JSON-LD today: the plain legal, contact and launch-partner pages, which have no visible breadcrumb trail
 * and, by Bible 9.3, markup must match what is drawn. A parse error still fails them. Adding a trail removes the path from here
 * (listed as a follow-up in docs/seo/IMPLEMENTATION_GAPS.md).
 */
export const NO_JSON_LD_YET: ReadonlySet<string> = new Set([
  "/launch-partner", "/contact", "/privacy-policy", "/terms", "/cookie-policy", "/data-deletion", "/help/data-retention",
]);

/** Unknown URLs under every family and locale prefix. `/integrations/x` is a real page, so it is not here. */
export const UNKNOWN_URLS = [
  "/shopify/features/zzz", "/shopify/compare/zzz", "/shopify/guides/zzz", "/shopify/zzz",
  "/integrations/zzz", "/features/zzz", "/guides/zzz", "/industries/zzz", "/compare/zzz", "/compare",
];

/** One 404 probe per locale prefix that is not published (smoke.ts derives them from LOCALES and PUBLISHED_LOCALES). */
export function unpublishedLocaleUrls(prefixes: readonly string[]): string[] {
  return prefixes.flatMap((p) => [`/${p}`, `/${p}/x`, `/${p}/shopify`, `/${p}/shopify/features/zzz`, `/${p}/pricing`]);
}

export async function crawlChecks(o: CrawlOptions): Promise<void> {
  const { base, indexable, check } = o;
  const origins = [o.canonicalOrigin, base, "https://peakhour.ai", "https://www.peakhour.ai"];
  console.log(`\nregistry crawl: ${o.publishable.length} publishable page(s), ${o.gatedOut.length} hidden by the gate, ${o.drafts.length} draft(s)`);

  // Fetch every publishable page once, then run the page checks off the held HTML.
  const pages = await pool(o.publishable, 6, async (p) => ({ p, r: await get(base, p.path) }));

  for (const { p, r } of pages) {
    const where = p.path;
    check(`${where} answers 200`, r.status === 200, String(r.status));
    if (r.status !== 200) continue;
    if (!indexable) check(`T09 ${where} carries X-Robots-Tag: noindex, nofollow`, noindexAll(r.robots), String(r.robots));
    else check(`T09 ${where} has no blanket noindex`, !/noindex/i.test(r.robots ?? ""), String(r.robots));

    // T03: one canonical origin, self-canonical, and og:url agrees.
    const canonical = canonicalOf(r.body);
    const want = `${o.canonicalOrigin}${p.path === "/" ? "" : p.path}`;
    check(`T03 ${where} canonical is ${want || "the origin"}`, canonical === want, String(canonical));
    const og = ogUrlOf(r.body);
    check(`T03 ${where} og:url is the canonical`, og === want, String(og));

    // T04 + T05: one H1, the registry's; a direct answer; real anchors, all in the server HTML.
    const heads = h1s(r.body);
    check(`T05 ${where} has exactly one H1 in the server HTML`, heads.length === 1, `${heads.length}`);
    check(`T04 ${where} H1 is the registry's`, heads[0] === p.h1, `page "${heads[0]}" vs registry "${p.h1}"`);
    const answer = directAnswer(r.body);
    check(`T05 ${where} has a direct-answer paragraph after the H1`, !!answer, "no <p> of 60+ characters after the H1");
    const links = internalPaths(anchorHrefs(r.body), origins);
    check(`T05 ${where} has <a href> internal links in the server HTML`, links.length >= 3, `${links.length}`);

    // T14: JSON-LD parses, has no review fields, and matches the page.
    const ld = jsonLd(r.body);
    const needsLd = !NO_JSON_LD_YET.has(where);
    check(`T14 ${where} has JSON-LD, and it parses (${ld.nodes.length} node(s))`, (ld.nodes.length > 0 || !needsLd) && ld.errors.length === 0, ld.errors.join("; ") || "no JSON-LD found");
    const fabricated = hasFabricatedField(ld.nodes);
    check(`T14 ${where} JSON-LD has no review or rating field`, !fabricated, String(fabricated));
    // The visible text only: JSON-LD and the flight payload live in <script>, and a question found there is not "drawn".
    const text = textOf(r.body.replace(/<script(?=[\s>])[\s\S]*?<\/script>/gi, "").replace(/<style(?=[\s>])[\s\S]*?<\/style>/gi, ""));
    for (const n of ld.nodes) {
      const types = typesOf(n);
      const type = ["BreadcrumbList", "Article", "FAQPage", "SoftwareApplication"].find((t) => types.includes(t)) ?? "";
      if (type === "BreadcrumbList") {
        const items = (n.itemListElement as { item?: string }[] | undefined) ?? [];
        const last = items[items.length - 1]?.item;
        check(`T14 ${where} breadcrumb ends at this page`, last === want, `${last} vs ${want}`);
      } else if (type === "Article") {
        check(`T14 ${where} Article headline is the H1`, n.headline === heads[0], `${String(n.headline)} vs ${heads[0]}`);
      } else if (type === "FAQPage") {
        const qs = ((n.mainEntity as { name?: string }[] | undefined) ?? []).map((q) => String(q.name));
        const missing = qs.filter((q) => !text.includes(q));
        check(`T14 ${where} every FAQ question is visible on the page`, qs.length > 0 && missing.length === 0, missing.join(" | ") || "no questions");
      } else if (type === "SoftwareApplication") {
        check(`T14 ${where} SoftwareApplication url is this page`, n.url === want, String(n.url));
      }
    }
  }

  // T06: a trailing slash is one permanent hop to the clean URL, which answers 200 with no further hop.
  await pool(o.publishable.filter((p) => p.path !== "/"), 6, async (p) => {
    const r = await get(base, `${p.path}/`);
    const to = r.location ? new URL(r.location, base) : undefined;
    const target = to?.pathname ?? "";
    const sameHost = !!to && (to.origin === new URL(base).origin || to.origin === o.canonicalOrigin);
    check(`T06 ${p.path}/ is one 308 to ${p.path}, on the same host, with no query`, r.status === 308 && target === p.path && sameHost && !to?.search, `${r.status} ${r.location}`);
    if (r.status === 308) {
      const next = await get(base, target);
      check(`T06 ${p.path}/ lands on a page, not a second redirect`, next.status === 200, String(next.status));
    }
  });

  // T07: an unknown URL is a real 404 under every family and locale prefix.
  const unknown = [...UNKNOWN_URLS, ...unpublishedLocaleUrls(o.unpublishedLocales)];
  for (const { path, r } of await pool(unknown, 6, async (path) => ({ path, r: await get(base, path) }))) {
    check(`T07 ${path} is 404`, r.status === 404, String(r.status));
    if (!indexable) check(`T09 ${path} (404) carries noindex, nofollow`, noindexAll(r.robots), String(r.robots));
  }

  // T15: every internal link on every publishable page resolves, followed one hop (a page's links, not their links).
  // A link may answer 200, or one redirect (to a sign-in or an install route) whose target answers 200.
  const linked = new Map<string, string>();
  for (const { p, r } of pages) {
    if (r.status !== 200) continue;
    for (const l of internalPaths(anchorHrefs(r.body), origins)) if (!linked.has(l)) linked.set(l, p.path);
  }
  const targets = [...linked.keys()].sort();
  console.log(`T15: ${targets.length} distinct internal link target(s) across ${pages.length} page(s)`);
  const probed = await pool(targets, 6, async (path) => ({ path, r: await get(base, path) }));
  for (const { path, r } of probed) {
    let ok = r.status === 200;
    let detail = `${r.status}${r.location ? ` -> ${r.location}` : ""}`;
    if (!ok && r.status >= 300 && r.status < 400 && r.location) {
      const to = new URL(r.location, base);
      if (to.origin === new URL(base).origin) {
        const hop = await get(base, `${to.pathname}${to.search}`);
        ok = hop.status === 200;
        detail += ` -> ${hop.status}`;
      } else {
        ok = true; // an off-site redirect target is not ours to probe
      }
    }
    check(`T15 ${path} (linked from ${linked.get(path)}) resolves`, ok, detail);
  }

  // Gate on: a publishable page the gate hides serves the teaser (200), noindex, never the page itself.
  // The teaser always carries noindex for a hidden real page (gatedVerdict "teaser-noindex"), on Production too.
  const teaser = async (p: PageRef, what: string) => {
    const r = await get(base, p.path);
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(r.body)?.[1] ?? "";
    check(`gate: ${p.path} (${what}) serves the teaser under noindex`, r.status === 200 && title.includes(o.teaserTitle) && /noindex/i.test(r.robots ?? ""), `${r.status} ${title} ${r.robots}`);
  };
  for (const p of o.gatedOut) await teaser(p, "publishable, gated");

  // Drafts: on a non-indexable deployment each renders, under the ribbon, with noindex. (On Production they 404.)
  for (const p of o.drafts) {
    if (p.gated) {
      await teaser(p, "draft, gated");
      continue;
    }
    const r = await get(base, p.path);
    if (indexable) {
      check(`draft ${p.path} is 404 on Production`, r.status === 404, String(r.status));
      continue;
    }
    check(`draft ${p.path} renders on dev`, r.status === 200, String(r.status));
    if (r.status !== 200) continue;
    check(`draft ${p.path} shows the draft ribbon`, r.body.includes("Draft, not published"), "no ribbon");
    check(`draft ${p.path} carries noindex, nofollow`, noindexAll(r.robots), String(r.robots));
    const heads = h1s(r.body);
    check(`draft ${p.path} has one H1`, heads.length === 1, `${heads.length}`);
  }
}
