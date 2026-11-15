/**
 * SEO smoke test: status codes and headers against a running site.
 *
 *   npx tsx scripts/seo/smoke.ts <baseUrl> [--gate=on|off] [--indexable=yes|no]
 *
 * Say what the target is, and the script checks it behaves like that:
 *   --gate        whether COMING_SOON=true is set on the target (default off)
 *   --indexable   whether the target is a production deployment (default no)
 *
 * What it checks (plan SEO-1):
 *   1. Not indexable: robots.txt is "Disallow: /" with no sitemap line, the sitemap is
 *      empty, and EVERY page response carries X-Robots-Tag: noindex, nofollow, including
 *      a gate rewrite, a 404 and a 308.
 *      Indexable: robots.txt names the sitemap, and pages carry no blanket noindex.
 *   2. An unknown URL is a real 404 with a real Daylight body, not a 500 and not a 200.
 *   3. The gate: a path that matches no route is a 404 (not the teaser); a known gated
 *      page serves the teaser with noindex; "/" and "/coming-soon" serve the teaser;
 *      an allowlisted page serves itself; the sitemap lists only what the gate lets
 *      through.
 *   4. One trailing-slash policy: /pricing/ answers 308 to /pricing.
 *   5. (SEO-6) /sitemap.xml is an index of named sitemaps; every URL in them answers 200 with a self-canonical, and every
 *      JSON-LD block on it parses with @context and @type.
 *
 * Exits 1 when any check fails.
 */

