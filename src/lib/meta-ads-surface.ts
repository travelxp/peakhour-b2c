/**
 * ★★M-13 — WHICH META ADS ROUTES A b2c SURFACE MAY CALL.
 *
 * ── WHY THIS FILE EXISTS, AND WHY IT IS NOT A CLIENT ──────────────────────
 *
 * M-13's ledger row reads *"Mark `/v1/meta-ads` passthrough routes
 * `@deprecated`; b2c stops pointing at them"*, and its definition of done is
 * **"no surface creates a campaign invisible to the monitor."**
 *
 * ⚠️★**b2c HAD NEVER POINTED AT THEM.** When M-13 landed there was no
 * `lib/api/meta-ads.ts`, no `meta-ads-panel.tsx`, and no `meta_ads` entry in
 * `ADS_CHANNELS`, so the removal half of M-13 was work that did not exist, and
 * this file is not it.
 *
 * ✅**M-16 built all three**, and built them against this file: the client
 * turns every path into a request through `metaAdsUrl`, and the panel names no
 * path at all. `meta-ads-surface.test.ts` checks both.
 *
 * ── ⚠️⚠️★★THE PREFIX IS `/v1/meta/ads`, AND THE ROW'S IS NOT A URL ────────
 *
 * **Review round 1, and it made the first version of this guard inert.** The
 * ledger row, and a dozen comments in peakhour-api, write the surface as
 * `/v1/meta-ads` — which is the **source directory**, `src/v1/routes/meta-ads/`.
 * The router is mounted `v1.route("/meta/ads", metaAdsRoutes)` on a Hono app
 * with `.basePath("/v1")`, so nothing has ever been served at `/v1/meta-ads`.
 * b2c's own clients had it right all along: `lib/api/linkedin-ads.ts` calls
 * `/v1/linkedin/ads/...` and `lib/api/x-ads.ts` calls `/v1/x/ads/...`.
 *
 * ★A GUARD KEYED ON A PREFIX NOTHING SERVES MATCHES NOTHING, and it reports
 * that as a pass — the exact *"green for the same reason a broken scanner is
 * green"* shape this file's test was written to refuse, arriving in the
 * constant rather than in the logic. Proved by dropping a probe that called
 * the deleted passthrough at its real path: **8 passed, 0 failed.** The
 * cross-repo case below now reads the MOUNT, not just the sub-paths, because
 * the version that read only sub-paths could not see this.
 *
 * ── ★WHAT THIS FILE IS ───────────────────────────────────────────────────
 *
 * The invariant, at the place the next author will act. When M-16 builds the
 * Meta panel, the obvious move is to wire it to whatever the Meta ads router
 * offers. Two of those routes were a **passthrough** — they handed the request
 * to Meta and wrote nothing locally — and a campaign created that way exists
 * at Meta and **does not exist here**: unmonitored by `ad-campaign-monitor`,
 * unbillable, and invisible to the kill switch and the spend caps.
 */

/** The router's mount, `basePath` included. Pinned against the api in the test. */
export const META_ADS_PREFIX = "/v1/meta/ads";

/** Every Meta ads route that records what it did in `ad_campaigns`, or reads. */
export const META_ADS_MANAGED_ROUTES = [
  `${META_ADS_PREFIX}/ad-accounts`,
  `${META_ADS_PREFIX}/datasets`,
  `${META_ADS_PREFIX}/datasets/selected`,
  `${META_ADS_PREFIX}/campaigns`,
  `${META_ADS_PREFIX}/campaigns/:campaignId/status`,
  `${META_ADS_PREFIX}/ad-sets`,
  `${META_ADS_PREFIX}/ad-sets/:adSetId/status`,
  `${META_ADS_PREFIX}/ads`,
  `${META_ADS_PREFIX}/ads/:adId/status`,
  `${META_ADS_PREFIX}/analytics`,
] as const;

/**
 * ★DELETED, NOT DEPRECATED — and the reason is the owner's standing rule:
 * PeakHour is pre-launch, so the newest version is wired and the old one is
 * deleted as though it were never there. No dual-version support, no
 * deprecation windows. The ledger row's word `@deprecated` predates that rule,
 * and a JSDoc tag on a Hono handler is read by no client and no build anyway.
 *
 * ⏸WHAT WENT: `POST /audiences` could only ever mint an EMPTY custom-audience
 * shell (its body carried no `rule`, no `origin_audience_id`, and nothing in
 * peakhour-api has ever called `/<audience_id>/users`), and `GET /audiences`
 * was a declaration-BLIND duplicate of the reader `adapters/audience/meta.ts`
 * uses — so a panel wired to it would have offered a merchant audiences that
 * a special ad category makes the managed path refuse. The managed surface is
 * `/v1/audiences`.
 *
 * ✅"DELETED" WAS A CLAIM ABOUT **peakhour-api#1369**, which merged on
 * 2026-09-16. Their ABSENCE from the api's route file is now asserted in the
 * cross-repo block (M-16) — it was deliberately not asserted while #1369 was
 * open, because a test red on purpose is a test somebody disables.
 */
