import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GOOGLE_ADS_PREFIX,
  GOOGLE_ADS_MANAGED_ROUTES,
  findGoogleAdsPaths,
  googleAdsUrl,
  isBareGoogleAdsMount,
  isManagedGoogleAdsPath,
  type GoogleAdsManagedRoute,
} from "./google-ads-surface";
import { ADS_CHANNELS } from "@/app/(site)/dashboard/ads/ads-channels";

/**
 * ★★G-15 — the Google panel reaches Google Ads only through the managed
 * routes (G-09: every campaign an `ad_campaigns` row, created PAUSED), only
 * through the client, and only for Search. The Meta guard's shape
 * (`meta-ads-surface.test.ts`), with each assertion paired with what makes it
 * non-vacuous.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));
/** The files allowed to name a Google-ads path: the contract, its test, and the one client. */
const ALLOWED = ["src/lib/google-ads-surface.ts", "src/lib/google-ads-surface.test.ts", "src/lib/api/google-ads.ts"];
const rel = (abs: string) => relative(join(SRC, ".."), abs).split("\\").join("/");
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}
const read = (repoRel: string) => readFileSync(join(SRC, "..", repoRel), "utf8");
const PANEL = "src/app/(site)/dashboard/ads/_components/google-ads-panel.tsx";
const CLIENT = "src/lib/api/google-ads.ts";
const VIEW = "src/lib/google-ads-view.ts";

describe("★★G-15 — no b2c file names a Google ads path but the client", () => {
  const all = sourceFiles(SRC);
  const scanned = all.filter((f) => !ALLOWED.includes(rel(f)));

  it("★the scan actually read this repository, and the allowed files exist", () => {
    expect(scanned.length).toBeGreaterThan(200);
    expect(scanned.some((f) => rel(f) === PANEL)).toBe(true);
    expect(all.map(rel).filter((p) => ALLOWED.includes(p)).sort()).toEqual([...ALLOWED].sort());
  });

  it("★★no other file names a Google ads path — the panel included", () => {
    const named = scanned
      .map((f) => ({ file: rel(f), paths: findGoogleAdsPaths(readFileSync(f, "utf8")).filter((p) => !isBareGoogleAdsMount(p)) }))
      .filter((x) => x.paths.length > 0);
    expect(named).toEqual([]);
  });

  it("★and the scan SAYS SO when there is something to find", () => {
    expect(findGoogleAdsPaths('api.get("/v1/google/ads/campaigns")')).toEqual(["/v1/google/ads/campaigns"]);
    expect(findGoogleAdsPaths("api.patch(`/v1/google/ads/campaigns/${id}/status`)")).toEqual(["/v1/google/ads/campaigns/${id}/status"]);
  });

  it("the sibling Google mounts are not swept up, nor is punctuation", () => {
    expect(findGoogleAdsPaths('"/v1/google/business-profile/locations"')).toEqual([]);
    expect(findGoogleAdsPaths('"/v1/google/adsense"')).toEqual([]);
    expect(findGoogleAdsPaths("see /v1/google/ads/campaigns.")).toEqual(["/v1/google/ads/campaigns"]);
  });

  it("★★every path in the client is managed, and is handed to googleAdsUrl — never to `api` raw", () => {
    const client = read(CLIENT);
    const paths = findGoogleAdsPaths(client);
    expect(paths.length).toBeGreaterThanOrEqual(3);
    for (const p of paths) expect(isManagedGoogleAdsPath(p), p).toBe(true);
    // Each `api.<verb>(` call's first argument is a googleAdsUrl(...) call.
    const calls = [...client.matchAll(/api\.(get|post|put|patch|delete)<[^>]*>\(\s*([^,)]+)/g)].map((m) => m[2]!.trim());
    expect(calls.length).toBe(6);
    for (const arg of calls) expect(arg.startsWith("googleAdsUrl("), arg).toBe(true);
  });

  it("★and that check SAYS SO when there is something to find", () => {
    const bad = 'api.get<X>("/v1/google/ads/campaigns")';
    const arg = [...bad.matchAll(/api\.(get|post|put|patch|delete)<[^>]*>\(\s*([^,)]+)/g)].map((m) => m[2]!.trim())[0];
    expect(arg!.startsWith("googleAdsUrl(")).toBe(false);
  });
});