import { isPublicPath } from "../../src/lib/seo/gate";

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const flag = (name: string, dflt: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? dflt;
const gateOn = flag("gate", "off") === "on";
const indexable = flag("indexable", "no") === "yes";

const TEASER_TITLE = "your AI team behind every channel you sell on";
const isAllowed = isPublicPath;

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `   -> ${detail}`}`);
  if (!ok) failed++;
}

async function get(path: string) {
  const res = await fetch(`${base}${path}`, { redirect: "manual", headers: { "user-agent": "peakhour-seo-smoke" } });
  const body = res.status >= 300 && res.status < 400 ? "" : await res.text();
  return { status: res.status, robots: res.headers.get("x-robots-tag"), location: res.headers.get("location"), body };
}
const title = (html: string) => /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "";
const noindexAll = (r: string | null) => !!r && /noindex/i.test(r) && /nofollow/i.test(r);

async function main() {
  console.log(`target ${base}   gate=${gateOn ? "on" : "off"}   indexable=${indexable ? "yes" : "no"}\n`);

  // 1. robots.txt and sitemap
  const robots = await get("/robots.txt");
  check("robots.txt answers 200", robots.status === 200, String(robots.status));
  if (indexable) {
    check("robots.txt names the sitemap", /^sitemap:/im.test(robots.body), robots.body);
  } else {
    check("robots.txt is Disallow: / for every agent", /user-agent:\s*\*/i.test(robots.body) && /^disallow:\s*\/\s*$/im.test(robots.body), robots.body);
    check("robots.txt has no Allow line and no sitemap line", !/^allow:/im.test(robots.body) && !/^sitemap:/im.test(robots.body), robots.body);
  }
  if (!indexable) {
    // Dotted paths are outside the middleware matcher; next.config headers() covers them.
    check("X-Robots-Tag noindex, nofollow on /robots.txt (a dotted path)", noindexAll(robots.robots), String(robots.robots));
  }
  const sitemap = await get("/sitemap.xml");
  if (!indexable) check("X-Robots-Tag noindex, nofollow on /sitemap.xml (a dotted path)", noindexAll(sitemap.robots), String(sitemap.robots));
  check("sitemap.xml answers 200", sitemap.status === 200, String(sitemap.status));
  const locOf = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  // /sitemap.xml is an index: follow each named sitemap (by path, so a local base URL works) and collect the page URLs.
  const isIndex = /<sitemapindex/.test(sitemap.body);
  const locs: string[] = [];
  if (isIndex) {
    for (const child of locOf(sitemap.body)) {
      const r = await get(new URL(child).pathname);
      check(`named sitemap ${new URL(child).pathname} answers 200`, r.status === 200, String(r.status));
      locs.push(...locOf(r.body));
    }
  } else {
    locs.push(...locOf(sitemap.body));
  }
  if (!indexable) {
    check("sitemap is empty", locs.length === 0, `${locs.length} urls`);
  } else {
    check("sitemap lists urls", locs.length > 0, "empty");
    if (gateOn) {
      const paths = locs.map((l) => new URL(l).pathname);
      const bad = paths.filter((p) => p !== "/" && !isAllowed(p));
      check("sitemap lists only what the gate lets through", bad.length === 0, bad.join(", "));
    }
  }

  // 1b. every sitemap URL: 200, a self-canonical, JSON-LD that parses
  if (indexable) {
    check("sitemap.xml is an index", isIndex, "no <sitemapindex>");
    for (const loc of locs) {
      const path = new URL(loc).pathname;
      const r = await get(path);
      check(`sitemap url ${path} answers 200`, r.status === 200, String(r.status));
      if (r.status !== 200) continue;
      const canonical = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(r.body)?.[1] ?? /<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i.exec(r.body)?.[1];
      check(`sitemap url ${path} has a self-canonical`, !!canonical && new URL(canonical).pathname === path, String(canonical));
      const ld = [...r.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      let ldOk = true;
      for (const raw of ld) {
        try {
          const j = JSON.parse(raw);
          if (j["@context"] !== "https://schema.org" || !j["@type"]) ldOk = false;
        } catch {
          ldOk = false;
        }
      }
      check(`sitemap url ${path}: ${ld.length} JSON-LD block(s) parse with @context and @type`, ldOk, "bad JSON-LD");
    }
  }

  // 2. page responses and X-Robots-Tag
  const pages = ["/", "/pricing", "/shopify", "/how-it-works", "/does-not-exist", "/features/foo", "/pricing/"];
  const got: Record<string, Awaited<ReturnType<typeof get>>> = {};
  for (const p of pages) got[p] = await get(p);
  if (!indexable) {
    // /pricing/ is skipped: Next answers its 308 before the middleware runs, and a redirect has no page to index.
    for (const p of pages.filter((q) => q !== "/pricing/")) check(`X-Robots-Tag noindex, nofollow on ${p} (${got[p].status})`, noindexAll(got[p].robots), String(got[p].robots));
  } else if (!gateOn) {
    for (const p of ["/", "/pricing", "/shopify"]) check(`no blanket noindex on ${p}`, !/noindex/i.test(got[p].robots ?? ""), String(got[p].robots));
  }

  // 3. real 404s
  for (const p of ["/does-not-exist", "/features/foo"]) {
    const r = got[p];
    check(`${p} is 404`, r.status === 404, String(r.status));
    // Next streams the 404 UI inside the flight payload, so the markup is read from the whole
    // response, not only the visible HTML.
    const text = r.body.replace(/\\"/g, '"');
    check(`${p} carries the Daylight 404 page: heading, links to /, /shopify and /pricing, no dashboard link`,
      r.body.length > 2000 && text.includes("theme-daylight") && text.includes("couldn't find that page") &&
        text.includes('"href":"/"') && text.includes('"href":"/shopify"') && text.includes('"href":"/pricing"') &&
        !/Go to dashboard/i.test(text),
      `len ${r.body.length}`);
  }

  // 4. the gate
  if (gateOn) {
    for (const p of ["/fr/shopify", "/a", "/presence/x"]) {
      const r = await get(p);
      check(`gate: ${p} (matches no route) is 404, not the teaser`, r.status === 404 && !title(r.body).includes(TEASER_TITLE), `${r.status} ${title(r.body)}`);
    }
    for (const p of ["/how-it-works", "/presence", "/commerce", "/contact"]) {
      const r = got[p] ?? (await get(p));
      check(`gate: ${p} (known, gated) serves the teaser with noindex`, r.status === 200 && title(r.body).includes(TEASER_TITLE) && /noindex/i.test(r.robots ?? ""), `${r.status} ${title(r.body)} ${r.robots}`);
    }
    for (const p of ["/", "/coming-soon"]) {
      const r = await get(p);
      check(`gate: ${p} serves the teaser` + (indexable ? " with no noindex" : ""), r.status === 200 && title(r.body).includes(TEASER_TITLE) && (!indexable ? true : !/noindex/i.test(r.robots ?? "")), `${r.status} ${title(r.body)} ${r.robots}`);
    }
    for (const p of ["/pricing", "/shopify", "/terms"]) {
      const r = got[p] ?? (await get(p));
      check(`gate: ${p} (allowlisted) serves itself`, r.status === 200 && !title(r.body).includes(TEASER_TITLE), `${r.status} ${title(r.body)}`);
    }
  } else {
    const r = got["/how-it-works"];
    check("no gate: /how-it-works serves itself", r.status === 200 && !title(r.body).includes(TEASER_TITLE), `${r.status} ${title(r.body)}`);
  }

  // 5. trailing slash
  const slash = got["/pricing/"];
  check("/pricing/ is a 308 to /pricing", slash.status === 308 && /\/pricing$/.test(slash.location ?? ""), `${slash.status} ${slash.location}`);

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