export const META_ADS_DELETED_ROUTES = [`${META_ADS_PREFIX}/audiences`] as const;

/**
 * Matches any Meta-ads path spelled out in a source file.
 *
 * ⚠️★DELIBERATELY NOT AN AST WALK. The thing being prevented is a fetch to a
 * passthrough route, and a path SPELLED OUT reaches this regex first — a
 * string literal, a template with an interpolated id, a `queryKey` built from
 * one. The cost is that a path inside a COMMENT counts too; that is the safe
 * direction, and the two files allowed to name one are excluded by path.
 *
 * ⚠️⚠️★★WHAT IT CANNOT SEE, AND WHAT COVERS THAT INSTEAD (review round 2). A
 * path COMPOSED from this module's own exports leaves no literal behind:
 * `` api.get(`${META_ADS_PREFIX}/audiences`) `` and
 * `api.get(META_ADS_DELETED_ROUTES[0])` both type-check, both call the deleted
 * passthrough, and both return `[]` from here. ★An earlier version of this
 * comment claimed *"a queryKey built from a constant"* was covered; it is
 * exactly the case that is not. `findForbiddenSurfaceImports` covers it, from
 * the other end — a file that cannot import the raw prefix cannot compose one.
 *
 * ⏸`/v1/meta/whatsapp` and `/v1/meta/content` are sibling mounts and must not
 * match; nor must a future `/v1/meta/adsets`, which the first cut DID match,
 * yielding a bare `/v1/meta/ads` it then refused as unmanaged — the guard
 * firing on a path the file never wrote. Hence the boundary.
 *
 * ⏸AND `.` IS NOT A PATH CHARACTER. It was in the class, so a sentence-final
 * period made `…/campaigns.` — a managed route refused for its punctuation.
 */
const META_ADS_PATH = /\/v1\/meta\/ads(?![A-Za-z0-9_-])(?:\/[A-Za-z0-9_\-:${}]+)*/g;

/**
 * Every Meta-ads path named in `text`, de-duplicated and in source order.
 */
export function findMetaAdsPaths(text: string): string[] {
  return [...new Set(text.match(META_ADS_PATH) ?? [])];
}

/**
 * Any `import`/`export … from "<specifier>"` whose specifier IS this module.
 *
 * ⚠️⚠️★★MATCHED BY SUFFIX, NOT BY AN ENUMERATION OF SPELLINGS (review round 3).
 * The first cut listed three — `@/lib/…`, `./…`, `../lib/…` — and the third is
 * reachable only from a file one level under `src/`. **The Meta panel M-16 will
 * build lives at `src/app/(site)/dashboard/ads/_components/`**, whose relative
 * specifier is `../../../../../lib/meta-ads-surface`, which matched nothing.
 * ★A guard whose coverage depends on the DEPTH of the importing file is a guard
 * the one file it was written for walks straight past.
 *
 * ⏸`export … from` TOO, because a re-export barrel is invisible twice over: the
 * barrel's own import is missed, and every downstream importer then names the
 * barrel rather than this module.
 */
const SURFACE_SPECIFIER = /["'][^"']*\/meta-ads-surface(?:\.tsx?)?["']/;
const MODULE_BINDING =
  /\b(?:import|export)\b([\s\S]{0,400}?)\bfrom\s*["'][^"']*\/meta-ads-surface(?:\.tsx?)?["']/g;

/**
 * Exports no b2c surface may import, because importing one lets a caller build
 * a URL this file's path scan cannot see.
 *
 * ★`metaAdsUrl` IS DELIBERATELY NOT HERE — it is the sanctioned path, and it
 * refuses a route that is not on the managed list at the type level AND at
 * runtime. `META_ADS_MANAGED_ROUTES` is not here either, and ⚠️★that is a
 * JUDGEMENT rather than a guarantee (review round 3): every entry in it is the
 * prefix plus a suffix, so
 * `META_ADS_MANAGED_ROUTES[0].replace("/ad-accounts", "") + "/audiences"`
 * reconstructs the deleted URL with no literal and no forbidden import. **This
 * check does not make that impossible, and an earlier version of this comment
 * said it did.** What it does is remove the ORDINARY ways — an import of the
 * prefix, or of a ready-made passthrough URL sitting behind an index.
 */
