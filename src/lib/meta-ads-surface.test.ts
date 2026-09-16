import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  META_ADS_PREFIX,
  META_ADS_MANAGED_ROUTES,
  META_ADS_DELETED_ROUTES,
  findMetaAdsPaths,
  isManagedMetaAdsPath,
  metaAdsUrl,
} from "./meta-ads-surface";
import { ADS_CHANNELS } from "@/app/(site)/dashboard/ads/ads-channels";

/**
 * ★★M-13 — *"no surface creates a campaign invisible to the monitor."*
 *
 * ── ⚠️★★THE HARD PART OF THIS FILE IS NOT FINDING A CALLER ───────────────
 *
 * It is that **there are none**. b2c has never called the Meta ads router: no
 * `lib/api/meta-ads.ts`, no panel, no `meta_ads` entry in `ADS_CHANNELS`. So a
 * test that merely scans `src/` and finds nothing passes **for the same reason
 * a broken scanner passes** — and a guard whose green run is indistinguishable
 * from a guard that cannot fire is the exact shape this programme keeps
 * catching only under mutation.
 *
 * ⚠️⚠️★★AND THE FIRST VERSION OF THIS FILE WAS THAT GUARD. Every constant was
 * keyed on `/v1/meta-ads` — the ledger row's spelling, and the api's source
 * DIRECTORY — while the router is mounted at **`/v1/meta/ads`**. A probe
 * calling the deleted passthrough at its real path left the suite at 8 passed,
 * 0 failed. ★The cross-repo case read the SUB-paths and never the MOUNT, so
 * the one check whose purpose was *"is this list the api's?"* could not see a
 * list with the wrong prefix. It reads the mount now.
 *
 * Every assertion below is paired with the thing that makes it non-vacuous.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));

/**
 * The two files allowed to name a Meta-ads path: the contract module and this
 * test. ⚠️★BY REPO-RELATIVE PATH, NOT BASENAME (review round 1) — a basename
 * exemption silently covers any future `meta-ads-surface.ts` anywhere under
 * `src/`, including one a panel author drops beside their component.
 */
const SELF = ["src/lib/meta-ads-surface.ts", "src/lib/meta-ads-surface.test.ts"];

const rel = (abs: string) => relative(join(SRC, ".."), abs).split("\\").join("/");