describe("★★G-17b — the conversion-action route is managed, and the client calls it by both verbs", () => {
  it("is on the managed list", () => {
    expect(GOOGLE_ADS_MANAGED_ROUTES).toContain(`${GOOGLE_ADS_PREFIX}/conversion-action`);
    expect(googleAdsUrl("/v1/google/ads/conversion-action")).toBe("/v1/google/ads/conversion-action");
  });
  it("the client reads with GET (with the account) and chooses with PUT", () => {
    const client = read(CLIENT);
    expect(client).toMatch(/api\.get<GoogleConversionActionState>\(googleAdsUrl\("\/v1\/google\/ads\/conversion-action"\)/);
    expect(client).toMatch(/api\.put<GoogleConversionActionChosen>\(googleAdsUrl\("\/v1\/google\/ads\/conversion-action"\)/);
    expect(client).toContain("?adAccountId=${encodeURIComponent(adAccountId)}");
  });
});

describe("★★googleAdsUrl, so a panel never has to write a literal", () => {
  it("fills the params, and the result is itself a managed path", () => {
    const url = googleAdsUrl("/v1/google/ads/campaigns/:id/status", { id: "6731f0aa" });
    expect(url).toBe("/v1/google/ads/campaigns/6731f0aa/status");
    expect(isManagedGoogleAdsPath(url)).toBe(true);
  });
  it("refuses a missing param rather than emitting a path with a hole in it", () => {
    expect(() => googleAdsUrl("/v1/google/ads/campaigns/:id/status")).toThrow(/needs :id/);
  });
  it("refuses a route that is not on the managed list", () => {
    expect(() => googleAdsUrl("/v1/google/ads/audiences" as GoogleAdsManagedRoute)).toThrow(/not a managed/);
  });
  it("PASS: a managed path with an id is managed; one with an extra segment is not", () => {
    expect(isManagedGoogleAdsPath("/v1/google/ads/campaigns/abc123/status")).toBe(true);
    expect(isManagedGoogleAdsPath("/v1/google/ads/campaigns/abc123/status/x")).toBe(false);
    expect(isManagedGoogleAdsPath("/v1/google/ads/keywords")).toBe(false);
  });
});

describe("★★G-15 — the hub HAS a Google tab, reached only through the client", () => {
  it("ADS_CHANNELS registers the Google channel on google_ads", () => {
    const g = ADS_CHANNELS.find((c) => c.key === "google");
    expect(g?.providerKey).toBe("google_ads");
  });
  it("★the panel reaches Google through googleAdsApi", () => {
    const panel = read(PANEL);
    expect(panel).toMatch(/from "@\/lib\/api\/google-ads"/);
    expect(panel).toContain("googleAdsApi.");
  });
});

/**
 * ★★SEARCH, PERFORMANCE MAX AND YOUTUBE VIDEO (DEMAND GEN) ONLY (the plan's
 * G-15 row, widened by G19 and G20): "a surface that offers a campaign type
 * the adapter refuses is worse than one that offers fewer". The api creates
 * those three; every merchant-facing source of the Google channel is read for
 * any OTHER campaign type's name — and for the words "Video campaign", the
 * type Google's API can no longer create (YouTube video ads are Demand Gen).
 */
describe("★★G-15/G19/G20 — nothing implies a Google campaign type but Search, Performance Max and YouTube video (Demand Gen)", () => {
  // ★CASE-INSENSITIVE (review round 1): the copy this row removed said
  //  "search and display", lower-case. ★AND PLURAL (G20): "Video campaigns" ends
  //  in no word boundary after "campaign", so the singular alone missed it.
  const OTHER_TYPES = /\b(Discovery|Display|Shopping|Video campaigns?|App campaigns?|Smart campaigns?)\b/i;
  const googleEntry = (text: string, start: string) => text.slice(text.indexOf(start), text.indexOf("}", text.indexOf(start)));
  it.each([
    ["the panel", () => read(PANEL)],
    ["the client", () => read(CLIENT)],
    ["the view helpers", () => read(VIEW)],
    ["the hub entry", () => googleEntry(read("src/app/(site)/dashboard/ads/ads-channels.ts"), 'key: "google"')],
    ["the catalog entry", () => googleEntry(read("src/app/(site)/dashboard/content/channels.config.ts"), 'slug: "google-ads"')],
  ])("★%s names no other campaign type", (_l, text) => {
    const t = text();
    expect(t.length).toBeGreaterThan(50);
    expect(t.match(OTHER_TYPES)?.[0] ?? null).toBeNull();
  });
  it("★and the check SAYS SO when there is something to find", () => {
    expect("Run search and Display campaigns".match(OTHER_TYPES)?.[0]).toBe("Display");
    // G19 and G20: Performance Max and Demand Gen are types the api creates, so naming them is not a false offer.
    expect("Try Performance Max".match(OTHER_TYPES)).toBeNull();
    expect("Try a YouTube video (Demand Gen) campaign".match(OTHER_TYPES)).toBeNull();
    // ★G20: the type Google's API cannot create, in any case.
    expect("Create a Video campaign".match(OTHER_TYPES)?.[0]).toBe("Video campaign");
    expect("youtube video campaigns".match(OTHER_TYPES)?.[0]).toBe("video campaigns");
    // The exact catalog copy G-15 replaced.
    expect("Run search and display campaigns from approved creative.".match(OTHER_TYPES)?.[0]).toBe("display");
  });
  it("★★G19: the panel offers Performance Max and says, wherever it does, that Google does not report who saw its ads", () => {
    const panel = read(PANEL);
    expect(panel).toContain('<SelectItem value="PERFORMANCE_MAX">Performance Max</SelectItem>');
    // RENDERED in the form, on each listed row, and in the start confirmation:
    // counted where it is shown, never in the import or a comment.
    const shown = panel.match(/\{GOOGLE_PMAX_REPORTING_NOTE\}|\$\{GOOGLE_PMAX_REPORTING_NOTE\}/g) ?? [];
    expect(shown.length).toBe(3);
    expect(read(VIEW)).toMatch(/GOOGLE_PMAX_REPORTING_NOTE =\s*"Google does not tell us who saw a Performance Max ad\./);
  });
  it("★the hub and catalog name the three types", () => {
    for (const entry of [
      googleEntry(read("src/app/(site)/dashboard/ads/ads-channels.ts"), 'key: "google"'),
      googleEntry(read("src/app/(site)/dashboard/content/channels.config.ts"), 'slug: "google-ads"'),
    ]) {
      expect(entry).toContain("Search");
      expect(entry).toContain("Performance Max");
      expect(entry).toContain("YouTube video (Demand Gen)");
    }
  });
  it("★★G20: the panel offers YouTube video (Demand Gen) and says, wherever it does, that Google does not report who saw its ads", () => {
    const panel = read(PANEL);
    expect(panel).toContain('<SelectItem value="DEMAND_GEN">YouTube video (Demand Gen)</SelectItem>');
    // The form, each listed row, and the start confirmation: where it is shown, never the import.
    const shown = panel.match(/\{GOOGLE_DEMAND_GEN_REPORTING_NOTE\}|\$\{GOOGLE_DEMAND_GEN_REPORTING_NOTE\}/g) ?? [];
    expect(shown.length).toBe(3);
    expect(read(VIEW)).toMatch(/GOOGLE_DEMAND_GEN_REPORTING_NOTE =\s*"Google does not tell us who saw a YouTube video ad\./);
    // ★A video is the merchant's own, already on YouTube: the panel never offers an upload.
    expect(panel).not.toMatch(/type="file"|upload a video|uploads? your video/i);
  });
});

describe("★★G-15 — the prefix and the routes are peakhour-api's", () => {
  const SIBLING_REPO = fileURLToPath(new URL("../../../peakhour-api", import.meta.url));
  const ROUTES_INDEX = fileURLToPath(new URL("../../../peakhour-api/src/v1/routes/index.ts", import.meta.url));
  const ROUTE_FILE = fileURLToPath(new URL("../../../peakhour-api/src/v1/routes/google-ads/index.ts", import.meta.url));
  const present = existsSync(SIBLING_REPO);
  if (!present) console.warn(`[g15] no peakhour-api checkout at ${SIBLING_REPO} — cross-repo cases SKIPPED`);
  // A missing checkout skips; a missing FILE inside a present checkout fails (M-13's rule).
  function readSibling(path: string): string {
    if (!existsSync(path)) throw new Error(`[g15] peakhour-api is checked out but ${path} is missing — the Google ads router moved.`);
    return readFileSync(path, "utf8");
  }

  it.skipIf(!present)("★★GOOGLE_ADS_PREFIX is the mount the api serves", () => {
    const index = readSibling(ROUTES_INDEX);
    const base = /new Hono<[^>]*>\(\)\.basePath\("([^"]+)"\)/.exec(index)?.[1];
    const imp = /import (\w+) from "\.\/google-ads\/index\.js";/.exec(index)?.[1];
    expect(base).toBe("/v1");
    expect(imp).toBeTruthy();
    const mount = new RegExp(`v1\\.route\\("([^"]+)",\\s*${imp}\\)`).exec(index)?.[1];
    expect(`${base}${mount}`).toBe(GOOGLE_ADS_PREFIX);
  });

  it.skipIf(!present)("★★every managed route is one the api's Google router declares, with the verb the client uses", () => {
    const file = readSibling(ROUTE_FILE);
    const declared = new Set([...file.matchAll(/app\.(get|post|put|patch|delete)\("([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`));
    expect(declared.size).toBeGreaterThanOrEqual(4);
    const client = read(CLIENT);
    const used = [...client.matchAll(/api\.(get|post|put|patch|delete)<[^>]*>\(\s*googleAdsUrl\("([^"]+)"/g)].map(
      (m) => `${m[1]} ${m[2]!.slice(GOOGLE_ADS_PREFIX.length)}`,
    );
    expect(used.length).toBe(6);
    for (const u of used) expect(declared.has(u), u).toBe(true);
    for (const r of GOOGLE_ADS_MANAGED_ROUTES) {
      const sub = r.slice(GOOGLE_ADS_PREFIX.length);
      expect([...declared].some((d) => d.endsWith(` ${sub}`)), sub).toBe(true);
    }
  });
});
