import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  META_ADS_MANAGED_ROUTES,
  META_ADS_DELETED_ROUTES,
  findMetaAdsPaths,
  isManagedMetaAdsPath,
} from "./meta-ads-surface";
import { ADS_CHANNELS } from "@/app/(site)/dashboard/ads/ads-channels";

/**
 * ★★M-13 — *"no surface creates a campaign invisible to the monitor."*
 *
 * ── ⚠️★★THE HARD PART OF THIS FILE IS NOT FINDING A CALLER ───────────────
 *
 * It is that **there are none**. b2c has never called `/v1/meta-ads`: no
 * `lib/api/meta-ads.ts`, no panel, no `meta_ads` entry in `ADS_CHANNELS`. So a
 * test that merely scans `src/` and finds nothing passes **for the same reason
 * a broken scanner passes** — and a guard whose green run is indistinguishable
 * from a guard that cannot fire is the exact shape this programme keeps
 * catching only under mutation.
 *
 * Every assertion below is therefore paired with the thing that makes it
 * non-vacuous:
 *
 *  - the repo scan is paired with a **synthetic corpus** carrying a real
 *    passthrough reference, which the same code must flag;
 *  - the "no references" claim is paired with a **count of files actually
 *    read**, so a scan that walked an empty tree cannot pass;
 *  - the route list is paired with the **sibling api's own route file**, so a
 *    path that no handler serves cannot sit in it looking authoritative.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));

/**
 * The two files allowed to name a `/v1/meta-ads` path: the contract module and
 * this test. Asserted to be exactly these two, so a third cannot join them by
 * being added to the list in the same commit that needed the exemption.
 */
const SELF = ["meta-ads-surface.ts", "meta-ads-surface.test.ts"];