/** Every `.ts`/`.tsx` under `src/`, with the two self files flagged. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const SIBLING_ROUTES_INDEX = fileURLToPath(
  new URL("../../../peakhour-api/src/v1/routes/index.ts", import.meta.url),
);
const SIBLING_ROUTE_FILE = fileURLToPath(
  new URL("../../../peakhour-api/src/v1/routes/meta-ads/index.ts", import.meta.url),
);

// ══════════════════════════════════════════════════════════════════════════
describe("★★M-13 — b2c points at no Meta passthrough", () => {
  const all = sourceFiles(SRC);
  const scanned = all.filter((f) => !SELF.includes(rel(f)));

  it("★★M-13 b2c the scan actually read this repository", () => {
    // ⚠️⚠️★WITHOUT THIS EVERY OTHER CASE IN THIS BLOCK IS A LOOP OVER ZERO
    // FILES. `sourceFiles` walks a path built from `import.meta.url`; one
    // wrong `..` and it returns `[]`, and "no b2c file calls a passthrough"
    // becomes true of a repository the test never opened.
    expect(scanned.length).toBeGreaterThan(200);
    expect(scanned.some((f) => f.endsWith("ads-channels.ts"))).toBe(true);
  });

  it("★★M-13 b2c the self-exemption covers exactly the two files it names, and both exist", () => {
    // ⚠️★ASSERTED, NOT CLAIMED IN A COMMENT (review round 1). The first cut
    // said "asserted to be exactly these two" beside no assertion at all — so
    // an exemption could have been added in the same commit that needed it.
    const found = all.map(rel).filter((p) => SELF.includes(p));
    expect(found.sort()).toEqual([...SELF].sort());
    expect(all.length - scanned.length).toBe(SELF.length);
  });

  it("★★M-13 b2c no source file names a Meta ads path outside the managed list", () => {
    const refused = scanned
      .map((f) => ({ file: rel(f), paths: findMetaAdsPaths(readFileSync(f, "utf8")) }))
      .flatMap((x) => x.paths.filter((p) => !isManagedMetaAdsPath(p)).map((p) => `${x.file}: ${p}`));
    // ⏸REFUSED, NOT *NAMED* (review round 1). The first cut refused every
    // Meta-ads path including the managed ones, under a message that said
    // only the unmanaged ones were forbidden — so M-16 wiring the panel to
    // the CORRECT route would go red and be told the route is permitted, and
    // the fix for that is always to weaken the guard.
    expect(
      refused,
      "a b2c file named a Meta ads path that is not in META_ADS_MANAGED_ROUTES",
    ).toEqual([]);
  });

  it("★★M-13 b2c and no source file names a DELETED route, managed-looking or not", () => {
    const deleted = scanned
      .map((f) => ({ file: rel(f), paths: findMetaAdsPaths(readFileSync(f, "utf8")) }))
      .flatMap((x) =>
        x.paths
          .filter((p) => (META_ADS_DELETED_ROUTES as readonly string[]).includes(p))
          .map((p) => `${x.file}: ${p}`),
      );
    expect(deleted).toEqual([]);
  });

  it("★★M-13 b2c the guard SAYS SO when there is something to find", () => {
    // ★THE PAIRED NON-VACUITY CASE. The scans above find nothing today; this
    // proves the same code refuses a real passthrough call, using the route
    // that was deleted rather than an invented one — and at the prefix the
    // api actually serves, which is what round 1 found the first cut got
    // wrong in every constant.
    const panel = [
      'const r = await api.post("/v1/meta/ads/audiences", { name });',
      'const list = await api.get("/v1/meta/ads/campaigns?adAccountId=" + id);',
      "await api.patch(`/v1/meta/ads/campaigns/${campaignId}/status`, { status });",
    ].join("\n");

    const found = findMetaAdsPaths(panel);
    expect(found).toContain(`${META_ADS_PREFIX}/audiences`);

    const refused = found.filter((p) => !isManagedMetaAdsPath(p));
    expect(refused).toEqual([`${META_ADS_PREFIX}/audiences`]);
  });

  it("★★M-13 b2c the sibling Meta mounts are not swept up — whatsapp and content are other routers", () => {
    const other = [
      'api.get("/v1/meta/whatsapp/conversations");',
      'api.get("/v1/meta/content/posts");',
    ].join("\n");
    expect(findMetaAdsPaths(other)).toEqual([]);
  });

  it("★★M-13 b2c a template path with an interpolated id is still matched, not waved through", () => {
    // ⚠️★A CALL SITE DOES NOT WRITE `:campaignId`. It writes `${campaignId}`,
    // and a string-equality check against the template would call every real
    // status call unmanaged — which is the guard firing on the one thing it
    // exists to permit, and the fix for that is always to weaken it.
    expect(isManagedMetaAdsPath("/v1/meta/ads/campaigns/${campaignId}/status")).toBe(true);
    expect(isManagedMetaAdsPath("/v1/meta/ads/ads/${adId}/status")).toBe(true);
    // ⏸AND A PARAM DOES NOT SWALLOW A SEGMENT BOUNDARY.
    expect(isManagedMetaAdsPath("/v1/meta/ads/campaigns/a/b/status")).toBe(false);
    // ⚠️⚠️★AND A LONGER PATH IS NOT A PREFIX MATCH. `expected.every(…)` walks
    // the TEMPLATE, so without the length comparison every path that merely
    // *starts* with a managed one is waved through — `…/status/anything`
    // included. Found by mutation: deleting that line killed no other case.
    expect(isManagedMetaAdsPath("/v1/meta/ads/campaigns/x/status/extra")).toBe(false);
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
describe("★★M-13 — metaAdsUrl, so a panel never has to write a literal", () => {
  it("★★M-13 b2c fills the params and the result is itself a managed path", () => {
    const url = metaAdsUrl(`${META_ADS_PREFIX}/campaigns/:campaignId/status`, {
      campaignId: "1202101",
    });
    expect(url).toBe("/v1/meta/ads/campaigns/1202101/status");
    // ★THE ROUND TRIP IS THE POINT: what the builder produces must survive the
    // guard, or M-16 has to bypass one of the two.
    expect(isManagedMetaAdsPath(url)).toBe(true);
  });

  it("★★M-13 b2c refuses a missing param rather than emitting a path with a hole in it", () => {
    expect(() => metaAdsUrl(`${META_ADS_PREFIX}/campaigns/:campaignId/status`, {})).toThrow(
      /campaignId/,
    );
  });

  it("★★M-13 b2c refuses a route that is not on the managed list", () => {
    expect(() =>
      metaAdsUrl(
        `${META_ADS_PREFIX}/audiences` as (typeof META_ADS_MANAGED_ROUTES)[number],
        {},
      ),
    ).toThrow(/not a managed/);
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
describe("★★M-13 — the prefix and the routes are peakhour-api's, not ours", () => {
  /**
   * ⏸THE SIBLING CHECKOUT, OR A SKIP — `cron-metadata.test.ts`'s rule, for its
   * reason: a b2c-only clone should still have a green suite. ONLY the read
   * may skip, and ⚠️★IT WARNS WHEN IT DOES (review round 1): a silent skip is
   * indistinguishable from a pass, and if the api half moved either file
   * these cases would report green for ever with nothing checked.
   */
  function readSibling(path: string): string | null {
    if (existsSync(path)) return readFileSync(path, "utf8");
    console.warn(`[m13] peakhour-api checkout not found at ${path} — cross-repo cases SKIPPED`);
    return null;
  }

  const routesIndex = readSibling(SIBLING_ROUTES_INDEX);
  const routeFile = readSibling(SIBLING_ROUTE_FILE);

  it.skipIf(routesIndex === null)(
    "★★M-13 b2c META_ADS_PREFIX is the mount the api actually serves",
    () => {
      // ⚠️⚠️★THE CASE ROUND 1 EXISTS FOR. The list used to be keyed on
      // `/v1/meta-ads` — the api's source DIRECTORY, and the ledger row's
      // wording — while the router is mounted `/meta/ads` under
      // `.basePath("/v1")`. Nothing is served at `/v1/meta-ads`, so the whole
      // guard matched nothing and reported it as a pass. ★Read the MOUNT.
      const base = /new Hono<[^>]*>\(\)\.basePath\("([^"]+)"\)/.exec(routesIndex!);
      const mount = /v1\.route\("([^"]+)", metaAdsRoutes\)/.exec(routesIndex!);
      expect(base, "could not find the v1 basePath in peakhour-api").not.toBeNull();
      expect(mount, "could not find the metaAdsRoutes mount in peakhour-api").not.toBeNull();
      expect(`${base![1]}${mount![1]}`).toBe(META_ADS_PREFIX);
    },
  );

  it.skipIf(routeFile === null)(
    "★★M-13 b2c every managed route has a handler in peakhour-api's meta-ads route file",
    () => {
      const missing = META_ADS_MANAGED_ROUTES.filter(
        (route) => !routeFile!.includes(`"${route.replace(META_ADS_PREFIX, "")}"`),
      );
      expect(
        missing,
        "a route in META_ADS_MANAGED_ROUTES is served by no handler in peakhour-api",
      ).toEqual([]);
    },
  );

  it.skipIf(routeFile === null)(
    "★★M-13 b2c and the sibling read is the route file, not some other file that happens to exist",
    () => {
      // ⚠️★NON-VACUITY AGAIN: `includes` over an empty string is false for
      // every route, so the case above would report "all missing" — but over
      // a file that is not the route file it could just as easily report
      // nothing missing by accident. Pin what was read.
      expect(routeFile!).toContain('app.post("/campaigns"');
      expect(routeFile!.length).toBeGreaterThan(1000);
    },
  );
});
