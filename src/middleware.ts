import { NextResponse, type NextRequest } from "next/server";
import { b2cAccessCookieName, b2cRefreshCookieName } from "@/lib/auth-cookies";
import { isAppRoute } from "@/lib/route-theme";
import { gatedVerdict, isGateOn, isPublicPath } from "@/lib/seo/gate";
import { NOINDEX_HEADER, isIndexableDeployment } from "@/lib/seo/indexable";
import { resolveLocaleRoute } from "@/lib/seo/locale-route";
import { LOCALE_HEADER, PATH_HEADER } from "@/i18n/config";
import type { Locale } from "@/lib/seo/types";

const isDev = process.env.NODE_ENV !== "production";

const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/**
 * Build the per-request CSP + the request headers that carry the nonce (so
 * Next.js can stamp it onto framework `<script>` tags for 'strict-dynamic').
 * Only needed for full-document requests — prefetch/rsc/server-action requests
 * deliberately get no nonce/CSP (it can break RSC streaming).
 */
function buildCsp(req: NextRequest): { csp: string; reqHeaders: Headers } {
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
  );

  // WhatsApp Embedded Signup: AFTER the merchant logs in, the Facebook JS SDK
  // executes a PARSER-INSERTED INLINE <script> in our page to process the
  // response. 'strict-dynamic' only auto-trusts script-API-inserted scripts (a
  // trusted script calling createElement+src) — NOT inline scripts — and we
  // can't put our nonce on a script Facebook injects, so it's CSP-blocked and
  // FB.login fails with Meta's generic "Sorry, something went wrong" page. The
  // browser's own violation report names the remedy: allow the script's hash
  // (hashes ARE honoured alongside 'strict-dynamic'). If a future Facebook
  // sdk.js revision changes this inline script, the console reports the new
  // hash — add it here. Scoped to script-src so only this exact content runs.
  const META_SDK_INLINE_HASHES = [
    "'sha256-n46vPwSWuMC0W703pBofImv82Z26xo4LXymv0E9caPk='",
  ].join(" ");
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${META_SDK_INLINE_HASHES}`;
  const connectSrc = [
    "connect-src 'self'",
    apiOrigin,
    "https://*.vercel-insights.com",
    "https://vitals.vercel-insights.com",
    "https://*.vercel-analytics.com",
    // WhatsApp Embedded Signup: the Facebook JS SDK (connect.facebook.net,
    // loaded via 'strict-dynamic') makes runtime fetch/XHR calls to
    // www.facebook.com (impression/funnel logging) and graph.facebook.com.
    // Without these, the SDK is blocked by CSP and FB.login dies with Meta's
    // generic "Sorry, something went wrong" page. The ES popup can launch from
    // /dashboard/content/whatsapp and the /dashboard/integrations modal, so the
    // allowance is global (like the Vercel hosts above). frame-src/img-src
    // already permit `https:`, covering the SDK's xd_arbiter iframe + pixels.
    "https://www.facebook.com",
    "https://graph.facebook.com",
    "https://connect.facebook.net",
    isDev ? "ws: wss: http://localhost:* ws://localhost:*" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const frameAncestors = "frame-ancestors 'none'";
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Allow framing https subresources — the LinkedIn carousel preview renders
    // a PDF served from the R2 media origin in an <iframe>. Consistent with the
    // img-src `https:` allowance; `frame-ancestors 'none'` still blocks anyone
    // from framing US.
    "frame-src 'self' https:",
    connectSrc,
    frameAncestors,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("content-security-policy", csp);
  return { csp, reqHeaders };
}

/**
 * The two request headers the locale routing owns. Every inbound copy is dropped first, so a caller cannot
 * pick a language or a path by sending them; then the middleware's own values are set. `locale` is set only
 * on a rewrite to the localized route, after the page passed the publish gate.
 */
function stampLocaleHeaders(h: Headers, pathname: string, locale: Locale | null): Headers {
  h.delete(LOCALE_HEADER);
  h.delete(PATH_HEADER);
  if (locale) h.set(LOCALE_HEADER, locale);
  h.set(PATH_HEADER, pathname);
  return h;
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Next.js prefetch / RSC / server-action requests. The CSP nonce dance must
  // NOT touch these (it can break RSC streaming) — previously they were excluded
  // from the middleware entirely via the matcher `missing` block. We now let the
  // middleware run on them so the coming-soon gate can rewrite them too (so the
  // real app never loads — even for a crafted RSC request), but we skip the
  // nonce/CSP work for them, preserving the prior behavior.
  const h = req.headers;
  const isPassthrough =
    h.get("next-router-prefetch") !== null ||
    h.get("purpose") === "prefetch" ||
    h.get("next-action") !== null ||
    h.get("rsc") !== null;

  // ── Coming-soon gate ────────────────────────────────────────────────
  // When COMING_SOON=true (set it in Vercel's Production env), EVERY route is
  // rewritten to the standalone /coming-soon teaser — the real app never loads
  // for the public. The team bypasses with `?preview=<COMING_SOON_PREVIEW_SECRET>`
  // (sets a 1-week httpOnly cookie); `?preview=off` clears it. To preview the
  // teaser in dev, visit /coming-soon directly, or set COMING_SOON=true locally
  // and use the preview secret to get back into the app.
  const comingSoon = isGateOn();
  const previewSecret = process.env.COMING_SOON_PREVIEW_SECRET ?? "";
  const PREVIEW_COOKIE = "ph_preview";
  const previewParam = searchParams.get("preview");
  const revokePreview = previewParam === "off";
  const grantPreview = !!previewSecret && previewParam === previewSecret;
  const hasPreviewCookie =
    !revokePreview &&
    !!previewSecret &&
    req.cookies.get(PREVIEW_COOKIE)?.value === previewSecret;
  // The allowlist of pages that stay publicly reachable while the gate is on, with the reason for each
  // exemption, lives in lib/seo/gate.ts (PUBLIC_PATHS) so the sitemap reads the same list the gate enforces.
  const publicPath = isPublicPath(pathname);
  // Authenticated-session bypass — SCOPED TO APP ROUTES ONLY. The b2c
  // access/refresh cookies are scoped to the root domain (.peakhour.ai) and so
  // are visible here. An approved launch partner who has signed in carries
  // `refresh_token` (30d) and must be able to reach the real app — but ONLY the
  // app, not the public marketing pages. Without the route scope, a signed-in
  // user (or anyone with a stale .peakhour.ai cookie from dev) bypassed the
  // teaser on `/` too and landed on the marketing homepage instead of "coming
  // soon". So the bypass applies only under /dashboard, /onboarding, /cms; the
  // homepage and every marketing/legal route still show the teaser to EVERYONE
  // while the gate is on. Soft gate: presence ≠ validity — the app's own auth
  // guard (AuthProvider → /v1/auth/me) bounces an invalid session back to /auth.
  // The app-route list is shared with the ThemeProvider (lib/route-theme.ts).
  const hasSession =
    !!req.cookies.get(b2cAccessCookieName())?.value ||
    !!req.cookies.get(b2cRefreshCookieName())?.value;
  const sessionBypass = hasSession && isAppRoute(pathname);
  const gated =
    comingSoon &&
    pathname !== "/coming-soon" &&
    !publicPath &&
    !sessionBypass &&
    !grantPreview &&
    !hasPreviewCookie;

  // ── Locale routing (SEO-4) ──────────────────────────────────────────
  // AFTER the gate: a gated request never reaches it, and the gate's own verdict stands (a locale-prefixed
  // path matches no route, so a gated "/fr-ca/shopify" is already a 404). A not-gated request whose first
  // segment is a lowercase non-English locale prefix is rewritten to the internal localized route when
  // that page is published in that locale, and to the public 404 otherwise. No detection, no redirect.
  const localeRoute = gated ? null : resolveLocaleRoute(pathname);

  let res: NextResponse;
  // A gated path that matches no route is a 404, not the teaser (a 200 teaser for
  // /does-not-exist is a soft 404); a gated KNOWN page is the teaser with noindex,
  // because the teaser is not that page. See gatedVerdict in lib/seo/gate.ts.
  const verdict = gated ? gatedVerdict(pathname) : null;
  // Where this request is rewritten to, if anywhere, and the locale the page then renders in.
  let rewriteTo: string | null = null;
  let renderLocale: Locale | null = null;
  if (gated) {
    rewriteTo = verdict === "not-found" ? "/gate-404" : "/coming-soon";
  } else if (localeRoute?.kind === "rewrite") {
    rewriteTo = localeRoute.target;
    renderLocale = localeRoute.locale;
  } else if (localeRoute) {
    rewriteTo = "/gate-404";
  }
  if (rewriteTo !== null) {
    const url = req.nextUrl.clone();
    url.pathname = rewriteTo;
    // A gate rewrite drops the query; a locale rewrite keeps it (it is the same page).
    if (gated) url.search = "";
    if (isPassthrough) {
      // No nonce or CSP on these (see above); only the locale headers.
      res = NextResponse.rewrite(url, { request: { headers: stampLocaleHeaders(new Headers(req.headers), pathname, renderLocale) } });
    } else {
      // Full-document request → carry the nonce so the rewritten HTML matches.
      const { csp, reqHeaders } = buildCsp(req);
      res = NextResponse.rewrite(url, { request: { headers: stampLocaleHeaders(reqHeaders, pathname, renderLocale) } });
      res.headers.set("Content-Security-Policy", csp);
    }
  } else if (isPassthrough) {
    // Prefetch / RSC / action: no nonce or CSP work; only the two locale headers are set (the header and
    // language switcher read the path from them on an RSC render).
    res = NextResponse.next({ request: { headers: stampLocaleHeaders(new Headers(req.headers), pathname, null) } });
  } else {
    const { csp, reqHeaders } = buildCsp(req);
    res = NextResponse.next({ request: { headers: stampLocaleHeaders(reqHeaders, pathname, null) } });
    res.headers.set("Content-Security-Policy", csp);
  }

  // Indexing. A deployment that is not Production sends noindex on EVERY response
  // this middleware sees (rewrites and passthrough requests included), so a crawler
  // that finds dev or a preview URL leaves it out of the index whatever its robots.txt
  // said. Production sends none, except on a gated known page (see above).
  if (!isIndexableDeployment()) {
    res.headers.set("X-Robots-Tag", NOINDEX_HEADER);
  } else if (verdict === "teaser-noindex") {
    res.headers.set("X-Robots-Tag", "noindex");
  }

  if (grantPreview) {
    res.cookies.set(PREVIEW_COOKIE, previewSecret, {
      httpOnly: true,
      sameSite: "lax",
      secure: !isDev,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
  } else if (revokePreview) {
    res.cookies.delete(PREVIEW_COOKIE);
  }

  return res;
}

export const config = {
  // No `missing` exclusions — the gate must see prefetch/rsc/next-action
  // requests too (so a crafted RSC request can't pull a gated route). The
  // middleware skips the nonce/CSP work for those internally.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
