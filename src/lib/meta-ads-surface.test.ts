import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  META_ADS_PREFIX,
  META_ADS_MANAGED_ROUTES,
  META_ADS_DELETED_ROUTES,
  findMetaAdsPaths,
  findForbiddenSurfaceImports,
  isBareMetaAdsMount,
  isManagedMetaAdsPath,
  COMPOSABLE_EXPORTS,
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

const SIBLING_REPO = fileURLToPath(new URL("../../../peakhour-api", import.meta.url));
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
      .flatMap((x) =>
        x.paths
          // ⏸THE BARE MOUNT IS PROSE (review round 3) — no handler sits at it,
          // so naming it reaches nothing, and refusing it pointed authors at a
          // list that cannot contain the prefix.
          .filter((p) => !isBareMetaAdsMount(p) && !isManagedMetaAdsPath(p))
          .map((p) => `${x.file}: ${p}`),
      );
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
      // ⚠️⚠️★AND A MOUNT THAT MERELY STARTS WITH `ads` (review round 2). The
      // first cut's `(?:\/…)*` was zero-or-more with no right boundary, so
      // `/v1/meta/adsets/…` yielded a bare `/v1/meta/ads` — which the scan then
      // refused as unmanaged, naming a path the file never wrote. That is the
      // guard firing on the one thing it exists to permit, and the fix for
      // that is always to weaken it.
      'api.get("/v1/meta/adsets/1");',
    ].join("\n");
    expect(findMetaAdsPaths(other)).toEqual([]);
  });

  it("★★M-13 b2c a managed route is not refused for its PUNCTUATION", () => {
    // ⚠️★`.` WAS IN THE SEGMENT CLASS (review round 2), so a sentence-final
    // period produced `/v1/meta/ads/campaigns.` — six characters that make a
    // managed route unmanaged, reported against a file whose only sin was a
    // full stop. A path is segments; a full stop is prose.
    expect(findMetaAdsPaths("see /v1/meta/ads/campaigns.")).toEqual([
      `${META_ADS_PREFIX}/campaigns`,
    ]);
    expect(isManagedMetaAdsPath(`${META_ADS_PREFIX}/campaigns`)).toBe(true);
  });

  it("★★M-13 b2c no source file imports the raw prefix or the deleted list", () => {
    // ⚠️⚠️★★THE HOLE THE PATH SCAN CANNOT SEE (review round 2), and this PR's
    // own premise made it likely: *"M-16's panel imports this."* Composing a
    // URL from the exports leaves NO literal —
    // `` api.get(`${META_ADS_PREFIX}/audiences`) `` and
    // `api.get(META_ADS_DELETED_ROUTES[0])` both type-check, both call the
    // deleted passthrough, and both return `[]` from `findMetaAdsPaths`.
    // ★A file that cannot import the raw materials cannot compose one.
    const offenders = scanned
      .map((f) => ({ file: rel(f), names: findForbiddenSurfaceImports(readFileSync(f, "utf8")) }))
      .filter((x) => x.names.length > 0)
      .map((x) => `${x.file}: ${x.names.join(", ")}`);
    expect(
      offenders,
      "import META_ADS_MANAGED_ROUTES and metaAdsUrl instead — they refuse a deleted route",
    ).toEqual([]);
  });

  it("★★M-13 b2c and the import check SAYS SO when there is something to find", () => {
    // The paired non-vacuity case, in both directions.
    const bad = 'import { META_ADS_PREFIX } from "@/lib/meta-ads-surface";';
    const alsoBad = 'import { metaAdsUrl, META_ADS_DELETED_ROUTES } from "./meta-ads-surface";';
    const good = 'import { metaAdsUrl, META_ADS_MANAGED_ROUTES } from "@/lib/meta-ads-surface";';
    const elsewhere = 'import { META_ADS_PREFIX } from "@/lib/some-other-module";';
    expect(findForbiddenSurfaceImports(bad)).toEqual(["META_ADS_PREFIX"]);
    expect(findForbiddenSurfaceImports(alsoBad)).toEqual(["META_ADS_DELETED_ROUTES"]);
    expect(findForbiddenSurfaceImports(good)).toEqual([]);
    expect(findForbiddenSurfaceImports(elsewhere)).toEqual([]);
  });

  it("★★M-13 b2c a NAMESPACE import is all of them, and a default beside a named one still counts", () => {
    // ⚠️⚠️★REVIEW ROUND 3. The round-2 regex required a pure `{ … }` clause, so
    // the two most idiomatic bypasses in this repo both returned `[]`:
    // `import * as surface from …` (then `surface.META_ADS_PREFIX`, which names
    // nothing the scan can see) and `import api, { … } from …`. Both are
    // established b2c style — `import * as React` across `components/ui/*`, and
    // default+named in `components/emoji-picker.tsx`.
    const namespaced = 'import * as surface from "@/lib/meta-ads-surface";';
    expect(findForbiddenSurfaceImports(namespaced).sort()).toEqual(
      [...COMPOSABLE_EXPORTS].sort(),
    );
    const defaultPlusNamed =
      'import api, { META_ADS_DELETED_ROUTES } from "@/lib/meta-ads-surface";';
    expect(findForbiddenSurfaceImports(defaultPlusNamed)).toEqual(["META_ADS_DELETED_ROUTES"]);
  });

  it("★★M-13 b2c and it does not depend on how DEEP the importing file is", () => {
    // ⚠️⚠️★REVIEW ROUND 3, AND THE ONE FILE THIS GUARD EXISTS FOR WALKED PAST
    // IT. The round-2 matcher enumerated three specifier spellings, and the
    // relative one was reachable only from a file one level under `src/`.
    // M-16's panel lives at `src/app/(site)/dashboard/ads/_components/`, whose
    // specifier is five `..` deep.
    const deep = 'import { META_ADS_PREFIX } from "../../../../../lib/meta-ads-surface";';
    expect(findForbiddenSurfaceImports(deep)).toEqual(["META_ADS_PREFIX"]);
    // ⏸AND A RE-EXPORT BARREL, which is invisible twice over: the barrel's own
    // import is missed, and every downstream importer then names the barrel.
    const barrel = 'export { META_ADS_PREFIX } from "@/lib/meta-ads-surface";';
    expect(findForbiddenSurfaceImports(barrel)).toEqual(["META_ADS_PREFIX"]);
  });

  it("★★M-13 b2c the bare mount is prose, not a call, and is not refused", () => {
    // ⚠️★REVIEW ROUND 3. `findMetaAdsPaths` matches the mount on its own, and
    // no template has four segments — so any docblock saying where the router
    // lives failed the suite, pointing its author at a list that cannot contain
    // the prefix. Nothing is served at the bare mount, so naming it reaches
    // nothing.
    expect(findMetaAdsPaths("the router is mounted at /v1/meta/ads.")).toEqual([
      META_ADS_PREFIX,
    ]);
    expect(isBareMetaAdsMount(META_ADS_PREFIX)).toBe(true);
    expect(isBareMetaAdsMount(`${META_ADS_PREFIX}/audiences`)).toBe(false);
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
describe("★★M-16 — the ads hub HAS a Meta tab, and it reaches Meta only through the client", () => {
  /**
   * ★THIS BLOCK USED TO ASSERT THE OPPOSITE, AND WAS WRITTEN TO. M-13's case
   * read *"ADS_CHANNELS registers no Meta channel — the panel is M-16 and is
   * not started"*, and was designed to fail the day M-16 landed so its author
   * had to come here and confirm the panel was built from the managed list.
   * These cases are that confirmation, made checkable rather than claimed.
   */
  const CLIENT = "src/lib/api/meta-ads.ts";
  const PANEL = "src/app/(site)/dashboard/ads/_components/meta-ads-panel.tsx";
  const readRel = (p: string) => readFileSync(join(SRC, "..", p), "utf8");

  it("★★M-16 b2c ADS_CHANNELS registers the Meta channel", () => {
    expect(ADS_CHANNELS.map((c) => c.providerKey)).toContain("meta_ads");
  });

  it("★★M-16 b2c the panel reaches Meta through `metaAdsApi` and names no Meta path itself", () => {
    const panel = readRel(PANEL);
    expect(panel).toMatch(/import\s*\{[^}]*\bmetaAdsApi\b[^}]*\}\s*from\s*"@\/lib\/api\/meta-ads"/);
    // ⚠️★THE BARE MOUNT IS EXCLUDED, AS THE GLOBAL SCAN EXCLUDES IT. A first cut
    //  refused it here, and a PASS mutation — a comment saying where the router
    //  is mounted — went red: M-13 round 3's *"the guard firing on the one
    //  thing it exists to permit"*, re-made in the case written to extend it.
    expect(findMetaAdsPaths(panel).filter((p) => !isBareMetaAdsMount(p))).toEqual([]);
    // ⏸PAIRED: the file read is the panel, not an empty or unrelated one.
    expect(panel).toContain("export function MetaAdsPanel");
  });

  it("★★M-16 b2c every Meta path in the client is built by metaAdsUrl, not handed to `api` raw", () => {
    // ⚠️The global scan above permits a MANAGED literal anywhere, so
    // `api.get("/v1/meta/ads/campaigns")` would pass it. This is what makes the
    // client the one place a path is turned into a request, through the
    // function that refuses a route off the managed list at runtime too.
    const client = readRel(CLIENT);
    const literals = [...client.matchAll(/["'`](\/v1\/meta\/ads[^"'`]*)["'`]/g)];
    expect(literals.length, "the client names no Meta path at all — wrong file?").toBeGreaterThan(5);
    const bare = literals.filter((m) => !/metaAdsUrl\(\s*$/.test(client.slice(0, m.index)));
    expect(bare.map((m) => m[1])).toEqual([]);
  });

  it("★★M-16 b2c and that check SAYS SO when there is something to find", () => {
    // The paired non-vacuity case, on the same regex and the same slice test.
    const src = 'api.get("/v1/meta/ads/campaigns"); api.get(metaAdsUrl("/v1/meta/ads/ads"));';
    const literals = [...src.matchAll(/["'`](\/v1\/meta\/ads[^"'`]*)["'`]/g)];
    const bare = literals.filter((m) => !/metaAdsUrl\(\s*$/.test(src.slice(0, m.index)));
    expect(bare.map((m) => m[1])).toEqual(["/v1/meta/ads/campaigns"]);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("★★M-13 — the prefix and the routes are peakhour-api's, not ours", () => {
  /**
   * ⏸THE SIBLING CHECKOUT, OR A SKIP — `cron-metadata.test.ts`'s rule, for its
   * reason: a b2c-only clone should still have a green suite.
   *
   * ⚠️⚠️★★THE SKIP IS KEYED ON THE CHECKOUT, NOT ON THE FILE (review round 2).
   * It used to be `existsSync(<the 2,165-line route file>)`, which the
   * companion api PR is actively editing — so a refactor splitting that file
   * into `campaigns.ts` / `ad-sets.ts` would have made all three cross-repo
   * cases skip, under a warning saying *"checkout not found"* that was simply
   * false, in a repo with no PR CI where that line is scrollback. The
   * non-vacuity pins added in round 1 live INSIDE the successful-read branch,
   * so nothing would have caught it and `META_ADS_MANAGED_ROUTES` would have
   * stopped being checked against the api for ever.
   *
   * ★The precedent this file cites anchors on `peakhour-api/vercel.json` at
   * the repo ROOT, which is exactly why its skip can only mean *no checkout*.
   * **A missing checkout skips; a missing FILE inside a present checkout
   * fails.**
   */
  const siblingRepoPresent = existsSync(SIBLING_REPO);
  if (!siblingRepoPresent) {
    console.warn(`[m13] no peakhour-api checkout at ${SIBLING_REPO} — cross-repo cases SKIPPED`);
  }

  /**
   * ⚠️★CALLED INSIDE EACH CASE, NOT IN THE `describe` BODY (review round 3).
   * A throw during collection fails the WHOLE FILE, so an api-side refactor
   * would have taken down the fifteen b2c-only cases along with these three —
   * and those fifteen are the guard that still works when the sibling moves.
   */
  function readSibling(path: string): string {
    if (!existsSync(path)) {
      throw new Error(
        `[m13] peakhour-api is checked out but ${path} is missing. This is NOT a skip: the ` +
          `Meta ads router moved or was renamed, and META_ADS_MANAGED_ROUTES is now checked ` +
          `against nothing. Point this test at the new file.`,
      );
    }
    return readFileSync(path, "utf8");
  }

  it.skipIf(!siblingRepoPresent)(
    "★★M-13 b2c META_ADS_PREFIX is the mount the api actually serves",
    () => {
      const routesIndex = readSibling(SIBLING_ROUTES_INDEX);
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

  it.skipIf(!siblingRepoPresent)(
    "★★M-13 b2c every managed route has a handler in peakhour-api's meta-ads route file",
    () => {
      const routeFile = readSibling(SIBLING_ROUTE_FILE);
      const missing = META_ADS_MANAGED_ROUTES.filter(
        (route) => !routeFile.includes(`"${route.replace(META_ADS_PREFIX, "")}"`),
      );
      expect(
        missing,
        "a route in META_ADS_MANAGED_ROUTES is served by no handler in peakhour-api",
      ).toEqual([]);
    },
  );

  it.skipIf(!siblingRepoPresent)(
    "★★M-13 b2c and the sibling read is the route file, not some other file that happens to exist",
    () => {
      // ⚠️★NON-VACUITY AGAIN: `includes` over an empty string is false for
      // every route, so the case above would report "all missing" — but over
      // a file that is not the route file it could just as easily report
      // nothing missing by accident. Pin what was read.
      const routeFile = readSibling(SIBLING_ROUTE_FILE);
      expect(routeFile).toContain('app.post("/campaigns"');
      expect(routeFile.length).toBeGreaterThan(1000);
    },
  );

  it.skipIf(!siblingRepoPresent)(
    "★★M-16 b2c the deleted passthrough is GONE from the api, not merely unlisted here",
    () => {
      // ★OWED SINCE M-13 AND PAID NOW. The contract module's own note: *"Owed
      // once #1369 merges: one `expect(routeFile).not.toContain('"/audiences"')`
      // in the cross-repo block."* api#1369 merged 2026-09-16. Deliberately not
      // written before, because a test red on purpose is a test somebody
      // disables.
      const routeFile = readSibling(SIBLING_ROUTE_FILE);
      for (const deleted of META_ADS_DELETED_ROUTES) {
        const sub = deleted.replace(META_ADS_PREFIX, "");
        // The note's own assertion. ⏸Measured safe on api `e917e309`: the
        //  route file's tombstone names the deleted path only in backticks and
        //  with its prefix (`POST /v1/meta/ads/audiences`), never as `"/audiences"`.
        expect(routeFile).not.toContain(`"${sub}"`);
        // And the registration shape, which a re-add in any quote style hits.
        expect(routeFile).not.toMatch(new RegExp(`app\\.(get|post|put|patch|delete)\\(\\s*["'\`]${sub}["'\`]`));
      }
      // ⏸PAIRED with a live registration in the same shape, so the regex is
      //  known to match a real one and is not vacuous.
      expect(routeFile).toMatch(/app\.(get|post|put|patch|delete)\(\s*["'`]\/campaigns["'`]/);
    },
  );
});