/** Every `.ts`/`.tsx` under `src/`, minus this pair. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !SELF.includes(entry)) {
      out.push(full);
    }
  }
  return out;
}

const SIBLING_ROUTE_FILE = fileURLToPath(
  new URL("../../../peakhour-api/src/v1/routes/meta-ads/index.ts", import.meta.url),
);

// ══════════════════════════════════════════════════════════════════════════
describe("★★M-13 — b2c points at no Meta passthrough", () => {
  const files = sourceFiles(SRC);

  it("★★M-13 b2c the scan actually read this repository", () => {
    // ⚠️⚠️★WITHOUT THIS EVERY OTHER CASE IN THIS BLOCK IS A LOOP OVER ZERO
    // FILES. `sourceFiles` walks a path built from `import.meta.url`; one
    // wrong `..` and it returns `[]`, and "no b2c file calls a passthrough"
    // becomes true of a repository the test never opened.
    expect(files.length).toBeGreaterThan(200);
    expect(files.some((f) => f.endsWith("ads-channels.ts"))).toBe(true);
  });

  it("★★M-13 b2c no source file names a /v1/meta-ads path at all", () => {
    const named = files
      .map((f) => ({ file: f, paths: findMetaAdsPaths(readFileSync(f, "utf8")) }))
      .filter((x) => x.paths.length > 0);
    // ⏸THE MESSAGE CARRIES THE FILE, because the failure this is written for
    // arrives in somebody else's PR — M-16's — and "expected 1 to be 0" would
    // tell its author nothing about which route they may use instead.
    expect(
      named.map((x) => `${x.file}: ${x.paths.join(", ")}`),
      "a b2c file named a /v1/meta-ads path; only META_ADS_MANAGED_ROUTES may be called",
    ).toEqual([]);
  });

  it("★★M-13 b2c and every path it might name in future would have to be a managed one", () => {
    // ★THE PAIRED NON-VACUITY CASE. The scan above finds nothing today; this
    // proves the same code SAYS SO when there is something to find, using the
    // route that was deleted rather than an invented one.
    const panel = [
      'const r = await api.post("/v1/meta-ads/audiences", { name });',
      'const list = await api.get("/v1/meta-ads/campaigns?adAccountId=" + id);',
      "await api.patch(`/v1/meta-ads/campaigns/${campaignId}/status`, { status });",
    ].join("\n");

    const found = findMetaAdsPaths(panel);
    expect(found).toContain("/v1/meta-ads/audiences");

    const refused = found.filter((p) => !isManagedMetaAdsPath(p));
    expect(refused).toEqual(["/v1/meta-ads/audiences"]);
  });

  it("★★M-13 b2c a template path with an interpolated id is still matched, not waved through", () => {
    // ⚠️★A CALL SITE DOES NOT WRITE `:campaignId`. It writes `${campaignId}`,
    // and a string-equality check against the template would call every real
    // status call unmanaged — which is the guard firing on the one thing it
    // exists to permit, and the fix for that is always to weaken it.
    expect(isManagedMetaAdsPath("/v1/meta-ads/campaigns/${campaignId}/status")).toBe(true);
    expect(isManagedMetaAdsPath("/v1/meta-ads/ads/${adId}/status")).toBe(true);
    // ⏸AND A PARAM DOES NOT SWALLOW A SEGMENT BOUNDARY.
    expect(isManagedMetaAdsPath("/v1/meta-ads/campaigns/a/b/status")).toBe(false);
    // ⚠️⚠️★AND A LONGER PATH IS NOT A PREFIX MATCH. `expected.every(…)` walks
    // the TEMPLATE, so without the length comparison every path that merely
    // *starts* with a managed one is waved through — `…/status/anything`
    // included. Found by mutation: deleting that line killed no other case.
    expect(isManagedMetaAdsPath("/v1/meta-ads/campaigns/x/status/extra")).toBe(false);
  });

  it("★★M-13 b2c the deleted routes are refused, and are in neither list twice", () => {
    for (const deleted of META_ADS_DELETED_ROUTES) {
      expect(isManagedMetaAdsPath(deleted)).toBe(false);
      expect(META_ADS_MANAGED_ROUTES as readonly string[]).not.toContain(deleted);
    }
    expect(META_ADS_DELETED_ROUTES.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("★★M-13 — the ads hub has no Meta tab, and that is why there is nothing to unwire", () => {
  it("★★M-13 b2c ADS_CHANNELS registers no Meta channel — the panel is M-16 and is not started", () => {
    // ★THE FACT THE WHOLE ROW TURNED ON. *"b2c stops pointing at them"*
    // assumes a surface that no row creates; §9's own UI box says so. When
    // M-16 lands, this case fails — deliberately, so its author has to come
    // here and confirm the panel was built from META_ADS_MANAGED_ROUTES.
    expect(ADS_CHANNELS.map((c) => c.providerKey)).not.toContain("meta_ads");
    // ⏸PAIRED, because `[]` would satisfy the line above.
    expect(ADS_CHANNELS.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("★★M-13 — every route in the list is one peakhour-api actually serves", () => {
  /**
   * ⏸THE SIBLING CHECKOUT, OR A SKIP — `cron-metadata.test.ts`'s rule, for
   * its reason: a b2c-only clone should still have a green suite. ONLY the
   * read may skip; a present-but-wrong file fails.
   *
   * ⚠️★THE DELETED ROUTES ARE DELIBERATELY *NOT* ASSERTED ABSENT HERE. They
   * are removed in the api half of M-13, which is a separate PR, so this file
   * would be red on master until that merged — and a test that is red on
   * purpose is a test somebody disables. The b2c-side denylist above is what
   * carries them.
   */
  const source = existsSync(SIBLING_ROUTE_FILE)
    ? readFileSync(SIBLING_ROUTE_FILE, "utf8")
    : null;

  it.skipIf(source === null)(
    "★★M-13 b2c every managed route has a handler in peakhour-api's meta-ads route file",
    () => {
      const missing = META_ADS_MANAGED_ROUTES.filter((route) => {
        const mounted = route.replace("/v1/meta-ads", "");
        return !source!.includes(`"${mounted}"`);
      });
      expect(
        missing,
        "a route in META_ADS_MANAGED_ROUTES is served by no handler in peakhour-api",
      ).toEqual([]);
    },
  );

  it.skipIf(source === null)(
    "★★M-13 b2c and the sibling read is the route file, not some other file that happens to exist",
    () => {
      // ⚠️★NON-VACUITY AGAIN: `includes` over an empty string is false for
      // every route, so the case above would report "all missing" — but over
      // a file that is not the route file it could just as easily report
      // nothing missing by accident. Pin what was read.
      expect(source!).toContain('app.post("/campaigns"');
      expect(source!.length).toBeGreaterThan(1000);
    },
  );
});