export const COMPOSABLE_EXPORTS = ["META_ADS_PREFIX", "META_ADS_DELETED_ROUTES"] as const;

/**
 * Which composable exports `text` takes from this module, if any.
 *
 * ⚠️★A NAMESPACE IMPORT IS ALL OF THEM (review round 3). `import * as surface
 * from "@/lib/meta-ads-surface"` grants `surface.META_ADS_PREFIX` without
 * naming it, and the round-2 regex required a pure `{ … }` clause — so it saw
 * neither that nor `import api, { META_ADS_DELETED_ROUTES } from …`. Both are
 * established b2c style (`import * as React` across `components/ui/*`;
 * default+named in `components/emoji-picker.tsx`).
 */
export function findForbiddenSurfaceImports(text: string): string[] {
  const found = new Set<string>();
  for (const [whole, clause] of text.matchAll(MODULE_BINDING)) {
    if (!SURFACE_SPECIFIER.test(whole)) continue;
    if (/\*\s*as\s+\w+/.test(clause)) {
      // The namespace binding reaches every export, including both below.
      for (const name of COMPOSABLE_EXPORTS) found.add(name);
      continue;
    }
    const named = /\{([\s\S]*?)\}/.exec(clause);
    if (!named) continue;
    for (const entry of named[1]!.split(",")) {
      const bare = entry.split(/\bas\b/)[0]!.replace(/^\s*type\s+/, "").trim();
      if ((COMPOSABLE_EXPORTS as readonly string[]).includes(bare)) found.add(bare);
    }
  }
  return [...found];
}

/**
 * Whether `path` is one a b2c surface may call.
 *
 * ⚠️COMPARED AGAINST THE TEMPLATE'S SHAPE, not by string equality: a real call
 * site writes `/v1/meta/ads/campaigns/${id}/status`, which equals no entry in
 * the list. Each segment matches literally unless the template's segment is a
 * `:param`, in which case anything non-empty matches — and the segment COUNTS
 * must agree, or every path that merely *starts* with a managed one is waved
 * through.
 */
export function isManagedMetaAdsPath(path: string): boolean {
  return META_ADS_MANAGED_ROUTES.some((template) => matchesTemplate(path, template));
}

/**
 * The mount with no route after it — `/v1/meta/ads` on its own.
 *
 * ⚠️★PROSE, NOT A CALL (review round 3). No handler is mounted at the bare
 * prefix, so naming it cannot reach a passthrough; but the extractor matches it
 * and no template has four segments, so the scan refused any docblock that
 * mentioned where the router lives — under a message pointing the author at a
 * list that **cannot** contain the prefix. ★That is the guard firing on the one
 * thing it exists to permit, for the third time in three rounds, and the fix
 * for that is always to weaken it.
 */
export function isBareMetaAdsMount(path: string): boolean {
  return path === META_ADS_PREFIX;
}

function matchesTemplate(path: string, template: string): boolean {
  const actual = path.split("/");
  const expected = template.split("/");
  if (actual.length !== expected.length) return false;
  return expected.every((segment, i) => {
    const got = actual[i] ?? "";
    if (segment.startsWith(":")) return got.length > 0;
    return segment === got;
  });
}

/**
 * The URL for a managed route, with its `:params` filled in.
 *
 * ★WITHOUT THIS THE CONTRACT CANNOT ACTUALLY BE USED (review round 1). The
 * list is `:param` templates, so a panel *"built from
 * `META_ADS_MANAGED_ROUTES`"* would still have to hand-write a literal
 * somewhere to interpolate an id — and a hand-written literal is exactly the
 * thing the guard refuses. M-16 calls this instead.
 *
 * Throws on an unknown template or a missing param, because a URL assembled
 * from a typo 404s at Meta's expense rather than ours.
 */
export function metaAdsUrl(
  template: (typeof META_ADS_MANAGED_ROUTES)[number],
  params: Readonly<Record<string, string>> = {},
): string {
  if (!(META_ADS_MANAGED_ROUTES as readonly string[]).includes(template)) {
    throw new Error(`${template} is not a managed Meta ads route`);
  }
  return template
    .split("/")
    .map((segment) => {
      if (!segment.startsWith(":")) return segment;
      const value = params[segment.slice(1)];
      if (!value) throw new Error(`metaAdsUrl(${template}) needs a value for ${segment}`);
      return encodeURIComponent(value);
    })
    .join("/");
}
