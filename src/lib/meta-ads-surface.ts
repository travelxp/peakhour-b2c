/**
 * ★★M-13 — WHICH META ADS ROUTES A b2c SURFACE MAY CALL.
 *
 * ── WHY THIS FILE EXISTS, AND WHY IT IS NOT A CLIENT ──────────────────────
 *
 * M-13's ledger row reads *"Mark `/v1/meta-ads` passthrough routes
 * `@deprecated`; b2c stops pointing at them"*, and its definition of done is
 * **"no surface creates a campaign invisible to the monitor."**
 *
 * ⚠️★**b2c HAS NEVER POINTED AT THEM.** There is no `lib/api/meta-ads.ts`, no
 * `meta-ads-panel.tsx`, and no `meta_ads` entry in `ADS_CHANNELS` — the ads hub
 * registry says so itself: *"a connector that is merely catalogued (meta_ads,
 * google_ads) stays out until its panel exists."* The Meta panel is **M-16**,
 * a row added precisely because the ledger had no row for any channel UI, and
 * it is not started. So the removal half of M-13 is work that does not exist,
 * and this file is not it.
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
 */
export const META_ADS_DELETED_ROUTES = [`${META_ADS_PREFIX}/audiences`] as const;

/**
 * Matches any Meta-ads path that appears in a source file.
 *
 * ⚠️★DELIBERATELY NOT AN AST WALK OR AN IMPORT GRAPH. The thing being
 * prevented is a fetch to a passthrough route, and a path that reaches the
 * network reaches this regex first — whether it is a string literal, a
 * template with an interpolated id, or a `queryKey` built from a constant.
 * The cost is that a path inside a COMMENT counts too; that is the safe
 * direction, and the one case it produces in practice is this file's own
 * header, which the test scans around by path.
 *
 * ⏸`/v1/meta/whatsapp` AND `/v1/meta/content` ARE SIBLING MOUNTS and must not
 * match — `/ads` is required, so they do not.
 */
const META_ADS_PATH = /\/v1\/meta\/ads(?:\/[A-Za-z0-9_\-:${}.]+)*/g;

/**
 * Every Meta-ads path named in `text`, de-duplicated and in source order.
 */
export function findMetaAdsPaths(text: string): string[] {
  return [...new Set(text.match(META_ADS_PATH) ?? [])];
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
