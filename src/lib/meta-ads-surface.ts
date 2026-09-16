/**
 * ★★M-13 — WHICH `/v1/meta-ads` ROUTES A b2c SURFACE MAY CALL.
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
 * ── ★WHAT IT IS INSTEAD ──────────────────────────────────────────────────
 *
 * The invariant, at the place the next author will act. When M-16 builds the
 * Meta panel, the obvious move is to wire it to whatever `/v1/meta-ads`
 * offers. Two of those routes were a **passthrough** — they handed the request
 * to Meta and wrote nothing locally — and a campaign created that way exists
 * at Meta and **does not exist here**: unmonitored by `ad-campaign-monitor`,
 * unbillable, and invisible to the kill switch and the spend caps.
 *
 * So the list below is the contract, not a convenience: a panel built from
 * `META_ADS_MANAGED_ROUTES` cannot reach a surface the monitor cannot see, and
 * `meta-ads-surface.test.ts` fails if a b2c file names anything else.
 *
 * ── ⏸THE ROUTES ARE PATH TEMPLATES, NOT URLS ─────────────────────────────
 *
 * `:campaignId` and friends are api-side parameter names, kept verbatim so a
 * reader can find the handler by grepping the sibling repo. The test checks
 * exactly that, against `peakhour-api`'s own route file.
 */

/** Every `/v1/meta-ads` route that records what it did in `ad_campaigns`, or reads. */
export const META_ADS_MANAGED_ROUTES = [
  "/v1/meta-ads/ad-accounts",
  "/v1/meta-ads/datasets",
  "/v1/meta-ads/datasets/selected",
  "/v1/meta-ads/campaigns",
  "/v1/meta-ads/campaigns/:campaignId/status",
  "/v1/meta-ads/ad-sets",
  "/v1/meta-ads/ad-sets/:adSetId/status",
  "/v1/meta-ads/ads",
  "/v1/meta-ads/ads/:adId/status",
  "/v1/meta-ads/analytics",
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
export const META_ADS_DELETED_ROUTES = [
  "/v1/meta-ads/audiences",
] as const;

/** Matches any `/v1/meta-ads…` path that appears in a source file. */
const META_ADS_PATH = /\/v1\/meta-ads(?:\/[A-Za-z0-9_\-:${}.]+)*/g;

/**
 * Every `/v1/meta-ads` path named in `text`, de-duplicated and in source order.
 *
 * ⚠️★DELIBERATELY NOT AN AST WALK OR AN IMPORT GRAPH. The thing being
 * prevented is a fetch to a passthrough route, and a path that reaches the
 * network reaches this regex first — whether it is a string literal, a
 * template with an interpolated id, or a `queryKey` built from a constant.
 * The cost is that a path inside a COMMENT counts too; that is the safe
 * direction, and the one case it produces in practice is this file's own
 * header, which the test scans around by name.
 */
export function findMetaAdsPaths(text: string): string[] {
  return [...new Set(text.match(META_ADS_PATH) ?? [])];
}

/**
 * Whether `path` is one a b2c surface may call.
 *
 * ⚠️COMPARED AGAINST THE TEMPLATE'S SHAPE, not by string equality: a real call
 * site writes `/v1/meta-ads/campaigns/${id}/status`, which equals no entry in
 * the list. Each segment matches literally unless the template's segment is a
 * `:param`, in which case anything non-empty matches.
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
